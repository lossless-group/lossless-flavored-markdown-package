/**
 * `re:Invent` is a word: remark-directive would read `:Invent` as an inline
 * directive with no handler, and the renderer would print nothing for it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, findAll } from './helpers.mjs';

test('a colon inside a word stays text, not a directive', async () => {
  const tree = await parseMarkdown('AWS bills re:Invent as the largest. A real one: :badge[New] here.');
  const json = JSON.stringify(tree);
  assert.ok(json.includes('AWS bills re:Invent as the largest.'), 're:Invent survives');
  assert.equal(findAll(tree, (n) => n.type === 'textDirective').map((n) => n.name).join(), 'badge');
});
