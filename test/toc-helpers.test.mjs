/**
 * `nestHeadings` and `filterHeadings`.
 *
 * These ship because every ToC consumer writes them, and the fold has enough
 * edge cases that each consumer would get a different subset wrong. The edge
 * cases are the point of this file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nestHeadings, filterHeadings } from '../dist/index.js';
import { parseMarkdown, outline, md } from './helpers.mjs';

const h = (depth, id) => ({ id, text: id, depth });
const shape = (nodes) => nodes.map((n) => [n.id, shape(n.children)]);

test('a plain outline folds to a tree', () => {
  const tree = nestHeadings([h(2, 'a'), h(3, 'a1'), h(3, 'a2'), h(2, 'b')]);
  assert.deepEqual(shape(tree), [
    ['a', [['a1', []], ['a2', []]]],
    ['b', []],
  ]);
});

test('a document that opens at h3 produces roots, not orphans', () => {
  const tree = nestHeadings([h(3, 'a'), h(3, 'b')]);
  assert.deepEqual(shape(tree), [['a', []], ['b', []]]);
});

test('an h2 → h4 jump nests directly, with no invented placeholder', () => {
  // Inventing an empty h3 would put a waypoint in the ToC with no anchor to
  // point at.
  const tree = nestHeadings([h(2, 'a'), h(4, 'deep')]);
  assert.deepEqual(shape(tree), [['a', [['deep', []]]]]);
});

test('a trailing h6 nests under whatever preceded it', () => {
  const tree = nestHeadings([h(2, 'a'), h(3, 'b'), h(6, 'c')]);
  assert.deepEqual(shape(tree), [['a', [['b', [['c', []]]]]]]);
});

test('depth returning to a shallower level starts a new branch', () => {
  const tree = nestHeadings([h(2, 'a'), h(3, 'b'), h(2, 'c'), h(3, 'd')]);
  assert.deepEqual(shape(tree), [
    ['a', [['b', []]]],
    ['c', [['d', []]]],
  ]);
});

test('a deeper heading after a jump back up attaches correctly', () => {
  const tree = nestHeadings([h(1, 'top'), h(3, 'x'), h(2, 'y'), h(3, 'z')]);
  assert.deepEqual(shape(tree), [['top', [['x', []], ['y', [['z', []]]]]]]);
});

test('fields a consumer added survive the fold', () => {
  const [node] = nestHeadings([{ ...h(2, 'a'), eyebrow: 'Ops', inContainer: 'details' }]);
  assert.equal(node.eyebrow, 'Ops');
  assert.equal(node.inContainer, 'details');
});

test('empty in, empty out', () => {
  assert.deepEqual(nestHeadings([]), []);
});

test('the input array is not mutated', () => {
  const input = [h(2, 'a'), h(3, 'b')];
  const snapshot = JSON.parse(JSON.stringify(input));
  nestHeadings(input);
  assert.deepEqual(input, snapshot);
});

// ── filterHeadings ──────────────────────────────────────────────────────────

const band = [
  h(1, 'title'),
  h(2, 'one'),
  h(3, 'one-a'),
  h(4, 'too-deep'),
  { ...h(2, 'empty'), text: '', synthetic: true },
];

test('the default band is h2–h3', () => {
  assert.deepEqual(filterHeadings(band).map((x) => x.id), ['one', 'one-a']);
});

test('synthetic entries are dropped but keep their anchors elsewhere', async () => {
  const filtered = filterHeadings(band);
  assert.ok(!filtered.some((x) => x.synthetic), 'no usable label to show');

  // The anchor itself is untouched in the outline — only the ToC omits it.
  const tree = await parseMarkdown('## Real\n\n## ***\n');
  const entries = outline(tree);
  assert.equal(entries.length, 2);
  assert.ok(entries[1].id.length > 0);
});

test('a custom band is honoured', () => {
  assert.deepEqual(filterHeadings(band, 1, 4).map((x) => x.id), ['title', 'one', 'one-a', 'too-deep']);
  assert.deepEqual(filterHeadings(band, 3, 3).map((x) => x.id), ['one-a']);
});

test('an impossible band returns nothing rather than throwing', () => {
  assert.deepEqual(filterHeadings(band, 5, 2), []);
});

test('the two helpers compose the way a ToC actually uses them', async () => {
  const tree = await parseMarkdown(md`
    # Title
    ## Why Care?
    ### Detail
    #### Too deep

    > [!note] Aside
    > ### Not a section

    ## What's New?
  `);
  const toc = nestHeadings(
    filterHeadings(outline(tree)).filter((entry) => !entry.inContainer),
  );
  assert.deepEqual(shape(toc), [
    ['why-care', [['detail', []]]],
    ['whats-new', []],
  ]);
});
