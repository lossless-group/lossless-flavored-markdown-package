/**
 * Obsidian callouts → directive nodes.
 *
 * The polyglot claim in one test file: a `> [!warning]` block and a
 * `:::callout{type="warning"}` block must produce the *same* node, so a
 * consumer's `<Callout>` component renders one shape regardless of which tool
 * wrote the file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, directives, ofType, text, md } from './helpers.mjs';

const callouts = (tree) => directives(tree, 'callout');

test('an Obsidian callout becomes a callout directive', async () => {
  const tree = await parseMarkdown('> [!warning] The category churns\n> Body text here.\n');
  const [callout] = callouts(tree);
  assert.ok(callout, 'no callout emitted');
  assert.equal(callout.type, 'containerDirective');
  assert.equal(callout.attributes.type, 'warning');
  assert.equal(callout.attributes.title, 'The category churns');
});

test('it renders as a div with a type-bearing class', async () => {
  const tree = await parseMarkdown('> [!info] Heads up\n');
  const [callout] = callouts(tree);
  assert.equal(callout.data.hName, 'div');
  assert.equal(callout.data.hProperties.class, 'callout callout-info');
});

test('both authoring syntaxes converge on one node', async () => {
  const obsidian = await parseMarkdown('> [!warning] Title\n> Body.\n');
  const directive = await parseMarkdown(':::callout{type="warning" title="Title"}\nBody.\n:::\n');

  const a = callouts(obsidian)[0];
  const b = callouts(directive)[0];
  assert.equal(a.name, b.name);
  assert.equal(a.attributes.type, b.attributes.type);
  assert.equal(a.attributes.title, b.attributes.title);
});

test('a titleless callout still carries its type', async () => {
  const tree = await parseMarkdown('> [!note]\n> Just a body.\n');
  const [callout] = callouts(tree);
  assert.equal(callout.attributes.type, 'note');
  assert.ok(text(callout).includes('Just a body.'));
});

test('an ordinary blockquote is left alone', async () => {
  const tree = await parseMarkdown('> Just a quotation, not a callout.\n');
  assert.equal(callouts(tree).length, 0);
  assert.equal(ofType(tree, 'blockquote').length, 1);
});

test('body content survives, including block children', async () => {
  const tree = await parseMarkdown(md`
    > [!tip] Try this
    > First paragraph.
    >
    > - one
    > - two
  `);
  const [callout] = callouts(tree);
  assert.ok(text(callout).includes('First paragraph.'));
  assert.equal(ofType(callout, 'listItem').length, 2);
});

test('callouts nest', async () => {
  const tree = await parseMarkdown(md`
    > [!info] Outer
    > > [!warning] Inner
    > > Inner body.
  `);
  const all = callouts(tree);
  assert.equal(all.length, 2);
  assert.deepEqual(all.map((c) => c.attributes.type), ['info', 'warning']);
});

test('callouts can be disabled', async () => {
  const tree = await parseMarkdown('> [!warning] Title\n', { callouts: false });
  assert.equal(callouts(tree).length, 0);
  assert.equal(ofType(tree, 'blockquote').length, 1);
});
