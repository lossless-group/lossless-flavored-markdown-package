/**
 * lfm-heading-blocks: Binds an eyebrow and a subheading to the heading they sit
 * against, producing one `<hgroup>` per block.
 *
 * Converts:
 *   $$ Portfolio Operations
 *   ## Every email from a portco, filed as PDFs
 *   && Two passes, inventory before export
 *
 * Into a `heading-block` containerDirective rendering as:
 *   <hgroup class="heading-block">
 *     <p class="heading-block-eyebrow eyebrow">Portfolio Operations</p>
 *     <h2 id="every-email-from-a-portco-filed-as-pdfs">Every email …</h2>
 *     <p class="heading-block-subheading subheading">Two passes …</p>
 *   </hgroup>
 *
 * Position is the semantics. `$$` and `&&` mean nothing on their own — they are
 * bound by *adjacency* to a heading, and everything else follows from that: no
 * blank line between, order fixed, the heading mandatory, either optional line
 * omittable. A parser that meets a `$$` asks one question — is the next line a
 * heading? — and if the answer is no it does nothing at all. That is what makes
 * the syntax safe to enable by default, and it is also what keeps the overlap
 * with LaTeX display math narrow: a `$$` math fence is followed by a formula,
 * never by an `##`.
 *
 * `^^` is an accepted alias for `$$` from day one. If display math ever lands,
 * `$$` can be deprecated for eyebrows without a content migration, because
 * documents authored with `^^` are already safe.
 *
 * The eyebrow and subheading are `<p>`, never headings. That is the
 * accessibility guidance for `hgroup` — secondary content stays paragraph-level
 * so it never enters the document outline — and it is also what keeps this
 * feature from putting phantom sections in `tree.data.headings`.
 *
 * This plugin owns *all* eyebrow knowledge, including stamping `eyebrow` onto
 * the outline entries `remarkLfmHeadingIds` built — which is why it runs after that
 * plugin rather than before, and why the anchor plugin stays a generic concern
 * with no LFM syntax in it.
 *
 * Deliberately dependency-free, matching the convention in lfm-og-fetcher.ts and
 * remark-lfm-wikilinks.ts.
 */

import type { Root, Heading, Paragraph, PhrasingContent } from 'mdast';
import type { Plugin } from 'unified';
import type { HeadingBlockData, LfmHeading } from '../types/index.js';

/**
 * Markers that open an eyebrow line.
 *
 * `$$` is the documented primary and `^^` the alias. `$` alone was rejected:
 * a single leading `$` is extremely common in the prose these sites publish
 * ("$2M ARR", "$4.40 per million") and would misfire constantly. `%%` was
 * rejected as worse than the math collision — it silently swallows content in
 * an Obsidian vault.
 */
export const EYEBROW_MARKERS = ['$$', '^^'] as const;

/** Marker that opens a subheading line. No meaningful collision. */
export const SUBHEADING_MARKER = '&&';

/** Directive name of the emitted block. Renders as `<hgroup>`. */
export const HEADING_BLOCK_NAME = 'heading-block';

/**
 * Class contract. These names are public API: LFM ships no CSS, so the classes
 * are the only thing a consumer can style against.
 *
 * Each part carries two classes. The `heading-block-*` one is scoped to the
 * block, which is what lets `.heading-block .eyebrow` outrank a site's own
 * `.prose p` — the bare class alone loses that specificity contest on every
 * hand-rolled prose system. The unscoped `eyebrow` / `subheading` is deliberate
 * reuse: every card component in the house already styles those, the editorial
 * role is identical, and inheriting the look by default is the right start.
 */
const BLOCK_CLASS = 'heading-block';
const EYEBROW_CLASS = 'heading-block-eyebrow eyebrow';
const SUBHEADING_CLASS = 'heading-block-subheading subheading';

/** Escape a literal for use inside a RegExp. Markers are `$$`/`^^`/`&&`. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Collect the visible text of an inline run, markup stripped.
 *
 * Mirrors remark-lfm-heading-ids' extractText rather than importing it: that one is
 * private to the anchor plugin, and the two would drift apart for good reasons
 * (this one has no stake in what a slug looks like).
 */
function plainText(nodes: PhrasingContent[]): string {
  let out = '';
  for (const node of nodes as any[]) {
    if (typeof node.value === 'string' && (
      node.type === 'text' || node.type === 'inlineCode' ||
      node.type === 'html' || node.type === 'textDirective'
    )) {
      out += node.value;
    } else if (Array.isArray(node.children)) {
      out += plainText(node.children as PhrasingContent[]);
    }
  }
  return out;
}

/**
 * Split a paragraph's inline children into source lines.
 *
 * A soft break arrives as a `\n` inside a text node's value; a hard break is
 * its own `break` node. Both end a line. Inline markup spanning the split is
 * preserved because only text nodes are cut.
 *
 * Positions are dropped on the halves of a cut text node rather than copied:
 * a stale position that claims to cover both lines is worse than none, since
 * the adjacency test below reads positions.
 */
function splitInlineLines(children: PhrasingContent[]): PhrasingContent[][] {
  const lines: PhrasingContent[][] = [[]];
  const push = (node: PhrasingContent) => lines[lines.length - 1]!.push(node);

  for (const child of children as any[]) {
    if (child.type === 'break') {
      lines.push([]);
      continue;
    }
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('\n')) {
      const parts: string[] = child.value.split('\n');
      parts.forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part.length > 0) push({ type: 'text', value: part } as PhrasingContent);
      });
      continue;
    }
    push(child as PhrasingContent);
  }

  return lines.filter((line) => line.length > 0);
}

/**
 * Strip a leading marker from a line, or return `null` if it carries none.
 *
 * The marker must be followed by whitespace and by something other than
 * whitespace — a bare `$$` on its own line is not an eyebrow, it is a `$$`.
 */
function stripMarker(
  line: PhrasingContent[],
  markers: readonly string[],
): PhrasingContent[] | null {
  const first = line[0] as any;
  if (!first || first.type !== 'text' || typeof first.value !== 'string') return null;

  for (const marker of markers) {
    const match = new RegExp(`^\\s*${escapeRegExp(marker)}\\s+`).exec(first.value);
    if (!match) continue;

    const remainder = first.value.slice(match[0].length);
    const rest = line.slice(1);
    if (remainder.length > 0) {
      rest.unshift({ type: 'text', value: remainder } as PhrasingContent);
    }
    // `$$ ` followed by nothing — or by only markup that renders empty — has no
    // text to be an eyebrow. Leave it alone.
    return plainText(rest).trim().length > 0 ? rest : null;
  }
  return null;
}

/**
 * True when `below` starts on the line right after `above` ends.
 *
 * This is the whole adjacency rule, and it cannot be answered from node order:
 * `$$ Eyebrow\n## Heading` and `$$ Eyebrow\n\n## Heading` produce the *same*
 * sibling pair in MDAST, because an ATX heading interrupts a paragraph either
 * way. Only positions tell them apart.
 *
 * Returns false when either position is missing — a synthesized node cannot
 * prove contiguity, and binding on a guess would swallow ordinary text.
 */
function isAdjacent(above: any, below: any): boolean {
  const end = above?.position?.end?.line;
  const start = below?.position?.start?.line;
  if (typeof end !== 'number' || typeof start !== 'number') return false;
  return start === end + 1;
}

/** Wrap an inline run as a `<p>` carrying one of the block's classes. */
function styledParagraph(children: PhrasingContent[], className: string): Paragraph {
  return {
    type: 'paragraph',
    children,
    data: { hName: 'p', hProperties: { class: className } },
  } as Paragraph;
}

/**
 * Pull the eyebrow off the paragraph directly above a heading.
 *
 * Only the *last* line of that paragraph can be the eyebrow, since only it is
 * adjacent to the heading. Any lines before it stay behind as an ordinary
 * paragraph — the marker binds a line, not a block.
 */
function takeEyebrow(paragraph: Paragraph): {
  eyebrow: PhrasingContent[];
  leftover: Paragraph | null;
} | null {
  const lines = splitInlineLines(paragraph.children);
  if (lines.length === 0) return null;

  const eyebrow = stripMarker(lines[lines.length - 1]!, EYEBROW_MARKERS);
  if (!eyebrow) return null;

  const before = lines.slice(0, -1);
  return {
    eyebrow,
    leftover: before.length > 0 ? joinLines(before) : null,
  };
}

/**
 * Pull the subheading lines off the paragraph directly below a heading.
 *
 * Takes the leading run of `&&` lines — consecutive markers each become their
 * own `<p>`, which `hgroup` permits — and leaves the remainder as an ordinary
 * paragraph after the block.
 */
function takeSubheadings(paragraph: Paragraph): {
  subheadings: PhrasingContent[][];
  leftover: Paragraph | null;
} | null {
  const lines = splitInlineLines(paragraph.children);
  const subheadings: PhrasingContent[][] = [];

  let i = 0;
  for (; i < lines.length; i++) {
    const stripped = stripMarker(lines[i]!, [SUBHEADING_MARKER]);
    if (!stripped) break;
    subheadings.push(stripped);
  }
  if (subheadings.length === 0) return null;

  const after = lines.slice(i);
  return {
    subheadings,
    leftover: after.length > 0 ? joinLines(after) : null,
  };
}

/** Rebuild a paragraph from lines, restoring the soft breaks between them. */
function joinLines(lines: PhrasingContent[][]): Paragraph {
  const children: PhrasingContent[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push({ type: 'text', value: '\n' } as PhrasingContent);
    children.push(...line);
  });
  return { type: 'paragraph', children } as Paragraph;
}

/**
 * Rewrite one container's children, wrapping every heading that has an eyebrow
 * or a subheading bound to it.
 *
 * Recurses first so nested containers (a callout body, a `:::details`) are
 * transformed before this level is rebuilt, and so index arithmetic here only
 * ever concerns this level's array.
 */
function transformChildren(parent: any): void {
  if (!parent || !Array.isArray(parent.children)) return;

  for (const child of parent.children) {
    if (Array.isArray(child?.children)) transformChildren(child);
  }

  const source: any[] = parent.children;
  const out: any[] = [];

  for (let i = 0; i < source.length; i++) {
    const node = source[i];

    if (node?.type !== 'heading') {
      out.push(node);
      continue;
    }

    // Eyebrow: the paragraph already emitted just before this heading.
    let eyebrow: PhrasingContent[] | null = null;
    const previous = out[out.length - 1];
    if (previous?.type === 'paragraph' && isAdjacent(previous, node)) {
      const taken = takeEyebrow(previous as Paragraph);
      if (taken) {
        eyebrow = taken.eyebrow;
        // Replace the source paragraph with whatever survived the take.
        out.pop();
        if (taken.leftover) out.push(taken.leftover);
      }
    }

    // Subheading: the paragraph immediately following, not yet visited.
    let subheadings: PhrasingContent[][] = [];
    let trailing: Paragraph | null = null;
    const next = source[i + 1];
    if (next?.type === 'paragraph' && isAdjacent(node, next)) {
      const taken = takeSubheadings(next as Paragraph);
      if (taken) {
        subheadings = taken.subheadings;
        trailing = taken.leftover;
        i++; // consumed
      }
    }

    if (!eyebrow && subheadings.length === 0) {
      out.push(node);
      continue;
    }

    const eyebrowText = eyebrow ? plainText(eyebrow).trim() : undefined;
    const headingBlock: HeadingBlockData = {
      subheadings: subheadings.map((line) => plainText(line).trim()),
    };
    if (eyebrowText) headingBlock.eyebrow = eyebrowText;

    // Stamp the heading itself so the outline back-fill below can find it by
    // id without re-deriving anything.
    if (eyebrowText) {
      const headingData: any = ((node as Heading).data ??= {});
      headingData.eyebrow = eyebrowText;
    }

    out.push({
      type: 'containerDirective',
      name: HEADING_BLOCK_NAME,
      attributes: {},
      children: [
        ...(eyebrow ? [styledParagraph(eyebrow, EYEBROW_CLASS)] : []),
        node,
        ...subheadings.map((line) => styledParagraph(line, SUBHEADING_CLASS)),
      ],
      data: {
        hName: 'hgroup',
        hProperties: { class: BLOCK_CLASS },
        headingBlock,
      },
    });

    if (trailing) out.push(trailing);
  }

  parent.children = out;
}

/**
 * Bind `$$` eyebrow and `&&` subheading lines to their adjacent heading.
 *
 * Runs *after* lfmHeadingIds in the preset, for two reasons. The anchor plugin
 * must compute ids from the document as authored, and — less obviously — the
 * `<hgroup>` it emits is a containerDirective, so running first would make every
 * eyebrow heading look nested and `inContainer` would filter the whole document
 * out of its own table of contents.
 *
 * @example
 * ```ts
 * const tree = await parseMarkdown('$$ Ops\n## Filing\n&& Two passes');
 * // tree.children[0] is a `heading-block` rendering as <hgroup>
 * // tree.data.headings[0].eyebrow === 'Ops'
 * ```
 */
export const lfmHeadingBlocks: Plugin<[], Root> = function () {
  return (tree: Root) => {
    transformChildren(tree);

    // Back-fill the outline remarkLfmHeadingIds already built. Skipped silently
    // when headingIds is disabled — the block still renders, it just isn't
    // described anywhere for a ToC to read.
    const outline: LfmHeading[] | undefined = (tree as any).data?.headings;
    if (!Array.isArray(outline) || outline.length === 0) return;

    const byId = new Map<string, string>();
    collectEyebrows(tree, byId);
    if (byId.size === 0) return;

    for (const entry of outline) {
      const eyebrow = byId.get(entry.id);
      if (eyebrow) entry.eyebrow = eyebrow;
    }
  };
};

/** Map every stamped heading's anchor id to its eyebrow text. */
function collectEyebrows(node: any, into: Map<string, string>): void {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child?.type === 'heading' && child.data?.eyebrow && child.data?.id) {
      into.set(child.data.id, child.data.eyebrow);
    }
    collectEyebrows(child, into);
  }
}
