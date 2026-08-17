/**
 * Obsidian wikilinks → resolved link nodes.
 *
 * The design point under test: **destinations are per-site**, so the package
 * ships no default resolver and the plugin stays off until one is supplied.
 * The unresolved path matters as much as the resolved one — a reader must
 * never see raw `[[...]]` on a rendered page.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, ofType, text } from './helpers.mjs';

/**
 * Resolves anything under `docs/`; everything else is unresolved.
 *
 * Note `display` is **required** on a resolution and used verbatim — the
 * resolver owns deslugify/casing, the plugin does no transformation. Omitting
 * it renders an empty anchor, which is why the type demands it.
 */
const lastSegment = (path) => path.split('/').pop();
const resolver = (input) =>
  input.path.toLowerCase().startsWith('docs/')
    ? { url: `/${input.path.toLowerCase()}`, isLocal: true, display: input.display ?? lastSegment(input.path) }
    : input.path === 'External'
      ? { url: 'https://example.com/page', isLocal: false, display: input.display ?? 'External' }
      : null;

const parse = (md, opts = {}) => parseMarkdown(md, { wikilinks: { resolver }, ...opts });

test('wikilinks are off unless a resolver is supplied', async () => {
  const tree = await parseMarkdown('See [[docs/Page]].\n');
  assert.equal(ofType(tree, 'link').length, 0);
  assert.ok(text(tree).includes('[[docs/Page]]'), 'left as plain markdown text');
});

test('a resolved wikilink becomes a link node', async () => {
  const tree = await parse('See [[docs/Page]].\n');
  const [link] = ofType(tree, 'link');
  assert.equal(link.url, '/docs/page');
  assert.equal(text(link), 'Page');
});

test('display text after the pipe wins', async () => {
  const tree = await parse('See [[docs/Page|the page]].\n');
  const [link] = ofType(tree, 'link');
  assert.equal(text(link), 'the page');
});

test('a section anchor is appended to the resolved url', async () => {
  const tree = await parse('See [[docs/Page#Some Section|there]].\n');
  const [link] = ofType(tree, 'link');
  assert.ok(link.url.startsWith('/docs/page#'), `got ${link.url}`);
});

test('local and external resolutions are classed differently', async () => {
  const local = await parse('[[docs/Page]]\n');
  assert.match(ofType(local, 'link')[0].data.hProperties.class, /wikilink--local/);

  const external = await parse('[[External]]\n');
  const [link] = ofType(external, 'link');
  assert.match(link.data.hProperties.class, /wikilink--external/);
  assert.equal(link.data.hProperties.target, '_blank');
  assert.equal(link.data.hProperties.rel, 'noopener noreferrer');
});

test('an unresolved wikilink degrades to plain text, never raw brackets', async () => {
  const tree = await parse('See [[Nowhere/Missing]].\n');
  assert.equal(ofType(tree, 'link').length, 0);
  const rendered = text(tree);
  assert.ok(!rendered.includes('[['), `raw brackets leaked: ${rendered}`);
  assert.ok(rendered.includes('Missing'), 'the display text still shows');
});

test('the unresolved callback fires once per miss', async () => {
  const seen = [];
  await parseMarkdown('[[A/One]] and [[B/Two]] and [[docs/Yes]]\n', {
    wikilinks: { resolver, onUnresolved: (input) => seen.push(input.path) },
  });
  assert.deepEqual(seen, ['A/One', 'B/Two']);
});

test('the resolver receives the parsed parts, not the raw string', async () => {
  const calls = [];
  await parseMarkdown('[[folder/Page#Section|Display]]\n', {
    wikilinks: {
      resolver: (input) => {
        calls.push(input);
        return null;
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(
    { path: calls[0].path, anchor: calls[0].anchor, display: calls[0].display },
    { path: 'folder/Page', anchor: 'Section', display: 'Display' },
  );
  assert.ok(calls[0].raw.includes('[['), 'raw text is available for audits');
});

test('wikilinks inside callout bodies still resolve', async () => {
  // The preset orders wikilinks after callouts precisely for this.
  const tree = await parse('> [!note] See also\n> [[docs/Page]]\n');
  assert.equal(ofType(tree, 'link')[0].url, '/docs/page');
});

test('several wikilinks in one paragraph each resolve', async () => {
  const tree = await parse('[[docs/One]], [[docs/Two]] and [[docs/Three]].\n');
  assert.deepEqual(ofType(tree, 'link').map((l) => l.url), ['/docs/one', '/docs/two', '/docs/three']);
});
