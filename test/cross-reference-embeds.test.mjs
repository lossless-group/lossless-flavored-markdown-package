/**
 * Obsidian section embeds: `![[Note#Heading]]` puts that section of another
 * document here, loaded through a site-supplied `load`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, findAll } from './helpers.mjs';

const docs = {
  'Tooling/Products/Google Maps': `---
title: Google Maps
---
# Google Maps

Intro to the product.

## Google Maps API managing policies.

Keys are scoped per project.

### Quotas

Daily caps apply.

## Pricing

Pay as you go.
`,
  Loop: 'See ![[Loop]] again.\n\n![[Loop]]\n',
};

const load = ({ path }) => {
  const key = Object.keys(docs).find((k) => k === path || k.endsWith(`/${path}`));
  return key ? { markdown: docs[key], url: `/notes/${key.toLowerCase().replace(/\s+/g, '-')}/` } : null;
};
const parse = (md, extra = {}) => parseMarkdown(md, { crossReferenceEmbeds: { load, ...extra } });
const xrefs = (tree) => findAll(tree, (n) => n.type === 'containerDirective' && n.name === 'cross-reference-embed');
const text = (n) => JSON.stringify(n);

test('![[Note#Heading]] embeds that section, up to the next heading at its level', async () => {
  const [e] = xrefs(await parse('Before.\n\n![[Google Maps#Google Maps API managing policies.]]\n\nAfter.'));
  assert.equal(e.data.crossReferenceEmbed.status, 'ok');
  assert.equal(e.children[0].type, 'heading');
  assert.ok(text(e).includes('Keys are scoped per project.'));
  assert.ok(text(e).includes('Daily caps apply.'), 'subsections come along');
  assert.ok(!text(e).includes('Pay as you go.'), 'stops at the next h2');
});

test('the embed carries where it came from, for the "from" line and the link out', async () => {
  const [e] = xrefs(await parse('![[Google Maps#Google Maps API managing policies.]]'));
  assert.equal(e.data.crossReferenceEmbed.title, 'Google Maps', 'title from the source frontmatter');
  assert.equal(e.data.crossReferenceEmbed.url, '/notes/tooling/products/google-maps/');
  assert.equal(e.data.crossReferenceEmbed.section, 'Google Maps API managing policies.');
  assert.equal(e.attributes.href, '/notes/tooling/products/google-maps/');
});

test('both orders work: Obsidian\'s #Heading|Label, and |Label#Heading', async () => {
  const a = xrefs(await parse('![[Tooling/Products/Google Maps#Google Maps API managing policies.|Maps]]'))[0];
  const b = xrefs(await parse('![[Tooling/Products/Google Maps|Google Maps#Google Maps API managing policies.]]'))[0];
  for (const e of [a, b]) {
    assert.equal(e.data.crossReferenceEmbed.status, 'ok');
    assert.equal(e.data.crossReferenceEmbed.path, 'Tooling/Products/Google Maps');
    assert.equal(e.data.crossReferenceEmbed.section, 'Google Maps API managing policies.');
  }
  assert.equal(a.data.crossReferenceEmbed.title, 'Maps', 'the label is the title');
  assert.equal(b.data.crossReferenceEmbed.title, 'Google Maps');
});

test('#A#B embeds a section inside a section; slugs and case match too', async () => {
  const [nested] = xrefs(await parse('![[Google Maps#google-maps-api-managing-policies#QUOTAS]]'));
  assert.equal(nested.data.crossReferenceEmbed.status, 'ok');
  assert.ok(text(nested).includes('Daily caps apply.'));
  assert.ok(!text(nested).includes('Keys are scoped'));
});

test('![[Note]] embeds the whole document without its frontmatter', async () => {
  const [e] = xrefs(await parse('![[Google Maps]]'));
  assert.ok(text(e).includes('Pay as you go.'));
  assert.ok(!text(e).includes('title: Google Maps'));
});

test('missing documents and sections leave an empty block that says why', async () => {
  const misses = [];
  const tree = await parse('![[Nope#X]]\n\n![[Google Maps#Not a heading]]', { onUnresolved: (i) => misses.push(i.status) });
  assert.deepEqual(xrefs(tree).map((e) => [e.data.crossReferenceEmbed.status, e.children.length]), [['missing-document', 0], ['missing-section', 0]]);
  assert.deepEqual(misses, ['missing-document', 'missing-section']);
});

test('file embeds and inline mentions are left alone', async () => {
  const tree = await parse('![[photo.png]]\n\nText with ![[Google Maps]] inline.');
  assert.equal(xrefs(tree).length, 0);
});

test('a document embedding itself stops at maxDepth', async () => {
  const tree = await parse('![[Loop]]');
  const all = xrefs(tree);
  assert.equal(all.length, 3, 'depth 0, 1, then the stop');
  assert.equal(all.at(-1).data.crossReferenceEmbed.status, 'too-deep');
});

test('embedded headings get ids on the host page but stay out of its outline\'s top level', async () => {
  const tree = await parse('## Mine\n\n![[Google Maps#Google Maps API managing policies.]]');
  const ids = tree.data.headings.map((h) => [h.id, h.inContainer ?? null]);
  assert.deepEqual(ids[0], ['mine', null]);
  assert.ok(ids.slice(1).every(([, c]) => c === 'cross-reference-embed'), 'embedded headings are inContainer: embed');
});

test('without the embeds option, ![[…]] stays text', async () => {
  const tree = await parseMarkdown('![[Google Maps#Pricing]]');
  assert.equal(xrefs(tree).length, 0);
});
