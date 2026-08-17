/**
 * Hex-code citations.
 *
 * The premise: authors write stable, meaningless identifiers (`[^7c1e0a]`) so
 * inserting a source mid-document doesn't renumber every footnote in the file.
 * The plugin assigns the *sequential* index at build time, by order of first
 * appearance — so the author never maintains numbering and the reader still
 * sees 1, 2, 3.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, text, md } from './helpers.mjs';

const citations = (tree) => tree?.data?.citations;

const doc = md`
  Claim one.[^7c1e0a] Claim two.[^b2d4f8]

  [^7c1e0a]: [The First Source](https://example.com/first) Published: 2026-01-15
  [^b2d4f8]: [The Second Source](https://other.org/second)
`;

test('citations data is attached even when a document has none', async () => {
  const tree = await parseMarkdown('# Nothing to cite\n');
  const data = citations(tree);
  assert.ok(data, 'the key should exist so consumers need no guard');
  assert.deepEqual(data.ordered, []);
  assert.deepEqual(data.warnings, []);
});

test('citations are indexed by order of first appearance', async () => {
  const { ordered } = citations(await parseMarkdown(doc));
  assert.deepEqual(ordered.map((c) => c.index), [1, 2]);
  assert.deepEqual(ordered.map((c) => c.identifier), ['7c1e0a', 'b2d4f8']);
});

test('order of appearance wins over order of definition', async () => {
  // This is the whole point: the author can add a source anywhere without
  // renumbering anything.
  const { ordered } = citations(await parseMarkdown(md`
    Second claim.[^bbbbbb] First claim.[^aaaaaa]

    [^aaaaaa]: [A](https://a.example)
    [^bbbbbb]: [B](https://b.example)
  `));
  assert.deepEqual(ordered.map((c) => c.identifier), ['bbbbbb', 'aaaaaa']);
  assert.deepEqual(ordered.map((c) => c.index), [1, 2]);
});

test('a structured definition is parsed into fields', async () => {
  const { ordered } = citations(await parseMarkdown(doc));
  const [first] = ordered;
  assert.equal(first.parsed, true);
  assert.equal(first.title, 'The First Source');
  assert.equal(first.url, 'https://example.com/first');
  assert.match(first.source, /example\.com/);
  assert.equal(first.publishedDate, '2026-01-15');
});

test('the raw definition text is always retained', async () => {
  const { ordered } = citations(await parseMarkdown(doc));
  assert.ok(ordered[0].raw.length > 0);
});

test('a prose-only definition still becomes a citation', async () => {
  const { ordered } = citations(await parseMarkdown(md`
    A claim.[^c0ffee]

    [^c0ffee]: Just some prose, no link at all.
  `));
  assert.equal(ordered.length, 1);
  assert.equal(ordered[0].url, undefined);
  assert.ok(ordered[0].raw.includes('Just some prose'));
});

test('the map and the ordered array agree', async () => {
  const { map, ordered } = citations(await parseMarkdown(doc));
  for (const citation of ordered) {
    assert.equal(map.get(citation.identifier)?.index, citation.index);
  }
});

test('every citation carries a hex code', async () => {
  const { ordered } = citations(await parseMarkdown(doc));
  for (const citation of ordered) {
    assert.match(citation.hex, /^[0-9a-f]+$/i, `bad hex on ${citation.identifier}`);
  }
});

test('a definition nobody references is warned about', async () => {
  const { warnings } = citations(await parseMarkdown(md`
    No references here.

    [^abc123]: [X](https://x.example)
  `));
  assert.deepEqual(
    warnings.map((w) => [w.type, w.identifier]),
    [['unused-definition', 'abc123']],
  );
});

test('a reference with no definition never reaches the plugin', async () => {
  // Documenting a real limitation rather than asserting a wish. remark-gfm
  // only creates a `footnoteReference` when a matching definition exists —
  // otherwise `[^missing1]` stays literal text, so nothing is there to warn
  // about. The `orphan-reference` warning type is unreachable by this path.
  //
  // Consequence for authors: a typo'd footnote id renders as visible
  // `[^typo]` on the page with no build-time warning. Catching it would mean
  // scanning raw text for the pattern, which this plugin deliberately does
  // not do.
  const tree = await parseMarkdown('A claim.[^missing1]\n');
  assert.equal(citations(tree).ordered.length, 0);
  assert.deepEqual(citations(tree).warnings, []);
  assert.ok(text(tree).includes('[^missing1]'), 'survives as literal text');
});

test('citations can be disabled', async () => {
  const tree = await parseMarkdown(doc, { citations: false });
  assert.equal(citations(tree), undefined);
});
