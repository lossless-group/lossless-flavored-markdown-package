/**
 * The naming contract is public API, so it gets tests like any other.
 *
 * Two things are guarded here, and they fail in ways that are silent otherwise:
 *
 * 1. **Every deprecated alias still resolves to its canonical plugin.** Roughly
 *    twenty files across four consuming sites import the pre-0.5.0 names. A
 *    refactor that drops one wouldn't fail a build here — it would fail in
 *    someone else's repo, weeks later.
 *
 * 2. **No name from a rename that never shipped survives.** The 0.5.0 sweep
 *    passed through an intermediate `lfmCallouts`-style naming that was never
 *    published. Exporting one of those would advertise a version that never
 *    existed.
 *
 * The tier assignment itself lives in
 * context-v/blueprints/Naming-Plugins-Against-the-Remark-Ecosystem.md.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as lfm from '../dist/index.js';

/** Tier 2 — a formal remark plugin exists; we behave differently. */
const TIER_2 = [
  ['remarkLfmCallouts', 'remarkCallouts'],
  ['remarkLfmCitations', 'remarkCitations'],
  ['remarkLfmCodeFences', 'remarkCodeFences'],
  ['remarkLfmHeadingIds', 'remarkHeadingIds'],
  ['remarkLfmWikilinks', 'remarkLosslessWikilinks'],
];

/** Tier 3 — our syntax, our handling, no formal prior art. */
const TIER_3 = [
  ['lfmLinkPreview', 'remarkLinkPreview'],
  ['lfmOgFetcher', 'remarkOgFetcher'],
  ['lfmImageCarousel', null],
  ['lfmHeadingBlocks', null],
];

test('every plugin is exported and callable', () => {
  for (const [canonical] of [...TIER_2, ...TIER_3]) {
    assert.equal(typeof lfm[canonical], 'function', `${canonical} is not exported`);
  }
  assert.equal(typeof lfm.remarkLfm, 'function', 'the preset is not exported');
});

test('deprecated aliases are identical to their canonical plugin', () => {
  for (const [canonical, alias] of [...TIER_2, ...TIER_3]) {
    if (!alias) continue;
    assert.equal(
      lfm[alias],
      lfm[canonical],
      `${alias} must remain a live alias of ${canonical} — consuming sites import it`,
    );
  }
});

test('no unshipped intermediate names leak out', () => {
  const neverShipped = [
    'lfmCallouts',
    'lfmCitations',
    'lfmCodeFences',
    'lfmHeadingIds',
    'lfmWikilinks',
  ];
  for (const name of neverShipped) {
    assert.equal(
      lfm[name],
      undefined,
      `${name} was an intermediate rename that never published; it is owed no alias`,
    );
  }
});

test('helpers ship alongside their plugin', () => {
  for (const fn of ['slugifyHeading', 'nestHeadings', 'filterHeadings', 'parseMarkdown', 'createLfmProcessor']) {
    assert.equal(typeof lfm[fn], 'function', `${fn} is not exported`);
  }
});

test('heading-block constants are exported for consumers matching on them', () => {
  assert.deepEqual([...lfm.EYEBROW_MARKERS], ['$$', '^^']);
  assert.equal(lfm.SUBHEADING_MARKER, '&&');
  assert.equal(lfm.HEADING_BLOCK_NAME, 'heading-block');
});
