/**
 * remark-code-fences: routes fenced code blocks to format handlers.
 *
 * The unified way: this plugin ships with an empty registry and knows nothing.
 * You pay for exactly the formats you name.
 *
 *   import { remarkCodeFences, mermaid } from '@lossless-group/lfm';
 *   import { yang } from '@lossless-group/lfm/formats/yang';
 *
 *   unified().use(remarkParse).use(remarkCodeFences, { formats: [mermaid, yang] });
 *
 * A handler is plain data plus an optional pure function, so authoring one
 * takes no coordination with this package — publish it, `.use()` it, done.
 *
 * Two deliberate constraints, both learned from the prototype in
 * lossless-monorepo/site (utils/markdown/remark-jsoncanvas-codeblocks.ts):
 *
 *  1. The `code` node is ANNOTATED, never replaced. That prototype swapped in
 *     an `html` node containing a rendered <div> and a <script>, which means a
 *     renderer that doesn't understand the format gets a blob of foreign HTML
 *     instead of readable source. Here an unrecognized format degrades to a
 *     normal code block, which is the correct floor.
 *
 *  2. Nothing here is nondeterministic. That prototype minted element ids with
 *     Math.random(), so identical markdown produced a different AST on every
 *     build — poison for caching, content hashing and diffing. Any id a
 *     renderer needs, it derives itself at render time.
 *
 * Parsing is the handler's job and is always optional; a handler with no
 * `parse` just claims the language so a renderer can dispatch on it.
 */

import type { Root, Code } from 'mdast';
import type { Plugin } from 'unified';
import type { FenceFormat, FenceData, RemarkCodeFencesOptions } from '../types/index.js';

/** Walk every `code` node. Hand-rolled per the convention in og-fetcher.ts. */
function eachCode(node: any, fn: (c: Code) => void): void {
  if (!node || !Array.isArray(node.children)) return;
  for (const child of node.children) {
    if (child.type === 'code') fn(child as Code);
    // Recurse — fences live inside list items, blockquotes and directives.
    eachCode(child, fn);
  }
}

/**
 * Remark plugin annotating fenced code blocks with a resolved format handler.
 *
 * Stamps `node.data.fence` = `{ format, parsed?, error? }`. Leaves every other
 * fence untouched.
 */
export const remarkCodeFences: Plugin<[RemarkCodeFencesOptions?], Root> = function (
  options?: RemarkCodeFencesOptions,
) {
  const formats = options?.formats ?? [];

  // lang -> handler. Built once per processor, not per node.
  const byLang = new Map<string, FenceFormat>();
  for (const fmt of formats) {
    for (const lang of fmt.match) {
      byLang.set(lang.toLowerCase(), fmt);
    }
  }

  return (tree: Root) => {
    if (byLang.size === 0) return;

    eachCode(tree, (node) => {
      const lang = (node.lang ?? '').toLowerCase().trim();
      if (!lang) return;

      const fmt = byLang.get(lang);
      if (!fmt) return;

      const fence: FenceData = { format: fmt.name };

      if (fmt.parse) {
        try {
          fence.parsed = fmt.parse(node.value);
        } catch (err) {
          // A malformed diagram must not fail a build. Record why and let the
          // renderer fall back to showing the source.
          fence.error = err instanceof Error ? err.message : String(err);
        }
      }

      const data: any = (node.data ??= {});
      data.fence = fence;
    });
  };
};
