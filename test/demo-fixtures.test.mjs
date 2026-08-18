/**
 * The demo page's markdown files, checked as fixtures.
 *
 * `splash/src/content/lfm-demos/*.md` are real markdown documents on disk. The
 * splash loads them as a content collection and runs `parseMarkdown` over each
 * body at build time; this suite reads the same files and asserts each one
 * actually produces what the page claims it does.
 *
 * That makes the relationship two-way and worth having:
 *
 *   - **The page can't lie.** If a plugin regresses, the demo silently shows a
 *     worse payload. Here it fails.
 *   - **The fixtures can't rot.** If someone edits an example into something
 *     that no longer demonstrates the feature — deletes the callout from the
 *     table-of-contents fixture, say — the suite says so before it ships.
 *   - **They exercise the authoring path**, not a string literal. These are
 *     documents with frontmatter, parsed from disk, which is closer to what a
 *     consuming site actually does than anything else in this suite.
 *
 * Reading them directly rather than through Astro is deliberate: the package
 * must not depend on the splash, and a test that needed a site build to run
 * would not get run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseMarkdown } from '../dist/index.js';
import {
  mermaid, graphviz, jsonCanvas, vegaLite, yang, jsonSchema,
} from '../dist/formats/index.js';
import { plantuml } from '../dist/formats/plantuml.js';

const FORMATS = [mermaid, graphviz, jsonCanvas, vegaLite, yang, jsonSchema, plantuml];

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(root, 'splash/src/content/lfm-demos');

/** Split YAML frontmatter off a markdown file. Enough for these fixtures. */
function split(raw) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  assert.ok(m, 'fixture is missing frontmatter');
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2].trim() };
}

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.md')).sort() : [];

const fixtures = files.map((file) => {
  const { data, body } = split(readFileSync(join(DIR, file), 'utf8'));
  return { file, id: file.replace(/\.md$/, ''), data, body };
});

const byId = Object.fromEntries(fixtures.map((f) => [f.id, f]));
const parse = (f) => parseMarkdown(f.body, { codeFences: { formats: FORMATS } });

const findAll = (node, pred, out = []) => {
  for (const child of node?.children ?? []) {
    if (pred(child)) out.push(child);
    findAll(child, pred, out);
  }
  return out;
};
const directive = (tree, name) =>
  findAll(tree, (n) => n.type === 'containerDirective' && n.name === name)[0];

// ── the collection itself ───────────────────────────────────────────────────

test('the demo collection exists and is populated', () => {
  assert.ok(files.length >= 13, `expected the full demo set, found ${files.length}`);
});

test('every fixture carries the frontmatter the page renders from', () => {
  for (const f of fixtures) {
    assert.ok(f.data.title, `${f.file}: no title`);
    assert.ok(['feature', 'fence'].includes(f.data.kind), `${f.file}: kind must be feature|fence`);
    assert.ok(f.data.note, `${f.file}: no note — the page renders it as the explanation`);
    assert.ok(f.data.order, `${f.file}: no order`);
    assert.ok(f.body.length > 0, `${f.file}: empty body`);
  }
});

test('every fixture parses without throwing', async () => {
  for (const f of fixtures) {
    await assert.doesNotReject(() => parse(f), `${f.file} failed to parse`);
  }
});

test('orders are unique, so the page has a stable sequence', () => {
  const orders = fixtures.map((f) => Number(f.data.order));
  assert.equal(new Set(orders).size, orders.length, `duplicate order values: ${orders.join(', ')}`);
});

// ── feature fixtures produce what the page shows ────────────────────────────

test('the eyebrow fixture produces a full three-part block', async () => {
  const tree = await parse(byId['eyebrow-heading-subheading']);
  const block = directive(tree, 'heading-block');
  assert.ok(block, 'no heading-block — the fixture no longer demonstrates the feature');
  assert.equal(block.data.hName, 'hgroup');
  assert.ok(block.data.headingBlock.eyebrow, 'the eyebrow line went missing');
  assert.ok(block.data.headingBlock.subheadings.length > 0, 'the subheading line went missing');
  assert.equal(tree.data.headings[0].eyebrow, block.data.headingBlock.eyebrow);
});

test('the toc fixture still contains the callout that makes it interesting', async () => {
  const tree = await parse(byId['table-of-contents']);
  const outline = tree.data.headings;
  assert.ok(outline.length >= 5, 'the fixture needs enough headings to nest');

  const nested = outline.filter((h) => h.inContainer);
  assert.ok(nested.length > 0, 'without a heading inside a container the demo shows nothing');
  assert.equal(nested[0].inContainer, 'callout');
  assert.ok(nested[0].id.length > 0, 'a container heading must still be anchored');

  assert.ok(outline.some((h) => h.eyebrow), 'the fixture also demonstrates eyebrow-in-outline');
});

test('the callout fixture produces a typed, titled callout', async () => {
  const tree = await parse(byId.callouts);
  const callout = directive(tree, 'callout');
  assert.ok(callout);
  assert.equal(callout.attributes.type, 'warning');
  assert.ok(callout.attributes.title, 'a titleless callout would demo less');
  assert.equal(callout.data.hProperties.class, 'callout callout-warning');
});

test('the citations fixture demonstrates order-of-appearance numbering', async () => {
  const tree = await parse(byId.citations);
  const { ordered } = tree.data.citations;
  assert.equal(ordered.length, 2);
  // The whole point of the example: the second-*defined* source is citation 1.
  assert.equal(ordered[0].index, 1);
  assert.equal(ordered[0].identifier, 'b2d4f8');
  assert.ok(ordered.some((c) => c.publishedDate), 'one should carry structured metadata');
});

test('the carousel fixture is a real carousel with real alt text', async () => {
  const tree = await parse(byId['image-carousel']);
  const { carousel } = directive(tree, 'image-carousel').data;
  assert.equal(carousel.variant, 'peek');
  assert.equal(carousel.slides.length, 4, 'two slides does not show a sequence');
  assert.ok(carousel.title, 'the demo renders the title');

  for (const s of carousel.slides) {
    assert.ok(s.alt && s.alt.length > 40,
      `slide "${s.label}" has thin alt text; the fixture is lifted from published work and should keep it`);
    assert.ok(s.label, 'every slide needs a label');
    assert.ok(s.src.startsWith('https://'), 'the demo renders these as real images');
  }
});

test('the carousel fixture reproduces the run-stamp ordering problem', async () => {
  // This is the whole reason the fixture is worth having: one image was
  // re-uploaded after redaction, so it carries a later stamp and chronological
  // ordering displaces it. Flatten the stamps and the demo stops teaching.
  const tree = await parse(byId['image-carousel']);
  const { carousel } = directive(tree, 'image-carousel').data;
  const slides = carousel.slides;

  assert.equal(carousel.sort, 'chronological', 'peek is a sequence variant');

  const stamps = new Set(slides.map((s) => s.capturedAt?.getTime()));
  assert.equal(stamps.size, 2, 'the fixture needs one odd stamp out to demonstrate anything');

  const displaced = slides.some((s, i) => s.authoredIndex !== i);
  assert.ok(displaced, 'no slide moved — the ordering demo shows nothing');

  // Everything sharing the majority stamp must stay in authored order, which
  // is what makes the sort stable rather than merely correct.
  const earliest = Math.min(...stamps);
  const majority = slides.filter((s) => s.capturedAt?.getTime() === earliest);
  const authoredSeq = majority.map((s) => s.authoredIndex);
  assert.deepEqual(authoredSeq, [...authoredSeq].sort((a, b) => a - b),
    'slides sharing a stamp were reordered; the sort is not stable');

  // authoredIndex must survive, or the page cannot show before-and-after.
  assert.deepEqual([...slides].map((s) => s.authoredIndex).sort((a, b) => a - b), [0, 1, 2, 3]);
});

test('the link-rollup fixture collects and classifies its urls', async () => {
  const tree = await parse(byId['link-rollup']);
  const spec = directive(tree, 'link-rollup').data.linkPreviewSpec;
  assert.equal(spec.kind, 'link-rollup');
  assert.equal(spec.format, 'gallery');
  assert.equal(spec.urls.length, 2);
  const classified = findAll(tree, (n) => n.type === 'link' && n.data?.linkClassification);
  assert.ok(classified.length > 0, 'at least one url should hit the provider catalog');
});

// ── fence fixtures resolve to the handler they claim ─────────────────────────

const fenceFixtures = fixtures.filter((f) => f.data.kind === 'fence');

test('every fence fixture routes to the handler its frontmatter names', async () => {
  assert.equal(fenceFixtures.length, 7, 'one fixture per shipped handler');
  for (const f of fenceFixtures) {
    const tree = await parse(f);
    const code = findAll(tree, (n) => n.type === 'code')[0];
    assert.ok(code, `${f.file}: body is not a fenced code block`);
    assert.equal(code.data?.fence?.format, f.data.handler, `${f.file} resolved to the wrong handler`);
    assert.equal(code.data.fence.error, undefined, `${f.file} errored: ${code.data.fence.error}`);
  }
});

test('the fixtures cover every shipped handler exactly once', () => {
  assert.deepEqual(
    fenceFixtures.map((f) => f.data.handler).sort(),
    FORMATS.map((f) => f.name).sort(),
  );
});

test('recognition-only fixtures parse nothing, and their source survives', async () => {
  for (const id of ['fence-mermaid', 'fence-graphviz']) {
    const tree = await parse(byId[id]);
    const code = findAll(tree, (n) => n.type === 'code')[0];
    assert.equal(code.data.fence.parsed, undefined, `${id} should claim only`);
    assert.ok(code.value.length > 0, `${id}: the renderer needs the source verbatim`);
  }
});

test('the yang fixture renders a tree exercising the marker grammar', async () => {
  const tree = await parse(byId['fence-yang']);
  const { parsed } = findAll(tree, (n) => n.type === 'code')[0].data.fence;
  assert.ok(parsed.module.name, 'no module name');
  const diagram = parsed.tree;
  // If someone simplifies the fixture, these stop demonstrating anything.
  assert.match(diagram, /\*/, 'fixture should include a leaf-list or list');
  assert.match(diagram, /!/, 'fixture should include a presence container');
  assert.match(diagram, /\+--ro /, 'fixture should include a config-false node');
  assert.match(diagram, /\[\w+\]/, 'fixture should include a keyed list');
});

test('the json-schema fixture exercises $ref expansion and unions', async () => {
  const tree = await parse(byId['fence-json-schema']);
  const { parsed } = findAll(tree, (n) => n.type === 'code')[0].data.fence;
  assert.ok(parsed.doc.title);
  assert.match(parsed.tree, /\|/, 'fixture should include a union type');
  assert.match(parsed.tree, /enum/, 'fixture should include an enum');
  assert.match(parsed.tree, /filename/, '$ref target should be expanded inline');
});

test('the plantuml fixture yields drawable urls', async () => {
  const tree = await parse(byId['fence-plantuml']);
  const { parsed } = findAll(tree, (n) => n.type === 'code')[0].data.fence;
  assert.ok(parsed.svg.startsWith('https://'), 'the page renders this as an <img> src');
  assert.equal(parsed.wrapped, false, 'the fixture demonstrates the auto-wrap');
  assert.equal(parsed.kind, 'sequence');
});

test('the json canvas fixture carries geometry the page draws an SVG from', async () => {
  // The page builds a dependency-free SVG straight from this payload, so every
  // node needs a box and every edge needs endpoints that resolve.
  const tree = await parse(byId['fence-jsoncanvas']);
  const { parsed } = findAll(tree, (n) => n.type === 'code')[0].data.fence;

  assert.ok(parsed.nodes.length >= 15, 'a two-box canvas does not show what a canvas is for');
  for (const n of parsed.nodes) {
    for (const k of ['x', 'y', 'width', 'height']) {
      assert.equal(typeof n[k], 'number', `node ${n.id} has no ${k}; the SVG cannot be laid out`);
    }
  }

  const ids = new Set(parsed.nodes.map((n) => n.id));
  assert.ok(parsed.edges.length >= 10, 'edges are what make a canvas readable');
  for (const e of parsed.edges) {
    assert.ok(ids.has(e.fromNode) && ids.has(e.toNode), `edge ${e.id} points at a missing node`);
  }
});

test('the canvas fixture exercises the parts of the spec worth showing', async () => {
  // Guards the fixture rather than the parser: simplify this canvas and the
  // demo silently stops demonstrating groups, sides or colours.
  const tree = await parse(byId['fence-jsoncanvas']);
  const { parsed } = findAll(tree, (n) => n.type === 'code')[0].data.fence;

  const groups = parsed.nodes.filter((n) => n.type === 'group');
  assert.ok(groups.length >= 3, 'groups are the structural feature of a canvas');
  assert.ok(groups.every((g) => g.label), 'an unlabelled group renders as an empty box');

  const items = parsed.nodes.filter((n) => n.type !== 'group');
  assert.ok(items.every((n) => n.text), 'every drawable node needs a label');

  // Every group should actually contain something, or the frame is decoration.
  for (const g of groups) {
    const inside = items.filter((n) =>
      n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height);
    assert.ok(inside.length > 0, `group "${g.label}" contains no nodes`);
  }

  const sided = parsed.edges.filter((e) => e.fromSide && e.toSide);
  assert.ok(sided.length >= 10, 'fromSide/toSide is what makes the routing look deliberate');
  assert.ok(parsed.edges.some((e) => e.label), 'at least one edge should explain itself');
  assert.ok(parsed.nodes.some((n) => n.color), 'colour is part of the spec and worth demonstrating');
});

test('the canvas fixture leaks no internal paths or wikilinks', async () => {
  // It was converted from a real Obsidian canvas whose nodes were `file` nodes
  // pointing at internal documents. Those became plain `text` labels.
  const raw = byId['fence-jsoncanvas'].body;
  assert.ok(!raw.includes('"type": "file"'), 'file nodes reference internal documents');
  assert.ok(!/\[\[/.test(raw), 'a wikilink survived the conversion');
  assert.ok(!/"file"\s*:/.test(raw), 'a file path survived the conversion');
  assert.ok(!raw.includes('.md'), 'a document path survived the conversion');
});

test('the vega-lite fixture summarizes to something worth showing', async () => {
  const tree = await parse(byId['fence-vega-lite']);
  const { parsed } = findAll(tree, (n) => n.type === 'code')[0].data.fence;
  assert.ok(parsed.mark, 'no mark — nothing to draw');
  assert.ok(parsed.channels.length >= 2, 'a one-channel chart demonstrates little');
  assert.ok(parsed.title, 'the fixture should carry a title for the fallback summary');
  assert.match(parsed.data, /inline rows/);
});
