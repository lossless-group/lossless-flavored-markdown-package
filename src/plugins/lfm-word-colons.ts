/**
 * lfm-word-colons: `re:Invent` is a word, not a directive.
 *
 * remark-directive reads `:name` anywhere in text as an inline (text)
 * directive, so prose like "AWS re:Invent" or "Note:Important" lost its second
 * half: the renderer saw a `:Invent` directive it didn't know and printed
 * nothing. A real inline directive is written on its own (` :badge[New]`), not
 * glued to the end of a word, and almost always has a label or attributes.
 *
 * So a text directive with no label and no attributes, directly after a letter
 * or digit, goes back to being the text it was. Runs right after directives
 * parse, before anything else looks at directive nodes. Internal to the preset.
 */

import type { Root } from 'mdast';
import type { Plugin } from 'unified';

type AnyNode = { type: string; value?: string; name?: string; attributes?: Record<string, unknown> | null; children?: AnyNode[] };

const isBareWordColon = (node: AnyNode, prev: AnyNode | undefined) =>
  node.type === 'textDirective' &&
  (node.children?.length ?? 0) === 0 &&
  Object.keys(node.attributes ?? {}).length === 0 &&
  prev?.type === 'text' &&
  /[\p{L}\p{N}]$/u.test(prev.value ?? '');

function restore(parent: AnyNode): void {
  const kids = parent.children;
  if (!kids) return;
  const out: AnyNode[] = [];
  for (const node of kids) {
    const prev = out[out.length - 1];
    if (isBareWordColon(node, prev)) {
      prev.value += `:${node.name}`;
      continue;
    }
    // Text that follows a restored colon joins it: "re:Invent" + " as the…"
    if (node.type === 'text' && prev?.type === 'text') {
      prev.value += node.value ?? '';
      continue;
    }
    restore(node);
    out.push(node);
  }
  parent.children = out;
}

export const lfmWordColons: Plugin<[], Root> = function () {
  return (tree: Root) => restore(tree as unknown as AnyNode);
};
