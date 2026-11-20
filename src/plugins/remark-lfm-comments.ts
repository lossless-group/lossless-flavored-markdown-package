/**
 * remark-lfm-comments: Obsidian's `%%private comments%%`, left out of the page.
 *
 * In Obsidian, anything between two `%%` markers is a note to yourself: it
 * shows while editing and disappears when reading. Published without this
 * plugin, those notes went out as text for anyone to read.
 *
 *   Ship on Friday. %%unless legal is still reviewing%%
 *
 *   %%
 *   A whole block, across paragraphs, lists and headings.
 *   %%
 *
 * Works on the tree rather than the source, walking it in document order with
 * one open/closed flag, so a comment can start in one paragraph and end three
 * blocks later. Text is cut at each `%%`; any other node inside a comment is
 * dropped whole. Code is never scanned, so `%%` in a code span or fence is
 * text, as in Obsidian. An unclosed `%%` hides the rest of the document, also
 * as in Obsidian: a note left half-open should stay private, not leak.
 *
 * Runs first in the preset, so nothing downstream (embeds, heading ids, the
 * table of contents, citations) sees what was commented out.
 */

import type { Root } from 'mdast';
import type { Plugin } from 'unified';

type AnyNode = { type: string; value?: string; children?: AnyNode[] };

const MARKER = '%%';

/** Nodes whose content is literal, so a `%%` inside is text, not a marker. */
const LITERAL = new Set(['code', 'inlineCode', 'html', 'math', 'inlineMath', 'yaml', 'toml']);

/** Emptied by a comment, these would render as a bare shell, so they go too. Table cells stay, to keep the grid. */
const KEEP_WHEN_EMPTY = new Set(['root', 'tableCell', 'tableRow', 'table']);

function hasMarker(node: AnyNode): boolean {
  if (LITERAL.has(node.type)) return false;
  if (node.type === 'text') return (node.value ?? '').includes(MARKER);
  return node.children?.some(hasMarker) ?? false;
}

const isBlank = (node: AnyNode) => node.type === 'text' && !(node.value ?? '').trim();

/**
 * Remark plugin that removes Obsidian `%%…%%` comments, inline or spanning
 * blocks. Enabled by default in the preset; pass `comments: false` to keep them.
 */
export const remarkLfmComments: Plugin<[], Root> = function () {
  return (tree: Root) => {
    let open = false;
    // Whether the last visible text ended in whitespace, so the text after a
    // comment doesn't add a second space, even when the comment spans nodes.
    let endsInSpace = true;

    /** Cut the commented parts out of one text value, toggling `open` at each marker. */
    function cut(value: string, startedOpen: boolean): string {
      let out = '';
      let i = 0;
      while (i <= value.length) {
        const at = value.indexOf(MARKER, i);
        const end = at === -1 ? value.length : at;
        if (!open) {
          const piece = value.slice(i, end);
          // "a %%x%% b" reads "a b", not "a  b".
          const afterSpace = out ? /\s$/.test(out) : endsInSpace;
          out += (i > 0 || startedOpen) && afterSpace ? piece.replace(/^[ \t]+/, '') : piece;
        }
        if (at === -1) break;
        open = !open;
        i = at + MARKER.length;
      }
      return out;
    }

    /** Returns true when `parent` lost content to a comment. */
    function walk(parent: AnyNode): boolean {
      const kids = parent.children;
      if (!kids) return false;
      let changed = false;
      const out: AnyNode[] = [];

      for (const node of kids) {
        if (node.type === 'text') {
          const value = node.value ?? '';
          if (!open && !value.includes(MARKER)) {
            out.push(node);
            if (value) endsInSpace = /\s$/.test(value);
            continue;
          }
          const startedOpen = open;
          const next = cut(value, startedOpen);
          changed = true;
          if (next) {
            out.push({ ...node, value: next });
            endsInSpace = /\s$/.test(next);
          }
          continue;
        }

        if (open && !hasMarker(node)) {
          // Entirely inside the comment.
          changed = true;
          continue;
        }

        if (LITERAL.has(node.type) || !node.children) {
          out.push(node);
          continue;
        }

        const hadChildren = node.children.length > 0;
        if (walk(node)) {
          changed = true;
          const left = node.children;
          if (hadChildren && !KEEP_WHEN_EMPTY.has(node.type) && left.every(isBlank)) continue;
        }
        out.push(node);
      }

      parent.children = out;
      return changed;
    }

    walk(tree as AnyNode);
  };
};
