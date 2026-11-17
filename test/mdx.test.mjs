/**
 * MDX as a trigger syntax: JSX elements become componentNodes that name the
 * component the file imports, with props evaluated statically, never executed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, findAll } from './helpers.mjs';

const doc = `import BarChart from '../../components/BarChart.astro';
import Stat from '../../components/Stat.astro';
import * as Chart from './charts.js';

# Demand charges

One window costs half the month.

<BarChart
	caption="One month, one meter"
	items={[
		{ label: 'Tariff', value: 18000, display: '$18,000' },
		{ label: 'Demand', value: 8750, accent: true },
	]}
	yMin={-5}
	compact
/>

<Stat value="5×" label="One school's use vs peers" />

{/* an author's note, not content */}

A total of {42} schools, with <Stat value="inline" label="x" /> inside a line.

<Chart.Line data={window.series} />

<div class="note">Plain *HTML* box</div>
`;

const parse = () => parseMarkdown(doc, { mdx: { filePath: 'src/content/blog/demand.mdx' } });
const components = (tree) => findAll(tree, (n) => n.type === 'componentNode');

test('JSX elements become mdx componentNodes with statically evaluated props', async () => {
  const [bar] = components(await parse());
  assert.equal(bar.name, 'BarChart');
  assert.equal(bar.triggerSyntax, 'mdx');
  assert.equal(bar.inline, false);
  assert.deepEqual(bar.props, {
    caption: 'One month, one meter',
    items: [
      { label: 'Tariff', value: 18000, display: '$18,000' },
      { label: 'Demand', value: 8750, accent: true },
    ],
    yMin: -5,
    compact: true,
  });
  assert.deepEqual(bar.attributes, { caption: 'One month, one meter', yMin: '-5', compact: 'true' });
});

test('the component comes from the file\'s own import, resolved against filePath', async () => {
  const [bar, stat] = components(await parse());
  assert.deepEqual(bar.import, {
    local: 'BarChart',
    source: '../../components/BarChart.astro',
    name: 'default',
    resolved: 'src/components/BarChart.astro',
  });
  assert.equal(stat.import.resolved, 'src/components/Stat.astro');
});

test('namespace members resolve through the namespace import', async () => {
  const line = components(await parse()).find((n) => n.name === 'Chart.Line');
  assert.equal(line.import.name, '*');
  assert.equal(line.import.resolved, 'src/content/blog/charts.js');
  assert.deepEqual(line.dynamicProps, ['data'], 'a variable is dynamic, never executed');
  assert.equal('data' in line.props, false);
});

test('imports leave the content and are recorded on the tree', async () => {
  const tree = await parse();
  assert.equal(findAll(tree, (n) => n.type === 'mdxjsEsm').length, 0);
  assert.deepEqual(tree.data.mdx.imports.map((i) => i.local), ['BarChart', 'Stat', 'Chart']);
});

test('expressions: comments vanish, static values become text', async () => {
  const tree = await parse();
  assert.equal(findAll(tree, (n) => n.type === 'mdxFlowExpression' || n.type === 'mdxTextExpression').length, 0);
  const para = tree.children.find((n) => n.type === 'paragraph' && JSON.stringify(n).includes('schools'));
  assert.ok(JSON.stringify(para).includes('"value":"42"'));
});

test('inline elements are marked inline; lowercase elements are intrinsic', async () => {
  const all = components(await parse());
  const inline = all.find((n) => n.props.value === 'inline');
  assert.equal(inline.inline, true);
  const div = all.find((n) => n.name === 'div');
  assert.equal(div.intrinsic, true);
  assert.equal(div.import, undefined);
  assert.equal(div.props.class, 'note');
});

test('headings still get LFM ids alongside MDX', async () => {
  const tree = await parse();
  assert.equal(tree.data.headings[0].id, 'demand-charges');
});

test('without the mdx option, JSX is not parsed as MDX', async () => {
  const tree = await parseMarkdown('<Stat value="1" />\n\nA {brace} stays text.');
  assert.equal(components(tree).length, 0);
  assert.ok(JSON.stringify(tree).includes('{brace}'));
});
