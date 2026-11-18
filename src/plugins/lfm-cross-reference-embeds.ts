/**
 * lfm-cross-reference-embeds: Obsidian's `![[Note#Heading]]` — show a section
 * of another document inside this one.
 *
 * Named "cross-reference" embeds, not plain embeds, so they sit beside other
 * kinds (link previews, media) without colliding.
 *
 * Obsidian authors transclude: `![[Google Maps#API policies]]` on its own line
 * puts the "API policies" section of the Google Maps note into the current
 * note, live. This plugin does the same at parse time. It loads the other
 * document through a site-supplied `load` function (LFM never touches the
 * filesystem itself), parses it with the same LFM options, cuts out the
 * section, and puts it in place as one block:
 *
 *   containerDirective  name: 'cross-reference-embed'
 *     attributes  { source, section?, title?, href? }   (strings, for renderers
 *                                                          that read attributes)
 *     data.crossReferenceEmbed  { path, section, display, title, url, status, raw }
 *     children    the section's nodes, starting with its heading
 *
 * The renderer draws it so it reads as part of the page, with a small "from
 * <title>" line and a link that opens the original (`data.crossReferenceEmbed.url`).
 *
 * Syntax, all on a line of their own:
 *   ![[Note]]                          the whole document
 *   ![[Note#Heading]]                  one section
 *   ![[Note#Heading#Subheading]]       a section inside a section
 *   ![[folder/Note#Heading|Label]]     Obsidian's order: label after the pipe
 *   ![[folder/Note|Label#Heading]]     also accepted: the `#` part is the
 *                                      section wherever it sits
 * `![[photo.png]]` and other file embeds (an extension that isn't .md) are
 * left alone for image handling.
 *
 * A section runs from its heading to the next heading of the same or higher
 * level. Headings match case-insensitively, ignoring markup and extra spaces;
 * a heading's slug matches too, so `#api-policies` works.
 *
 * When something can't be found the block is still emitted, empty, with
 * `status` saying why ('missing-document' | 'missing-section' | 'too-deep'),
 * so a renderer can show a quiet note and the link instead of nothing.
 * Embeds inside embedded documents resolve up to `maxDepth` levels (default 2),
 * which also stops a document embedding itself forever.
 *
 * Runs before callouts, citations, heading ids and wikilinks, so the host
 * document's pipeline treats the embedded nodes like its own: their headings
 * get ids and are marked `inContainer: 'cross-reference-embed'`, so a table of contents can
 * list them or leave them out.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import type { LfmCrossReferenceEmbedData, LfmCrossReferenceEmbedOptions, LfmCrossReferenceEmbedSource } from '../types/index.js';

type AnyNode = { type: string; value?: string; depth?: number; children?: AnyNode[]; [k: string]: any };

/** Parses a loaded document. The preset supplies one that runs full LFM. */
export type EmbedParser = (markdown: string, depth: number) => Promise<Root>;

interface InternalOptions extends LfmCrossReferenceEmbedOptions {
  /** @internal Set by the preset so embedded documents get the full pipeline. */
  parseEmbedded?: EmbedParser;
  /** @internal How many embeds deep this document already is. */
  depth?: number;
}

// The whole paragraph must be the embed: `![[ … ]]` and nothing else.
const EMBED_RE = /^!\[\[([^\]]+)\]\]$/;
// File embeds (images, PDFs, audio) stay as they are.
const FILE_EXT_RE = /\.(?!md$)[a-z0-9]{2,5}$/i;

/** `folder/Note#A#B|Label` or `folder/Note|Label#A#B` → its parts. */
export function parseCrossReferenceEmbedTarget(inner: string): { path: string; sections: string[]; display: string | null } {
  const [left, ...rest] = inner.split('|');
  const right = rest.join('|');
  let path = left;
  let display: string | null = right ? right.trim() : null;
  let sections: string[] = [];
  if (left.includes('#')) {
    const [p, ...s] = left.split('#');
    path = p;
    sections = s;
  } else if (right.includes('#')) {
    const [d, ...s] = right.split('#');
    display = d.trim() || null;
    sections = s;
  }
  return { path: path.trim(), sections: sections.map((s) => s.trim()).filter(Boolean), display };
}

const plain = (node: AnyNode): string =>
  node.type === 'text' || node.type === 'inlineCode'
    ? String(node.value ?? '')
    : (node.children ?? []).map(plain).join('');

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const slug = (s: string) =>
  normalize(s).replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-');

const headingMatches = (heading: AnyNode, wanted: string) => {
  const text = plain(heading);
  return normalize(text) === normalize(wanted) || slug(text) === slug(wanted);
};

/** The nodes from a matching heading up to the next heading at its level or above. */
function sectionOf(nodes: AnyNode[], wanted: string): AnyNode[] | null {
  const start = nodes.findIndex((n) => n.type === 'heading' && headingMatches(n, wanted));
  if (start === -1) return null;
  const depth = nodes[start].depth ?? 1;
  let end = start + 1;
  while (end < nodes.length && !(nodes[end].type === 'heading' && (nodes[end].depth ?? 1) <= depth)) end++;
  return nodes.slice(start, end);
}

/** `#A#B`: B inside A's section. */
function findSection(nodes: AnyNode[], sections: string[]): AnyNode[] | null {
  let scope: AnyNode[] | null = nodes;
  for (const wanted of sections) {
    // Search below the previous match's own heading.
    const inner: AnyNode[] = scope === nodes ? scope : scope!.slice(1);
    scope = sectionOf(inner, wanted);
    if (!scope) return null;
  }
  return scope;
}

/** Drop a leading `--- … ---` frontmatter block, returning its `title:` if any. */
function stripFrontmatter(markdown: string): { body: string; title?: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!m) return { body: markdown };
  const title = /^title:\s*["']?(.+?)["']?\s*$/m.exec(m[1])?.[1];
  return { body: markdown.slice(m[0].length), ...(title ? { title } : {}) };
}

const lastSegment = (path: string) => path.split('/').pop()!.replace(/\.md$/i, '');

const defaultParser: EmbedParser = async (markdown) => {
  const processor = unified().use(remarkParse).use(remarkGfm);
  return (await processor.run(processor.parse(markdown))) as Root;
};

/**
 * Embed sections of other documents with Obsidian's `![[Note#Heading]]`.
 */
export const lfmCrossReferenceEmbeds: Plugin<[LfmCrossReferenceEmbedOptions?], Root> = function (options) {
  const opts = (options ?? {}) as InternalOptions;
  if (typeof opts.load !== 'function') {
    throw new Error('lfmCrossReferenceEmbeds: supply `load(path)`, which returns the markdown of the document a `![[…]]` names.');
  }
  const depth = opts.depth ?? 0;
  const maxDepth = opts.maxDepth ?? 2;
  const parse = opts.parseEmbedded ?? defaultParser;

  return async function transformer(tree: Root) {
    const jobs: Promise<void>[] = [];

    const visit = (parent: AnyNode) => {
      const kids = parent.children;
      if (!kids) return;
      kids.forEach((node, i) => {
        if (node.type === 'paragraph' && node.children?.length && node.children.every((c) => c.type === 'text')) {
          const raw = plain(node).trim();
          const m = EMBED_RE.exec(raw);
          if (m) {
            const target = parseCrossReferenceEmbedTarget(m[1]);
            if (target.path && !FILE_EXT_RE.test(target.path)) {
              jobs.push(build(target, raw, node).then((block) => { kids[i] = block; }));
              return;
            }
          }
        }
        visit(node);
      });
    };
    visit(tree as unknown as AnyNode);
    await Promise.all(jobs);
  };

  async function build(
    target: ReturnType<typeof parseCrossReferenceEmbedTarget>,
    raw: string,
    original: AnyNode,
  ): Promise<AnyNode> {
    const sectionLabel = target.sections.join(' › ') || null;
    const input = { path: target.path, section: sectionLabel, sections: target.sections, display: target.display, raw };
    const loaded = depth >= maxDepth ? null : await Promise.resolve(opts.load(input)).catch(() => null);
    const source: LfmCrossReferenceEmbedSource | null =
      loaded == null ? null : typeof loaded === 'string' ? { markdown: loaded } : loaded;

    const front = source ? stripFrontmatter(source.markdown) : { body: '' as string };
    const title = target.display ?? source?.title ?? front.title ?? lastSegment(target.path);
    let status: LfmCrossReferenceEmbedData['status'] = depth >= maxDepth ? 'too-deep' : source ? 'ok' : 'missing-document';
    let children: AnyNode[] = [];

    if (status === 'ok') {
      const doc = (await parse(front.body, depth + 1)) as unknown as AnyNode;
      const section = target.sections.length ? findSection(doc.children ?? [], target.sections) : doc.children ?? [];
      if (section) children = section;
      else status = 'missing-section';
    }

    const url = source?.url ?? opts.url?.(input) ?? undefined;
    if (status !== 'ok') {
      try { opts.onUnresolved?.({ ...input, status }); } catch { /* reporting must not break parsing */ }
    }

    const embed: LfmCrossReferenceEmbedData = {
      path: target.path,
      section: sectionLabel,
      display: target.display,
      title,
      ...(url ? { url } : {}),
      status,
      raw,
    };
    return {
      type: 'containerDirective',
      name: 'cross-reference-embed',
      attributes: {
        source: target.path,
        ...(sectionLabel ? { section: sectionLabel } : {}),
        title,
        ...(url ? { href: url } : {}),
      },
      data: { crossReferenceEmbed: embed },
      children,
      position: original.position,
    };
  }
};
