/**
 * `:::link-preview` / `:::link-rollup` annotation.
 *
 * This plugin fetches nothing and renders nothing. It reads the directive's
 * attributes, classifies the links inside it against the provider catalog, and
 * stamps one spec the renderer dispatches on — so a site picks a component
 * without re-walking children or re-deriving what a URL points at.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyLink, getBareLinkUrl } from '../dist/index.js';
import { parseMarkdown, directives, ofType, md } from './helpers.mjs';

const specOf = (tree, name = 'link-preview') => directives(tree, name)[0]?.data?.linkPreviewSpec;

test('a link-preview directive is annotated with a spec', async () => {
  const tree = await parseMarkdown(md`
    :::link-preview
    https://example.com/article
    :::
  `);
  const spec = specOf(tree);
  assert.ok(spec, 'no spec stamped');
  assert.equal(spec.kind, 'link-preview');
  assert.deepEqual(spec.urls, ['https://example.com/article']);
});

test('defaults differ by directive, per the spec', async () => {
  const preview = await parseMarkdown(':::link-preview\nhttps://example.com/a\n:::\n');
  assert.equal(specOf(preview).type, 'article');
  assert.equal(specOf(preview).format, 'card');

  const rollup = await parseMarkdown(':::link-rollup\nhttps://example.com/a\n:::\n');
  const spec = specOf(rollup, 'link-rollup');
  assert.equal(spec.kind, 'link-rollup');
  assert.equal(spec.type, 'article');
  assert.equal(spec.format, 'gallery');
});

test('author attributes override the defaults', async () => {
  const tree = await parseMarkdown(md`
    :::link-preview{type="video" format="fullplayer"}
    https://example.com/watch
    :::
  `);
  const spec = specOf(tree);
  assert.equal(spec.type, 'video');
  assert.equal(spec.format, 'fullplayer');
});

test('urls are collected in document order and deduplicated', async () => {
  const tree = await parseMarkdown(md`
    :::link-rollup
    - https://a.example/one
    - https://b.example/two
    - https://a.example/one
    :::
  `);
  assert.deepEqual(specOf(tree, 'link-rollup').urls, [
    'https://a.example/one',
    'https://b.example/two',
  ]);
});

test('markdown links inside the directive count too', async () => {
  const tree = await parseMarkdown(md`
    :::link-preview
    See [the article](https://example.com/article).
    :::
  `);
  assert.deepEqual(specOf(tree).urls, ['https://example.com/article']);
});

test('links are stamped with a classification the renderer can dispatch on', async () => {
  const tree = await parseMarkdown(md`
    :::link-preview
    https://www.youtube.com/watch?v=dQw4w9WgXcQ
    :::
  `);
  const link = ofType(tree, 'link').find((l) => l.data?.linkClassification);
  assert.ok(link, 'no link carried a classification');
  assert.equal(typeof link.data.linkClassification.provider, 'string');
});

test('an unknown provider is left unclassified rather than guessed at', async () => {
  assert.equal(classifyLink('https://some-random-domain-9f3.example/page'), null);
});

test('the catalog recognises a known provider', () => {
  const hit = classifyLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.ok(hit, 'youtube should be in the catalog');
  assert.equal(typeof hit.kind, 'string');
});

test('a bare-link paragraph is detected as such', async () => {
  const tree = await parseMarkdown('https://example.com/article\n');
  const [paragraph] = ofType(tree, 'paragraph');
  assert.equal(getBareLinkUrl(paragraph), 'https://example.com/article');
});

test('a paragraph with prose around the link is not a bare link', async () => {
  const tree = await parseMarkdown('See https://example.com/article for more.\n');
  const [paragraph] = ofType(tree, 'paragraph');
  assert.equal(getBareLinkUrl(paragraph), null);
});

test('a document with no preview directive gets no spec', async () => {
  const tree = await parseMarkdown('Just [a link](https://example.com).\n');
  assert.equal(directives(tree, 'link-preview').length, 0);
  assert.equal(ofType(tree, 'link').length, 1);
});

test('no network call happens at parse time', async () => {
  // The plugin annotates; the og-fetcher fetches, and only when enabled.
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async (...args) => {
    called = true;
    return original?.(...args);
  };
  try {
    await parseMarkdown(':::link-preview\nhttps://example.com/a\n:::\n');
    assert.equal(called, false, 'parsing must never hit the network by default');
  } finally {
    globalThis.fetch = original;
  }
});
