/**
 * remark-heading-ids: Assigns a stable, unique anchor id to every heading and
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
 * The renderer decides what a heading *looks* like and whether it carries a
 * share affordance; this plugin only decides what it is called. Same seam as
 * remark-citations, which computes citation indices and leaves presentation
 * to each site's Sources component.
 *
 * Deliberately dependency-free: the walker and text extraction are hand-rolled
 * rather than pulling `unist-util-visit` / `mdast-util-to-string`, matching the
 * convention set in og-fetcher.ts and remark-lossless-wikilinks.ts.
 */

import type { Root, Heading } from 'mdast';
import type { Plugin } from 'unified';
import type { LfmHeading, RemarkHeadingIdsOptions } from '../types/index.js';

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

/** Walk every `heading` node in document order. Hand-rolled; see module note. */
function eachHeading(node: any, fn: (h: Heading) => void): void {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child.type === 'heading') fn(child as Heading);
    // Recurse regardless — headings nest inside blockquotes, list items and
    // container directives (a `> [!info]` body can hold an `###`).
    eachHeading(child, fn);
  }
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
export const remarkHeadingIds: Plugin<[RemarkHeadingIdsOptions?], Root> = function (
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

    eachHeading(tree, (node) => {
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
      headings.push(entry);
    });

    const treeData: any = ((tree as any).data ??= {});
    treeData.headings = headings;
  };
};
