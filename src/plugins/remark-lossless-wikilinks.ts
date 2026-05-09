/**
 * remarkLosslessWikilinks — site-resolved Obsidian wikilink plugin.
 *
 * Walks every `text` MDAST node and replaces Obsidian-style wikilinks
 * (`[[Page]]`, `[[Page|Display]]`, `[[Page#Section|Display]]`,
 * `[[folder/Page#Section|Display]]`) with standard `link` MDAST nodes
 * resolved against a site-supplied resolver function. Wikilinks inside
 * code fences, inline code, and HTML are left untouched (they're not
 * `text` nodes).
 *
 * Resolution policy is deliberately delegated to the consumer:
 *
 *   - The plugin owns syntax: regex parsing, MDAST splice, link node shape.
 *   - The site owns destinations: which prefix routes where, what's local
 *     vs external, what's intentionally parked.
 *
 * Why this split: wikilink destinations are inherently per-site. The same
 * `[[Vocabulary/Polyrepo]]` resolves to `lossless.group/more-about/polyrepo`
 * from one site and `cilantro-site/glossary/polyrepo` from another. Baking
 * a default resolver into the package would be wrong for every consumer
 * except the one we picked.
 *
 * Unresolved wikilinks (resolver returns `null`) render as **plain text**
 * — just the display string, no anchor, no class, no markup hint that
 * anything was ever a wikilink. Rationale: supporting 40% of intended
 * wikilinks is better than supporting none, and a published page
 * shouldn't punish readers for an incomplete config. The optional
 * `onUnresolved` callback gives sites a hook to log unresolved paths
 * for offline triage (typically into an audit report).
 */

import type { Root, Link } from 'mdast';
import type { Plugin } from 'unified';
import type { WikilinkOptions, WikilinkResolverInput } from '../types/index.js';

// Group 1: path. Group 2: optional #anchor. Group 3: optional |display.
// `[\w-]+` accepts hyphenated path segments matching the same broadening
// applied to remarkCallouts in 0.2.3. Multi-line `[[...]]` constructs aren't
// supported (Obsidian doesn't write them; remark text nodes don't span them).
const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

/**
 * Default display when the wikilink omits `|Display`. Last `/`-separated
 * segment, with `.md` stripped and hyphens turned to spaces. Original
 * casing preserved.
 *
 *   `[[Vocabulary/Build Systems]]`     → "Build Systems"
 *   `[[concepts/naming-conventions]]`  → "naming conventions"
 *   `[[/Users/.../Foo.md]]`            → "Foo"
 */
function lastSegment(path: string): string {
  const idx = path.lastIndexOf('/');
  const seg = idx === -1 ? path : path.slice(idx + 1);
  return seg.replace(/\.md$/i, '').replace(/-/g, ' ');
}

/**
 * Anchor slugifier: lowercase, spaces → hyphens. Matches the default
 * heading-id rule downstream renderers use, so `[[Page#Section Heading]]`
 * arrives at `<a href="/page#section-heading">`.
 */
function slugifyAnchor(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * remarkLosslessWikilinks — Obsidian wikilink resolver.
 *
 * @example Standalone use
 * ```ts
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import { remarkLosslessWikilinks } from '@lossless-group/lfm';
 *
 * const processor = unified()
 *   .use(remarkParse)
 *   .use(remarkLosslessWikilinks, {
 *     resolver: (input) => {
 *       if (input.path.toLowerCase().startsWith('vocabulary/')) {
 *         const slug = input.path
 *           .slice('vocabulary/'.length)
 *           .toLowerCase()
 *           .replace(/\s+/g, '-');
 *         return {
 *           url: `https://www.lossless.group/more-about/${slug}`,
 *           isLocal: false,
 *           display: input.display ?? input.path.split('/').pop() ?? '',
 *         };
 *       }
 *       return null;  // unresolved — renders as plain text
 *     },
 *   });
 * ```
 *
 * @example With remarkLfm
 * ```ts
 * import { remarkLfm } from '@lossless-group/lfm';
 *
 * processor.use(remarkLfm, {
 *   wikilinks: { resolver: mySiteResolver },
 * });
 * ```
 */
export const remarkLosslessWikilinks: Plugin<[WikilinkOptions], Root> = function (options) {
  if (!options || typeof options.resolver !== 'function') {
    throw new Error(
      'remarkLosslessWikilinks: a `resolver` function is required. ' +
      'See https://jsr.io/@lossless-group/lfm for the resolver contract.'
    );
  }

  const { resolver, onUnresolved } = options;

  return function transformer(tree: Root) {
    // Hand-rolled walker — matches the convention in remark-callouts.ts and
    // og-fetcher.ts of avoiding the `unist-util-visit` dependency. Walks
    // every node, but only acts on `text` nodes whose value contains the
    // wikilink pattern. Splices replacement nodes in-place.
    walk(tree as any);

    function walk(node: any): void {
      if (!node || !Array.isArray(node.children)) return;
      // Iterate the children list manually so we can splice safely. Track
      // i with the loop variable; after a splice that inserts N nodes in
      // place of 1, we advance by N to skip past the freshly-inserted
      // content (no risk of re-matching since the new text segments don't
      // contain wikilink syntax — already extracted).
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (!child) continue;

        if (child.type === 'text' && typeof child.value === 'string') {
          const replacement = transformTextNode(child.value);
          if (replacement) {
            node.children.splice(i, 1, ...replacement);
            i += replacement.length - 1;
          }
        } else if (Array.isArray(child.children)) {
          // Recurse into anything that has children EXCEPT code blocks
          // and inline code — wikilinks inside those should stay literal.
          // (`code` and `inlineCode` MDAST nodes don't have a `children`
          // array, so this is mostly defensive — the `Array.isArray`
          // check already filters them.)
          walk(child);
        }
      }
    }

    function transformTextNode(value: string): any[] | null {
      const matches = Array.from(value.matchAll(WIKILINK_RE));
      if (matches.length === 0) return null;

      const newNodes: any[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [full, rawPath, anchorRaw, displayRaw] = match;
        const startIndex = match.index!;

        // Carry over any prose between the previous match and this one.
        if (startIndex > lastIndex) {
          newNodes.push({ type: 'text', value: value.slice(lastIndex, startIndex) });
        }

        const path = rawPath.trim();
        const anchor = anchorRaw?.trim() ?? null;
        const display = displayRaw?.trim() ?? null;

        const input: WikilinkResolverInput = {
          path,
          anchor,
          display,
          raw: full,
        };

        const resolution = resolver(input);

        if (resolution) {
          const anchorPart = anchor ? `#${slugifyAnchor(anchor)}` : '';
          const baseClass = resolution.isLocal ? 'wikilink wikilink--local' : 'wikilink wikilink--external';
          const extraClasses = resolution.classes?.length ? ' ' + resolution.classes.join(' ') : '';

          const linkNode: Link = {
            type: 'link',
            url: resolution.url + anchorPart,
            title: null,
            children: [{ type: 'text', value: resolution.display }],
            data: {
              hProperties: {
                class: baseClass + extraClasses,
                ...(resolution.isLocal
                  ? {}
                  : { target: '_blank', rel: 'noopener noreferrer' }),
              },
            },
          };
          newNodes.push(linkNode);
        } else {
          // Unresolved — emit plain text (display fallback per the
          // documented operating principle). No anchor, no class.
          if (onUnresolved) {
            try { onUnresolved(input); } catch { /* logging must not break parsing */ }
          }
          const fallback = display || lastSegment(path);
          newNodes.push({ type: 'text', value: fallback });
        }

        lastIndex = startIndex + full.length;
      }

      // Trailing prose after the last match.
      if (lastIndex < value.length) {
        newNodes.push({ type: 'text', value: value.slice(lastIndex) });
      }

      return newNodes;
    }
  };
};
