/**
 * The preset contract: what's on by default, what's opt-in, and the two
 * orderings that are load bearing.
 *
 * Defaults are a promise to consumers — flipping one silently changes what
 * every site renders on its next install, so each is pinned here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkLfm } from '../dist/index.js';
import { parseMarkdown, directives, outline, ofType, text, md } from './helpers.mjs';

test('gfm is on by default', async () => {
  const tree = await parseMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n');
  assert.equal(ofType(tree, 'table').length, 1);
  const strike = await parseMarkdown('~~gone~~\n');
  assert.equal(ofType(strike, 'delete').length, 1);
});

test('directives are on by default', async () => {
  const tree = await parseMarkdown(':::note\nBody.\n:::\n');
  assert.equal(directives(tree, 'note').length, 1);
});

test('callouts, heading ids, heading blocks and citations are on by default', async () => {
  const tree = await parseMarkdown(md`
    > [!note] A callout

    $$ Eyebrow
    ## A heading
  `);
  assert.equal(directives(tree, 'callout').length, 1, 'callouts');
  assert.equal(outline(tree).length, 1, 'heading ids');
  assert.equal(directives(tree, 'heading-block').length, 1, 'heading blocks');
  assert.ok(tree.data.citations, 'citations');
});

test('code fences, wikilinks and og fetching are opt-in', async () => {
  // Each needs something from the consumer: formats, a resolver, a network
  // opt-in. None may activate on its own.
  const tree = await parseMarkdown(md`
    \`\`\`mermaid
    graph TD; A-->B;
    \`\`\`

    A [[Wiki/Link]] and https://example.com
  `);
  assert.equal(ofType(tree, 'code')[0].data?.fence, undefined, 'no fence registry');
  assert.ok(text(tree).includes('[[Wiki/Link]]'), 'no wikilink resolver');
  assert.equal(ofType(tree, 'link').find((l) => l.data?.linkPreview), undefined, 'no network');
});

test('every default can be turned off', async () => {
  const tree = await parseMarkdown(md`
    > [!note] A callout

    $$ Eyebrow
    ## A heading
  `, { gfm: false, directives: false, callouts: false, citations: false, headingIds: false, headingBlocks: false });

  assert.equal(directives(tree, 'callout').length, 0);
  assert.deepEqual(outline(tree), []);
  assert.equal(directives(tree, 'heading-block').length, 0);
  assert.equal(tree.data?.citations, undefined);
});

test('the preset composes as an ordinary unified plugin', async () => {
  const processor = unified().use(remarkParse).use(remarkLfm);
  const tree = await processor.run(processor.parse('## Heading\n'));
  assert.equal(outline(tree)[0].id, 'heading');
});

// ── the two orderings that are load bearing ─────────────────────────────────

test('heading ids run before heading blocks, so eyebrow headings stay in the ToC', async () => {
  // If the hgroup existed when ids were computed, every eyebrow heading would
  // be stamped inContainer and a ToC filtering containers would empty itself.
  const tree = await parseMarkdown('$$ Ops\n## Filing\n');
  const [entry] = outline(tree);
  assert.equal(entry.inContainer, undefined);
  assert.equal(entry.eyebrow, 'Ops');
  assert.equal(entry.id, 'filing');
});

test('wikilinks run after callouts, so links inside callout bodies resolve', async () => {
  const tree = await parseMarkdown('> [!note] See\n> [[docs/Page]]\n', {
    wikilinks: { resolver: () => ({ url: '/docs/page', isLocal: true, display: 'Page' }) },
  });
  const [link] = ofType(tree, 'link');
  assert.equal(link.url, '/docs/page');
});

test('a plain markdown document survives the whole pipeline unchanged in shape', async () => {
  const tree = await parseMarkdown(md`
    # Title

    A paragraph with **bold**, *italic* and a [link](https://example.com).

    - one
    - two

    > An ordinary quotation.
  `);
  assert.equal(ofType(tree, 'heading').length, 1);
  assert.equal(ofType(tree, 'listItem').length, 2);
  assert.equal(ofType(tree, 'blockquote').length, 1, 'not a callout');
  assert.equal(ofType(tree, 'link').length, 1);
});
