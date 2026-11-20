/**
 * Obsidian comments: `%%…%%` never reaches the page. On by default, because
 * the notes were written to stay private — a leak is the failure that matters.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, findAll } from './helpers.mjs';

const text = (tree) => findAll(tree, (n) => n.type === 'text').map((n) => n.value).join('|');
const json = (tree) => JSON.stringify(tree);

test('an inline comment is removed, with one space left between the words', async () => {
  const tree = await parseMarkdown('Ship on Friday %%unless legal objects%% for sure.');
  assert.equal(text(tree), 'Ship on Friday for sure.');
});

test('several inline comments in one paragraph each go', async () => {
  const tree = await parseMarkdown('A %%one%% B %%two%% C');
  assert.equal(text(tree), 'A B C');
});

test('a block comment across paragraphs, a heading and a list leaves nothing behind', async () => {
  const md = 'Before.\n\n%%\nPrivate paragraph.\n\n## Private heading\n\n- private item\n\n```js\nprivate()\n```\n%%\n\nAfter.';
  const tree = await parseMarkdown(md);
  assert.equal(tree.children.length, 2);
  assert.equal(text(tree), 'Before.|After.');
  assert.ok(!json(tree).includes('rivate'), 'nothing from inside the comment survives');
});

test('a commented-out heading never gets an id or an outline entry', async () => {
  const tree = await parseMarkdown('# Kept\n\n%%\n## Hidden\n%%');
  assert.equal(findAll(tree, (n) => n.type === 'heading').length, 1);
  assert.ok(!json(tree).includes('hidden'));
});

test('a comment can open mid-paragraph and close in a later one', async () => {
  const tree = await parseMarkdown('Keep this %%hide this\n\nand this%% keep that.');
  assert.equal(text(tree), 'Keep this |keep that.');
});

test('formatting inside a comment goes too', async () => {
  const tree = await parseMarkdown('Visible %%**bold** and [a link](https://x.test)%% end.');
  assert.equal(findAll(tree, (n) => n.type === 'strong' || n.type === 'link').length, 0);
  assert.equal(text(tree), 'Visible |end.');
});

test('%% in code is text, as in Obsidian', async () => {
  const tree = await parseMarkdown('Use `%%` to comment.\n\n```\n%% not a comment %%\n```');
  assert.equal(findAll(tree, (n) => n.type === 'inlineCode')[0].value, '%%');
  assert.equal(findAll(tree, (n) => n.type === 'code')[0].value, '%% not a comment %%');
});

test('an unclosed %% hides the rest of the document rather than leak it', async () => {
  const tree = await parseMarkdown('Public.\n\n%% draft notes\n\nMore private notes.');
  assert.equal(text(tree), 'Public.');
});

test('a list item that was only a comment is removed, not left as an empty bullet', async () => {
  const tree = await parseMarkdown('- one\n- %%todo: two%%\n- three');
  assert.equal(findAll(tree, (n) => n.type === 'listItem').length, 2);
});

test('comments: false keeps the text as written', async () => {
  const tree = await parseMarkdown('A %%note%% B', { comments: false });
  assert.equal(text(tree), 'A %%note%% B');
});
