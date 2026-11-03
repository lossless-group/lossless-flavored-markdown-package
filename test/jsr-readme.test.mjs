/**
 * JSR shows only the README, so the published one has to carry the guides.
 *
 * scripts/build-jsr-readme.mjs runs only at publish time, so a new guide, or a
 * link to a renamed heading, would otherwise surface on the live package page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildJsrReadme, slugify } from '../scripts/build-jsr-readme.mjs';

const output = buildJsrReadme();
const prose = output.replace(/^(`{3,}|~{3,})[\s\S]*?^\1\s*$/gm, '').replace(/`[^`]*`/g, '');

test('every guide in docs-v/index.md is on the page', () => {
  const index = readFileSync(new URL('../docs-v/index.md', import.meta.url), 'utf8');
  for (const [, title] of index.matchAll(/^\* \[([^\]]+)\]/gm)) {
    assert.ok(prose.toLowerCase().includes(title.toLowerCase()), `missing guide: ${title}`);
  }
});

test('guides sit before ## More, under the README heading level', () => {
  assert.ok(prose.indexOf('## Citations') < prose.indexOf('## More'));
  assert.equal(prose.match(/^# /gm).length, 1);
});

test('no link still leaves the page for a guide', () => {
  assert.doesNotMatch(prose, /docs-v\/[\w-]+\.md/);
});

test('every in-page link lands on a heading', () => {
  const seen = new Map();
  const anchors = new Set();
  for (const [, heading] of prose.matchAll(/^#{1,6} (.+)$/gm)) {
    const slug = slugify(heading);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  }
  for (const [, anchor] of prose.matchAll(/\]\(#([^)]+)\)/g)) {
    assert.ok(anchors.has(anchor), `dangling link: #${anchor}`);
  }
});

test('headings inside code fences are left as written', () => {
  assert.match(output, /^# Tasks$/m);
});
