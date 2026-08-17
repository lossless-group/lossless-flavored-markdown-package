/**
 * Eyebrow / heading / subheading blocks.
 *
 * The governing rule is that **position is the semantics**: `$$` and `&&` mean
 * nothing on their own and bind only by adjacency to a heading. Most of this
 * file is therefore about what should *not* happen — because the failure mode
 * of getting it wrong is silently swallowing someone's prose.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, directives, ofType, outline, text, md } from './helpers.mjs';

const blocks = (tree) => directives(tree, 'heading-block');
const partsOf = (block) => ({
  eyebrow: block.children.find((c) => c.data?.hProperties?.class?.includes('heading-block-eyebrow')),
  heading: block.children.find((c) => c.type === 'heading'),
  subs: block.children.filter((c) => c.data?.hProperties?.class?.includes('heading-block-subheading')),
});

test('the canonical three-part block', async () => {
  const tree = await parseMarkdown(md`
    $$ Portfolio Operations
    ## Every email from a portco, filed as PDFs
    && Two passes, inventory before export
  `);
  const [block] = blocks(tree);
  assert.ok(block, 'no heading-block emitted');
  assert.equal(block.data.hName, 'hgroup');
  assert.equal(block.data.hProperties.class, 'heading-block');

  const { eyebrow, heading, subs } = partsOf(block);
  assert.equal(eyebrow.type, 'paragraph');
  assert.equal(eyebrow.data.hName, 'p', 'secondary content must stay paragraph-level');
  assert.equal(text(eyebrow), 'Portfolio Operations');
  assert.equal(heading.depth, 2);
  assert.equal(subs.length, 1);
  assert.equal(text(subs[0]), 'Two passes, inventory before export');
});

test('exactly one heading lives inside the hgroup', async () => {
  const tree = await parseMarkdown('$$ Ops\n## Filing\n&& Sub\n');
  const [block] = blocks(tree);
  assert.equal(block.children.filter((c) => c.type === 'heading').length, 1);
  // The subheading must never become a heading — it would show up in the
  // outline as a section that doesn't exist.
  assert.equal(outline(tree).length, 1);
});

test('class contract is exact', async () => {
  // These strings are public API: LFM ships no CSS, so they are the only thing
  // a consumer can style against. The scoped class is what outranks `.prose p`.
  const tree = await parseMarkdown('$$ Ops\n## Filing\n&& Sub\n');
  const { eyebrow, subs } = partsOf(blocks(tree)[0]);
  assert.equal(eyebrow.data.hProperties.class, 'heading-block-eyebrow eyebrow');
  assert.equal(subs[0].data.hProperties.class, 'heading-block-subheading subheading');
});

test('^^ is an accepted alias for $$', async () => {
  const tree = await parseMarkdown('^^ Ops\n## Filing\n');
  assert.equal(blocks(tree)[0].data.headingBlock.eyebrow, 'Ops');
});

test('either optional line may be omitted', async () => {
  const eyebrowOnly = await parseMarkdown('$$ Ops\n## Filing\n');
  assert.equal(blocks(eyebrowOnly)[0].data.headingBlock.subheadings.length, 0);

  const subOnly = await parseMarkdown('## Filing\n&& Two passes\n');
  const payload = blocks(subOnly)[0].data.headingBlock;
  assert.equal(payload.eyebrow, undefined);
  assert.deepEqual(payload.subheadings, ['Two passes']);
});

test('the eyebrow reaches the outline entry', async () => {
  const tree = await parseMarkdown('$$ Portfolio Operations\n## Filing\n');
  assert.equal(outline(tree)[0].eyebrow, 'Portfolio Operations');
});

test('a heading with no eyebrow gets no eyebrow key', async () => {
  const tree = await parseMarkdown('## Filing\n');
  assert.equal(outline(tree)[0].eyebrow, undefined);
  assert.equal(blocks(tree).length, 0, 'a bare heading must not be wrapped');
});

// ── the rule is adjacency, and these are the ways it must not fire ──────────

test('a blank line breaks the binding and the markers stay literal', async () => {
  const tree = await parseMarkdown('$$ Ops\n\n## Filing\n\n&& Two passes\n');
  assert.equal(blocks(tree).length, 0);
  const paras = ofType(tree, 'paragraph');
  assert.equal(text(paras[0]), '$$ Ops');
  assert.equal(text(paras[1]), '&& Two passes');
});

test('a marker with no heading anywhere is inert', async () => {
  const tree = await parseMarkdown('$$ Not above a heading\n\nJust prose.\n');
  assert.equal(blocks(tree).length, 0);
});

test('a marker below a heading is not an eyebrow, and above is not a subheading', async () => {
  const wrongWayRound = await parseMarkdown('## Filing\n$$ Ops\n');
  assert.equal(blocks(wrongWayRound).length, 0, 'order is fixed');

  const alsoWrong = await parseMarkdown('&& Sub\n## Filing\n');
  assert.equal(blocks(alsoWrong).length, 0);
});

test('a bare marker with no text is not a block', async () => {
  assert.equal(blocks(await parseMarkdown('$$\n## Filing\n')).length, 0);
  assert.equal(blocks(await parseMarkdown('$$   \n## Filing\n')).length, 0);
});

test('the marker binds a line, not the whole paragraph', async () => {
  const tree = await parseMarkdown(md`
    Some prose here
    $$ Ops
    ## Filing
    && Sub one
    && Sub two
    Trailing prose
  `);
  const [block] = blocks(tree);
  assert.equal(block.data.headingBlock.eyebrow, 'Ops');
  assert.deepEqual(block.data.headingBlock.subheadings, ['Sub one', 'Sub two']);

  // the prose on either side survives, outside the block
  assert.equal(text(tree.children[0]), 'Some prose here');
  assert.ok(text(tree.children[tree.children.length - 1]).includes('Trailing prose'));
});

test('consecutive && lines each become their own paragraph', async () => {
  const tree = await parseMarkdown('## Filing\n&& One\n&& Two\n&& Three\n');
  const { subs } = partsOf(blocks(tree)[0]);
  assert.equal(subs.length, 3, 'hgroup permits several secondary paragraphs');
  assert.deepEqual(subs.map(text), ['One', 'Two', 'Three']);
});

test('inline markup survives, and the payload flattens it', async () => {
  const tree = await parseMarkdown('$$ **Bold** ops\n## Filing\n&& A `code` sub\n');
  const [block] = blocks(tree);
  const { eyebrow, subs } = partsOf(block);
  assert.ok(eyebrow.children.some((c) => c.type === 'strong'));
  assert.ok(subs[0].children.some((c) => c.type === 'inlineCode'));
  assert.equal(block.data.headingBlock.eyebrow, 'Bold ops');
  assert.deepEqual(block.data.headingBlock.subheadings, ['A code sub']);
});

test('works at any heading level', async () => {
  for (const hashes of ['#', '##', '###', '####', '#####', '######']) {
    const tree = await parseMarkdown(`$$ Ops\n${hashes} Filing\n`);
    assert.equal(blocks(tree).length, 1, `failed at ${hashes.length}`);
  }
});

test('binds inside a callout body too', async () => {
  const tree = await parseMarkdown(md`
    :::details
    $$ Ops
    ### Filing
    :::
  `);
  const [block] = blocks(tree);
  assert.ok(block, 'containers are transformed before their parent');
  assert.equal(block.data.headingBlock.eyebrow, 'Ops');
  assert.equal(outline(tree)[0].inContainer, 'details');
});

test('the known display-math residue is documented behaviour, not an accident', async () => {
  // A real math block is untouched: its next line is a formula, never a heading.
  const realMath = await parseMarkdown('$$\n\\frac{a}{b}\n$$\n\n## Filing\n');
  assert.equal(blocks(realMath).length, 0);

  // Math opened directly above a heading does bind. Malformed already; it now
  // fails differently. `^^` exists so this can be deprecated without a
  // content migration.
  const residue = await parseMarkdown('$$ x = 1\n## Filing\n');
  assert.equal(blocks(residue).length, 1);
});

test('headingBlocks can be disabled', async () => {
  const tree = await parseMarkdown('$$ Ops\n## Filing\n', { headingBlocks: false });
  assert.equal(blocks(tree).length, 0);
  assert.equal(outline(tree)[0].id, 'filing', 'ids are independent of blocks');
  assert.equal(outline(tree)[0].eyebrow, undefined);
});
