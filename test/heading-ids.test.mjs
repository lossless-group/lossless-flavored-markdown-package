/**
 * Anchor ids and the document outline.
 *
 * A fragment URL is a public contract, so the slugifier's *quirks* are load
 * bearing: it is bug-for-bug identical to `lossless-monorepo/site`'s algorithm,
 * and 646 anchors across astro-knots moved to match it. Tests here pin the
 * quirks deliberately — if one of these fails because someone "cleaned up" the
 * slugifier, published links broke.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugifyHeading } from '../dist/index.js';
import { parseMarkdown, outline, ofType, md } from './helpers.mjs';

test('slugifier preserves the quirks published links depend on', () => {
  assert.equal(slugifyHeading('Hello World'), 'hello-world');
  // underscores survive — astro-knots used to strip them
  assert.equal(slugifyHeading('kauffman_year'), 'kauffman_year');
  // trailing file extension is dropped
  assert.equal(slugifyHeading('tsconfig.json'), 'tsconfig');
  // 3+ dashes collapse to two, preserving a deliberate `--` separator
  assert.equal(slugifyHeading('changelog---2026-04-27-01'), 'changelog--2026-04-27-01');
  // punctuation dropped, leading/trailing dashes trimmed
  assert.equal(slugifyHeading('  Why *Care*?  '), 'why-care');
});

test('every heading gets an id, and the node carries it three ways', async () => {
  const tree = await parseMarkdown('## Why Care?\n');
  const [heading] = ofType(tree, 'heading');
  assert.equal(heading.data.id, 'why-care');
  assert.equal(heading.data.headingText, 'Why Care?');
  assert.equal(heading.data.hProperties.id, 'why-care');
});

test('outline is flat, ordered, and carries depth', async () => {
  const tree = await parseMarkdown(md`
    # Title
    ## One
    ### One A
    ## Two
  `);
  assert.deepEqual(
    outline(tree).map((h) => [h.depth, h.id]),
    [[1, 'title'], [2, 'one'], [3, 'one-a'], [2, 'two']],
  );
});

test('colliding slugs dedupe rather than shadow', async () => {
  const tree = await parseMarkdown('## View logs\n\n## View logs\n\n## View logs\n');
  const entries = outline(tree);
  assert.deepEqual(entries.map((h) => h.id), ['view-logs', 'view-logs-2', 'view-logs-3']);
  assert.equal(entries[0].duplicateOf, undefined);
  assert.equal(entries[1].duplicateOf, 'view-logs');
  assert.equal(entries[2].duplicateOf, 'view-logs');
});

test('a heading that slugifies to nothing gets a positional id, flagged', async () => {
  const tree = await parseMarkdown('## ***\n');
  const [entry] = outline(tree);
  assert.equal(entry.synthetic, true);
  assert.match(entry.id, /^heading-\d+$/);
  assert.notEqual(entry.id, '', 'an empty id is invalid HTML');
});

test('markup is stripped from outline text but the heading keeps it', async () => {
  const tree = await parseMarkdown('## The **bold** `truth`\n');
  const [entry] = outline(tree);
  assert.equal(entry.text, 'The bold truth');
  assert.equal(entry.id, 'the-bold-truth');
  const [heading] = ofType(tree, 'heading');
  assert.ok(heading.children.some((c) => c.type === 'strong'));
});

// ── inContainer ─────────────────────────────────────────────────────────────
// The defect this fixed: a `###` inside a callout was indistinguishable from a
// document section, so any ToC built from the outline offered readers waypoints
// that weren't waypoints.

test('a heading inside a callout is labelled but still anchored', async () => {
  const tree = await parseMarkdown(md`
    ## The field

    > [!warning] The category churns
    > ### What to do about it

    ## How to decide
  `);
  const [first, nested, last] = outline(tree);
  assert.equal(first.inContainer, undefined);
  assert.equal(nested.inContainer, 'callout');
  assert.equal(last.inContainer, undefined);
  assert.ok(nested.id.length > 0, 'a share link into a callout must still land');
});

test('plain nesting is labelled by node type', async () => {
  const list = await parseMarkdown('- item\n  ### Nested\n');
  assert.equal(outline(list)[0].inContainer, 'listItem');

  const quote = await parseMarkdown('> ### Quoted\n');
  assert.equal(outline(quote)[0].inContainer, 'blockquote');
});

test('a container directive is labelled by its own name', async () => {
  const tree = await parseMarkdown(':::details\n### Inside\n:::\n');
  assert.equal(outline(tree)[0].inContainer, 'details');
});

test('innermost container wins', async () => {
  const tree = await parseMarkdown(md`
    :::details
    > [!note] Nested
    > #### Deep
    :::
  `);
  assert.equal(outline(tree)[0].inContainer, 'callout');
});

test('the heading-block hgroup is transparent, not a container', async () => {
  // Guards the ordering trap: if heading-block counted as a container, every
  // eyebrow heading would be filtered out of its own table of contents.
  const tree = await parseMarkdown('$$ Ops\n## Filing\n');
  assert.equal(outline(tree)[0].inContainer, undefined);
});

test('headingIds can be disabled without breaking the tree', async () => {
  const tree = await parseMarkdown('## Filing\n', { headingIds: false });
  assert.deepEqual(outline(tree), []);
  const [heading] = ofType(tree, 'heading');
  assert.equal(heading.data?.id, undefined);
});

test('a custom slugifier is honoured', async () => {
  const tree = await parseMarkdown('## Filing\n', {
    headingIds: { slugify: (t) => `x-${t.toLowerCase()}` },
  });
  assert.equal(outline(tree)[0].id, 'x-filing');
});
