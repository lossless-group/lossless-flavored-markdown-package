/**
 * remark-lfm-heading-ids: Assigns a stable, unique anchor id to every heading and
 * attaches a document outline to the tree.
 *
 * A fragment URL is a public contract. Before this plugin each site computed
 * heading ids itself, and they disagreed — `lossless-monorepo/site` kept
 * underscores and trimmed stray dashes, every astro-knots site stripped
 * underscores and trimmed neither, so the same heading produced different
 * anchors depending on which site rendered it. Nothing deduped collisions, so
 * two headings with the same text produced two elements with the same id and
 * the second was unreachable.
 *
 * Stamps on each `heading` node:
 *   data.id           final, deduped anchor id
 *   data.hProperties  { id } — so anything that does reach rehype behaves
 *   data.headingText  plain text, markup stripped (button labels, ToC)
 *
 * Attaches to the tree:
 *   data.headings     ordered outline, ready to render a table of contents
 *
 * Each outline entry records `inContainer` when the heading sits inside a
 * callout, `:::details`, blockquote or list item. Every such heading still gets
 * an anchor — a share link into a callout is a link like any other — but a
 * table of contents usually shouldn't list it as a waypoint, and until this
 * field existed the outline gave a consumer no way to tell.
 *
 * `nestHeadings` and `filterHeadings` ship alongside for the same reason
 * `slugifyHeading` does: consumers need the algorithm, not just the output.
 *
 * The renderer decides what a heading *looks* like and whether it carries a
 * share affordance; this plugin only decides what it is called. Same seam as
 * remark-lfm-citations, which computes citation indices and leaves presentation
 * to each site's Sources component.
 *
 * Deliberately dependency-free: the walker and text extraction are hand-rolled
 * rather than pulling `unist-util-visit` / `mdast-util-to-string`, matching the
 * convention set in lfm-og-fetcher.ts and remark-lfm-wikilinks.ts.
 */

import type { Root, Heading } from 'mdast';
import type { Plugin } from 'unified';
import type { LfmHeading, LfmHeadingNode, RemarkHeadingIdsOptions } from '../types/index.js';

/**
 * The default heading slugifier.
 *
 * Intentionally identical to `lossless-monorepo/site`'s `slugify`, including
 * its quirks — trailing-extension stripping and the 3+ dash collapse that
 * preserves deliberate `--` separators. Matching it exactly is what keeps
 * already-shared links landing. Do not "clean this up" without reading
 * context-v/Maintain-Heading-Anchors-and-Share-Links.md first.
 */
export function slugifyHeading(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')     // trailing file extension: `tsconfig.json` -> `tsconfig`
    .replace(/[^a-z0-9\s\-_]/g, '')  // keep underscores — astro-knots dropped them
    .replace(/\s+/g, '-')
    .replace(/-{3,}/g, '--')         // collapse 3+, preserving intentional `--`
    .replace(/^-+|-+$/g, '');
}

/**
 * Recursively collect the visible text of a node's children.
 *
 * Handles the inline types that actually appear in headings: text, inlineCode,
 * raw html, and any node with children (emphasis, strong, link, delete).
 */
function extractText(node: any): string {
  if (!node) return '';
  if (typeof node.value === 'string' && (
    node.type === 'text' || node.type === 'inlineCode' ||
    node.type === 'html' || node.type === 'textDirective'
  )) {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }
  return '';
}

/**
 * Container node types that wrap a heading without making it *nested* in any
 * sense a reader would recognize.
 *
 * `heading-block` is the `<hgroup>` emitted by `lfmHeadingBlocks` — it exists
 * to group an eyebrow and subheading around a heading, not to bury it. Under
 * the normal preset order this plugin runs first and never sees one; the guard
 * is here for consumers who wire the two plugins by hand in the other order,
 * where the alternative is every eyebrow heading silently vanishing from their
 * table of contents.
 */
const TRANSPARENT_CONTAINERS = new Set(['heading-block']);

/** The container label for a node, or `undefined` if it doesn't enclose. */
function containerNameOf(node: any): string | undefined {
  if (node.type === 'containerDirective') {
    const name = typeof node.name === 'string' ? node.name : 'directive';
    return TRANSPARENT_CONTAINERS.has(name) ? undefined : name;
  }
  if (node.type === 'blockquote') return 'blockquote';
  if (node.type === 'listItem') return 'listItem';
  return undefined;
}

/**
 * Walk every `heading` node in document order. Hand-rolled; see module note.
 *
 * `container` carries the name of the nearest enclosing container as the walk
 * descends, so the innermost one wins.
 */
function eachHeading(
  node: any,
  fn: (h: Heading, container?: string) => void,
  container?: string,
): void {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child.type === 'heading') fn(child as Heading, container);
    // Recurse regardless — headings nest inside blockquotes, list items and
    // container directives (a `> [!info]` body can hold an `###`).
    eachHeading(child, fn, containerNameOf(child) ?? container);
  }
}

/**
 * Fold the flat outline into a tree.
 *
 * Pure — no framework, no DOM. Every consumer rendering a nested table of
 * contents writes this fold as its first act, and it has enough edge cases
 * (a document that opens at `h3`, a jump from `h2` straight to `h4`, a
 * trailing `h6`) that each would get them wrong independently.
 *
 * Depth gaps are not filled with placeholder nodes: an `h4` under an `h2`
 * becomes a direct child. Inventing an empty `h3` would put a waypoint in the
 * ToC that has no anchor to point at.
 *
 * @example
 * ```ts
 * const outline = (tree as any).data?.headings ?? [];
 * const toc = nestHeadings(filterHeadings(outline));
 * ```
 */
export function nestHeadings(headings: LfmHeading[]): LfmHeadingNode[] {
  const roots: LfmHeadingNode[] = [];
  const stack: LfmHeadingNode[] = [];

  for (const heading of headings) {
    const node: LfmHeadingNode = { ...heading, children: [] };
    // Pop until the top of the stack is strictly shallower than this heading.
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= node.depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  }

  return roots;
}

/**
 * Apply a depth band and drop `synthetic` entries. The other fold every
 * consumer writes.
 *
 * `synthetic` headings slugified to nothing, so they carry no label worth
 * showing — but their anchors are untouched, and a share link to one still
 * works. This only decides what a ToC *lists*.
 *
 * The `h2`–`h3` default is the common answer, not a rule; pass your own band.
 * Deliberately a helper rather than a plugin option: trimming the outline at
 * source would make it disagree with the anchors actually in the document.
 */
export function filterHeadings(
  headings: LfmHeading[],
  minDepth = 2,
  maxDepth = 3,
): LfmHeading[] {
  return headings.filter(
    (h) => !h.synthetic && h.depth >= minDepth && h.depth <= maxDepth,
  );
}

/**
 * Remark plugin assigning unique anchor ids to headings and building an outline.
 *
 * @example
 * ```ts
 * const tree = await parseMarkdown(md);
 * const outline = (tree as any).data?.headings ?? [];
 * // each heading node carries node.data.id
 * ```
 */
export const remarkLfmHeadingIds: Plugin<[RemarkHeadingIdsOptions?], Root> = function (
  options?: RemarkHeadingIdsOptions,
) {
  const slugify = options?.slugify ?? slugifyHeading;
  const dedupe = options?.dedupe !== false;
  const syntheticPrefix = options?.syntheticPrefix ?? 'heading';

  return (tree: Root) => {
    // Count of ids issued per base slug, so the second `#view-logs` becomes
    // `view-logs-2` rather than silently shadowing the first.
    const seen = new Map<string, number>();
    const headings: LfmHeading[] = [];
    let index = 0;

    eachHeading(tree, (node, container) => {
      index++;
      const text = extractText(node).trim();
      const base = slugify(text);

      // A heading of only symbols — or in a script outside [a-z0-9] — slugifies
      // to ''. An empty id is invalid HTML and every such heading would collide
      // with every other. Fall back to a positional id: ugly, but valid, unique
      // and stable as long as heading order doesn't change.
      const synthetic = base.length === 0;
      const seedId = synthetic ? `${syntheticPrefix}-${index}` : base;

      let id = seedId;
      let duplicateOf: string | undefined;
      if (dedupe) {
        const priorCount = seen.get(seedId) ?? 0;
        if (priorCount > 0) {
          duplicateOf = seedId;
          id = `${seedId}-${priorCount + 1}`;
        }
        seen.set(seedId, priorCount + 1);
      }

      const data: any = (node.data ??= {});
      data.id = id;
      data.headingText = text;
      data.hProperties = { ...(data.hProperties ?? {}), id };

      const entry: LfmHeading = {
        id,
        text,
        depth: node.depth as LfmHeading['depth'],
      };
      if (duplicateOf) entry.duplicateOf = duplicateOf;
      if (synthetic) entry.synthetic = true;
      if (container) entry.inContainer = container;
      headings.push(entry);
    });

    const treeData: any = ((tree as any).data ??= {});
    treeData.headings = headings;
  };
};

/**
 * @deprecated Renamed to `remarkLfmHeadingIds` in 0.5.0. The `remark-*` prefix is reserved for
 * plugins authored outside LFM; everything in this package is ours. This alias
 * is permanent-until-a-major and costs nothing — keep using it if you like, or
 * switch at your leisure.
 */
export const remarkHeadingIds = remarkLfmHeadingIds;
