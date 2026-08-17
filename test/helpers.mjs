/**
 * Shared test helpers.
 *
 * Tests import from `../dist/index.js` rather than `../src/`, deliberately:
 * that is the artifact consumers actually receive, so the suite exercises the
 * barrel exports, the tsup entry map, and the type-stripped output all at once.
 * `pnpm test` builds first for exactly this reason.
 */

import { parseMarkdown } from '../dist/index.js';

export { parseMarkdown };

/** Every node in the tree matching `pred`, in document order. */
export function findAll(node, pred, out = []) {
  if (!node || !Array.isArray(node.children)) return out;
  for (const child of node.children) {
    if (pred(child)) out.push(child);
    findAll(child, pred, out);
  }
  return out;
}

/** The first node matching `pred`, or undefined. */
export function find(node, pred) {
  return findAll(node, pred)[0];
}

/** All nodes of a given mdast `type`. */
export function ofType(tree, type) {
  return findAll(tree, (n) => n.type === type);
}

/** All containerDirective nodes with a given directive `name`. */
export function directives(tree, name) {
  return findAll(tree, (n) => n.type === 'containerDirective' && n.name === name);
}

/** Visible text of a node subtree, markup stripped. */
export function text(node) {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  if (!Array.isArray(node.children)) return '';
  return node.children.map(text).join('');
}

/** The outline attached at `tree.data.headings`, or an empty array. */
export function outline(tree) {
  return tree?.data?.headings ?? [];
}

/**
 * Dedent a template literal so test fixtures can be written at the
 * indentation of the code around them. Markdown is whitespace-sensitive and
 * an accidental four-space indent turns a fixture into a code block.
 */
export function md(strings, ...values) {
  const raw = String.raw({ raw: strings }, ...values);
  const lines = raw.replace(/^\n/, '').replace(/\n[ \t]*$/, '\n').split('\n');
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^[ \t]*/)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(cut)).join('\n');
}
