/**
 * Sites override code colors through CSS variables, so the output must carry
 * them and never a fixed color, and it must stay safe for `set:html`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightCode } from '../dist/highlight.js';

test('colors tokens with site variables, not fixed colors', async () => {
  const html = await highlightCode('const a = "b"; // c', 'ts');
  assert.match(html, /var\(--lfm-code-token-keyword, oklch\(from var\(--color-text\)/);
  assert.match(html, /--lfm-code-token-string/);
  assert.match(html, /--lfm-code-token-comment/);
  assert.doesNotMatch(html, /#[0-9a-f]{6}/i);
});

test('escapes code', async () => {
  const html = await highlightCode('<script>alert(1)</script>', 'html');
  assert.doesNotMatch(html, /<script>/);
  const plain = await highlightCode('<script>alert(1)</script>');
  assert.doesNotMatch(plain, /<script>/);
});

test('a missing or unknown language returns the text uncolored', async () => {
  for (const lang of [undefined, 'not-a-language']) {
    const html = await highlightCode('error: x\n  at y', lang);
    assert.match(html, /error: x/);
    assert.doesNotMatch(html, /--lfm-code-token/);
  }
});

test('keeps every line, including blank ones', async () => {
  const html = await highlightCode('a\n\nb', 'text');
  assert.equal(html.match(/<br>/g)?.length, 2);
});

test('language aliases work and case is ignored', async () => {
  for (const lang of ['sh', 'JSON', 'yml', 'py']) {
    const html = await highlightCode('a: 1', lang);
    assert.match(html, /a/);
  }
});

test('importing the parser does not load Shiki', async () => {
  const { readFileSync } = await import('node:fs');
  assert.doesNotMatch(readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8'), /shiki/);
});
