/**
 * remark-callouts: Transforms Obsidian-style callouts into directive nodes.
 *
 * Converts:
 *   > [!warning] Watch out
 *   > This is important.
 *
 * Into a containerDirective node with name "callout" and attributes { type: "warning", title: "Watch out" }
 * so the downstream renderer (AstroMarkdown) handles them identically to :::callout{type="warning"}.
 */

import type { Root, Blockquote, Paragraph, Text } from 'mdast';
import type { Plugin } from 'unified';

// Matches the title line of a callout: `[!type]` optionally followed by `-`
// (Obsidian's foldable / "no header" indicator) and optional title text.
//   match[1] = type (lowercased downstream)
//   match[2] = '-' if foldable, else undefined
//   match[3] = title text (may be empty)
const CALLOUT_REGEX = /^\[!(\w+)\](-)?\s*(.*)?$/;

/**
 * Remark plugin that transforms Obsidian-style callouts (`> [!type] Title`)
 * into `containerDirective` nodes with `name: 'callout'`.
 *
 * This normalizes Obsidian callout syntax so that downstream renderers handle
 * both `> [!warning]` and `:::callout{type="warning"}` identically.
 *
 * @example
 * ```ts
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import { remarkCallouts } from '@lossless-group/lfm';
 *
 * const processor = unified().use(remarkParse).use(remarkCallouts);
 * ```
 */
export const remarkCallouts: Plugin<[], Root> = function () {
  return (tree: Root) => {
    visitBlockquotes(tree);
  };
};

function visitBlockquotes(node: any): void {
  if (!node.children) return;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];

    if (child.type === 'blockquote') {
      const transformed = tryTransformCallout(child);
      if (transformed) {
        node.children[i] = transformed;
        continue;
      }
    }

    // Recurse into children
    visitBlockquotes(child);
  }
}

function tryTransformCallout(blockquote: Blockquote): any | null {
  const firstChild = blockquote.children[0];
  if (!firstChild || firstChild.type !== 'paragraph') return null;

  const paragraph = firstChild as Paragraph;
  const firstInline = paragraph.children[0];
  if (!firstInline || firstInline.type !== 'text') return null;

  const text = firstInline as Text;

  // CommonMark folds the title line and any soft-wrapped body lines into a
  // single text node separated by `\n`. Match only against line 1 so the
  // regex doesn't fail on multi-line callouts. Body lines (post-`\n`) flow
  // into the callout's first paragraph below.
  const newlineIdx = text.value.indexOf('\n');
  const firstLine = newlineIdx === -1 ? text.value : text.value.slice(0, newlineIdx);
  const restOfFirstText = newlineIdx === -1 ? '' : text.value.slice(newlineIdx + 1);

  const match = firstLine.match(CALLOUT_REGEX);
  if (!match) return null;

  const calloutType = match[1].toLowerCase();
  const isFoldable = match[2] === '-';
  const titleText = match[3]?.trim() ?? '';
  // Foldable `[!type]-` with no title => explicit empty title (suppresses
  // header). Plain `[!type]` with no title => omit attribute (renderer uses
  // default label). Non-empty title => pass through.
  const title = isFoldable && titleText === '' ? '' : (titleText || undefined);

  // Build the callout body: remaining inline (after the first text node) plus
  // any body content the first text node carried after its first newline,
  // plus subsequent block-level children of the blockquote.
  const remainingInline = paragraph.children.slice(1);
  const remainingBlocks = blockquote.children.slice(1);

  const calloutChildren: any[] = [];
  const firstParagraphInline: any[] = [];

  if (restOfFirstText.length > 0) {
    firstParagraphInline.push({ type: 'text', value: restOfFirstText });
  }
  firstParagraphInline.push(...remainingInline);

  if (firstParagraphInline.length > 0) {
    // Strip leading newline if the next inline starts with one (e.g. when
    // remark-parse split the title and body across separate text nodes).
    const first = firstParagraphInline[0];
    if (first.type === 'text' && first.value.startsWith('\n')) {
      firstParagraphInline[0] = { ...first, value: first.value.slice(1) };
    }
    calloutChildren.push({
      type: 'paragraph',
      children: firstParagraphInline,
    });
  }

  calloutChildren.push(...remainingBlocks);

  return {
    type: 'containerDirective',
    name: 'callout',
    attributes: {
      type: calloutType,
      // Pass through empty-string title for foldable `[!type]-` so the
      // renderer can distinguish "explicit no header" from "use default label".
      ...(title !== undefined ? { title } : {}),
    },
    children: calloutChildren,
    data: {
      hName: 'div',
      hProperties: { class: `callout callout-${calloutType}` },
    },
  };
}
