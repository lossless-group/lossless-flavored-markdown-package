/**
 * The code-fence format registry.
 *
 * Two properties matter more than the routing itself: the registry ships
 * **empty**, so a splash page carries no diagram knowledge it never uses; and a
 * handler that throws must never fail a build — the error is recorded and the
 * renderer falls back to source.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, ofType, md } from './helpers.mjs';

const fenced = (tree) => ofType(tree, 'code');

const yamlish = {
  name: 'yamlish',
  match: ['yamlish', 'YAMLISH'],
  parse: (raw) => ({ lines: raw.trim().split('\n').length }),
};

const exploding = {
  name: 'exploding',
  match: ['boom'],
  parse: () => {
    throw new Error('handler blew up');
  },
};

const claimOnly = { name: 'claim-only', match: ['claimed'] };

test('with no formats registered the plugin is inert', async () => {
  const tree = await parseMarkdown('```yamlish\na: 1\n```\n');
  assert.equal(fenced(tree)[0].data?.fence, undefined, 'you pay for what you name');
});

test('a registered format claims its language and parses', async () => {
  const tree = await parseMarkdown('```yamlish\na: 1\nb: 2\n```\n', {
    codeFences: { formats: [yamlish] },
  });
  const { fence } = fenced(tree)[0].data;
  assert.equal(fence.format, 'yamlish');
  assert.deepEqual(fence.parsed, { lines: 2 });
  assert.equal(fence.error, undefined);
});

test('language matching is case-insensitive', async () => {
  const tree = await parseMarkdown('```YAMLish\na: 1\n```\n', {
    codeFences: { formats: [yamlish] },
  });
  assert.equal(fenced(tree)[0].data.fence.format, 'yamlish');
});

test('an unclaimed language is untouched', async () => {
  const tree = await parseMarkdown('```python\nprint(1)\n```\n', {
    codeFences: { formats: [yamlish] },
  });
  assert.equal(fenced(tree)[0].data?.fence, undefined);
});

test('a fence with no language is untouched', async () => {
  const tree = await parseMarkdown('```\nplain\n```\n', {
    codeFences: { formats: [yamlish] },
  });
  assert.equal(fenced(tree)[0].data?.fence, undefined);
});

test('a handler may claim a language without parsing it', async () => {
  const tree = await parseMarkdown('```claimed\nwhatever\n```\n', {
    codeFences: { formats: [claimOnly] },
  });
  const { fence } = fenced(tree)[0].data;
  assert.equal(fence.format, 'claim-only');
  assert.equal(fence.parsed, undefined, 'claiming a language is enough to dispatch on');
});

test('a throwing handler records the error instead of failing the build', async () => {
  const tree = await parseMarkdown('```boom\nanything\n```\n', {
    codeFences: { formats: [exploding] },
  });
  const { fence } = fenced(tree)[0].data;
  assert.equal(fence.format, 'exploding');
  assert.equal(fence.parsed, undefined);
  assert.match(fence.error, /handler blew up/);
});

test('several formats coexist and route independently', async () => {
  const tree = await parseMarkdown(md`
    \`\`\`yamlish
    a: 1
    \`\`\`

    \`\`\`boom
    x
    \`\`\`

    \`\`\`python
    pass
    \`\`\`
  `, { codeFences: { formats: [yamlish, exploding] } });

  const [a, b, c] = fenced(tree);
  assert.equal(a.data.fence.format, 'yamlish');
  assert.equal(b.data.fence.format, 'exploding');
  assert.equal(c.data?.fence, undefined);
});

test('fences inside a callout are still routed', async () => {
  const tree = await parseMarkdown(md`
    > [!note] With code
    > \`\`\`yamlish
    > a: 1
    > \`\`\`
  `, { codeFences: { formats: [yamlish] } });
  assert.equal(fenced(tree)[0].data.fence.format, 'yamlish');
});
