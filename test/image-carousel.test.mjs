/**
 * `:::image-carousel` normalization.
 *
 * The subtle one is ordering. Sequence variants sort chronologically by the
 * ISO stamp in the filename — but that stamp is applied once per prep *run*,
 * not per image, so a whole batch shares one value. The sort must therefore be
 * **stable**, falling back to authored order, or the ordinary case (capture a
 * sequence, prep it in one batch) would shuffle.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseImageStamp, sortSlides, CAROUSEL_VARIANTS, SEQUENCE_VARIANTS, DEFAULT_CAROUSEL_VARIANT } from '../dist/index.js';
import { parseMarkdown, directives, md } from './helpers.mjs';

const carousels = (tree) => directives(tree, 'image-carousel');

const fixture = (attrs = '') => md`
  :::image-carousel${attrs}
  ::image{src="/a.jpg" alt="Welcome screen" label="Welcome"}
  ::image{src="/b.jpg" alt="Recovery key" label="Recovery key" caption="Write it down"}
  :::
`;

test('the directive normalizes to a carousel payload', async () => {
  const tree = await parseMarkdown(fixture());
  const [node] = carousels(tree);
  assert.ok(node, 'no carousel emitted');
  const { carousel } = node.data;
  assert.equal(carousel.variant, DEFAULT_CAROUSEL_VARIANT);
  assert.equal(carousel.slides.length, 2);
  assert.deepEqual(carousel.slides.map((s) => s.src), ['/a.jpg', '/b.jpg']);
  assert.equal(carousel.slides[1].caption, 'Write it down');
});

test('the img-carousel alias collapses to one name', async () => {
  const tree = await parseMarkdown(':::img-carousel\n::image{src="/a.jpg" alt="A"}\n:::\n');
  assert.equal(carousels(tree).length, 1, 'renderers should match on one name');
  assert.equal(directives(tree, 'img-carousel').length, 0);
});

test('plain markdown images are accepted as slides too', async () => {
  const tree = await parseMarkdown(':::image-carousel\n![Welcome screen](/a.jpg)\n\n![Recovery key](/b.jpg)\n:::\n');
  const { carousel } = carousels(tree)[0].data;
  assert.equal(carousel.slides.length, 2);
  assert.equal(carousel.slides[0].alt, 'Welcome screen');
});

test('authored order is always preserved on the slide', async () => {
  const tree = await parseMarkdown(fixture());
  const { carousel } = carousels(tree)[0].data;
  assert.deepEqual(carousel.slides.map((s) => s.authoredIndex), [0, 1]);
});

test('a known variant is kept; an unknown one degrades rather than failing', async () => {
  for (const variant of CAROUSEL_VARIANTS) {
    const tree = await parseMarkdown(fixture(`{variant="${variant}"}`));
    assert.equal(carousels(tree)[0].data.carousel.variant, variant);
  }
  const bogus = await parseMarkdown(fixture('{variant="hovercraft"}'));
  assert.equal(bogus.children.length > 0, true);
  assert.equal(carousels(bogus)[0].data.carousel.variant, DEFAULT_CAROUSEL_VARIANT);
});

test('attributes carry through', async () => {
  const tree = await parseMarkdown(fixture('{title="Setting up" numbered="false" max-height="40rem"}'));
  const { carousel } = carousels(tree)[0].data;
  assert.equal(carousel.title, 'Setting up');
  assert.equal(carousel.numbered, false);
  assert.equal(carousel.maxHeight, '40rem');
});

test('numbering defaults on — ordinals are the point of a sequence', async () => {
  const tree = await parseMarkdown(fixture());
  assert.equal(carousels(tree)[0].data.carousel.numbered, true);
});

test('sequence variants default to chronological, contact-sheet does not', async () => {
  for (const variant of SEQUENCE_VARIANTS) {
    const tree = await parseMarkdown(fixture(`{variant="${variant}"}`));
    assert.equal(carousels(tree)[0].data.carousel.sort, 'chronological', variant);
  }
  const grid = await parseMarkdown(fixture('{variant="contact-sheet"}'));
  assert.equal(carousels(grid)[0].data.carousel.sort, 'authored',
    'a grid has no reading sequence to reorder');
});

// ── the filename stamp ──────────────────────────────────────────────────────

test('the ISO basic-format stamp parses out of a filename', () => {
  const at = parseImageStamp('/img/Aside__Welcome-Screen_20260817T164659Z.jpg');
  assert.ok(at instanceof Date);
  assert.equal(at.toISOString(), '2026-08-17T16:46:59.000Z');
});

test('a filename with no stamp yields null rather than a bogus date', () => {
  assert.equal(parseImageStamp('/img/plain.jpg'), null);
  assert.equal(parseImageStamp('/img/2026-08-17.jpg'), null);
});

test('the sort is stable, so one batch keeps authored order', () => {
  // Every image from a single prep run carries an identical stamp. If the sort
  // weren't stable this would shuffle, and the ordinary case would be wrong.
  const sameBatch = [0, 1, 2, 3].map((i) => ({
    src: `/${i}.jpg`,
    alt: `${i}`,
    capturedAt: new Date('2026-08-17T16:46:59Z'),
    authoredIndex: i,
  }));
  assert.deepEqual(
    sortSlides(sameBatch, 'chronological').map((s) => s.authoredIndex),
    [0, 1, 2, 3],
  );
});

test('unstamped slides fall back to authored order', () => {
  const slides = [0, 1, 2].map((i) => ({ src: `/${i}.jpg`, alt: '', capturedAt: null, authoredIndex: i }));
  assert.deepEqual(sortSlides(slides, 'chronological').map((s) => s.authoredIndex), [0, 1, 2]);
});

test('a mix of stamped and unstamped slides does not throw', () => {
  const slides = [
    { src: '/a.jpg', alt: '', capturedAt: new Date('2026-08-18T10:00:00Z'), authoredIndex: 0 },
    { src: '/b.jpg', alt: '', capturedAt: null, authoredIndex: 1 },
  ];
  assert.equal(sortSlides(slides, 'chronological').length, 2);
});

test('chronological reorders across batches, and authored opts out', () => {
  const slides = [
    { src: '/a.jpg', alt: '', capturedAt: new Date('2026-08-17T10:00:00Z'), authoredIndex: 0 },
    { src: '/b.jpg', alt: '', capturedAt: new Date('2026-08-18T10:00:00Z'), authoredIndex: 1 },
    { src: '/c.jpg', alt: '', capturedAt: new Date('2026-08-17T10:00:00Z'), authoredIndex: 2 },
  ];
  assert.deepEqual(sortSlides(slides, 'chronological').map((s) => s.src), ['/a.jpg', '/c.jpg', '/b.jpg']);
  assert.deepEqual(sortSlides(slides, 'authored').map((s) => s.src), ['/a.jpg', '/b.jpg', '/c.jpg']);
  assert.deepEqual(sortSlides(slides, 'reverse-chronological').map((s) => s.src), ['/b.jpg', '/a.jpg', '/c.jpg']);
});

test('a document with no carousel is untouched', async () => {
  const tree = await parseMarkdown('# Just a heading\n\nAnd a paragraph.\n');
  assert.equal(carousels(tree).length, 0);
});
