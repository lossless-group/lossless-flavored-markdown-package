/**
 * Vault-path → site-route resolution.
 *
 * The design point under test: **resolution policy is configuration, not
 * code**. Every judgment call the resolver makes — which tiers to trust, what
 * happens on a collision, what `{slug}` means, whether to defer — is a field
 * on a config object rather than a decision baked into the package.
 *
 * The numbers quoted in these tests come from the Lossless `content` vault as
 * measured 2026-08-23: 4,702 files, 13,846 wikilinks, 28% of them bare.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPathResolver, parseMarkdown, ofType, text } from './helpers.mjs';

/** A miniature vault that reproduces every drift the real one contains. */
const VAULT = [
  'tooling/Software Development/Programming Languages/Python.md',
  'tooling/Software Development/DevTools/Bazel.md',
  'vocabulary/Build Systems.md',
  'vocabulary/Monorepo.md',
  'concepts/Explainers for AI/Large Codebase AI.md',
  'organizations/Google.md',
  'sources/Some Article.md',
  'lost-in-public/Reports/A Report.md',
  'essays/How Docker Changed Everything.md',
  // The collision: two files, same basename, different folders.
  'concepts/Atomic Design.md',
  'vocabulary/Atomic Design.md',
];

const ROUTES = [
  // Four vault folders, one public index. This is the fold the whole feature
  // exists for: lossless.group/more-about/ serves concepts, vocabulary,
  // organizations and sources alike.
  {
    match: ['concepts', 'vocabulary', 'organizations', 'sources'],
    to: 'https://www.lossless.group/more-about/{slug}',
  },
  { match: 'tooling', to: '/tools/{slug}' },
  { match: 'essays', to: '/essays/{slug}' },
  { match: 'lost-in-public', to: '/lost-in-public/{slug}' },
];

const make = (extra = {}) => createPathResolver({ index: VAULT, routes: ROUTES, ...extra });

/* ------------------------------------------------------------------ */
/* Bare names — 28% of the real corpus                                 */
/* ------------------------------------------------------------------ */

test('a bare name resolves through the basename tier', () => {
  const r = make().resolve('Bazel');
  assert.equal(r.url, '/tools/bazel');
  assert.equal(r.via, 'basename');
  assert.equal(r.file, 'tooling/Software Development/DevTools/Bazel.md');
});

test('a bare name with a .md extension resolves the same way', () => {
  assert.equal(make().resolve('Bazel.md').url, '/tools/bazel');
});

test('the basename tier is a lookup, not a scan — it never inspects other files', () => {
  // Proxy for the performance contract: a resolver with no index does no work
  // and returns route-tier results, so nothing is ever globbed per link.
  const noIndex = createPathResolver({ routes: ROUTES });
  assert.equal(noIndex.size, 0);
  assert.equal(noIndex.resolve('tooling/Bazel').via, 'route');
});

/* ------------------------------------------------------------------ */
/* Collisions — report, never guess                                    */
/* ------------------------------------------------------------------ */

test('a colliding bare name resolves to nothing, so it renders as plain text', () => {
  // Measured: 73 of 4,622 basenames collide; only 0.7% of bare wikilinks land
  // on one. The policy is to lose the link rather than emit a wrong one.
  assert.equal(make().resolve('Atomic Design'), null);
});

test('a collision is reported as a diagnostic with its candidates', () => {
  const seen = [];
  make({ onDiagnostic: (d) => seen.push(d) }).resolve('Atomic Design');
  assert.equal(seen.length, 1);
  assert.equal(seen[0].reason, 'ambiguous');
  assert.equal(seen[0].candidates.length, 2);
});

test("onAmbiguous: 'first' picks deterministically instead of dropping", () => {
  const r = make({ onAmbiguous: 'first' }).resolve('Atomic Design');
  assert.equal(r.file, 'concepts/Atomic Design.md');
  // Deterministic across builds — sorted, not insertion-ordered.
  assert.equal(make({ onAmbiguous: 'first' }).resolve('Atomic Design').file, r.file);
});

test('onAmbiguous can be a function that applies the site’s own rule', () => {
  const r = make({
    onAmbiguous: (_input, candidates) => candidates.find((c) => c.startsWith('vocabulary/')) ?? null,
  }).resolve('Atomic Design');
  assert.equal(r.file, 'vocabulary/Atomic Design.md');
});

test('an ambiguity resolver that throws degrades to plain text rather than breaking the build', () => {
  const r = make({ onAmbiguous: () => { throw new Error('boom'); } }).resolve('Atomic Design');
  assert.equal(r, null);
});

/* ------------------------------------------------------------------ */
/* The drift the vault actually contains                               */
/* ------------------------------------------------------------------ */

test('case drift on the first segment resolves — Tooling vs tooling', () => {
  // 3,591 links say `Tooling/`, 38 say `tooling/`. Both must land.
  assert.equal(make().resolve('Tooling/Software Development/DevTools/Bazel').url, '/tools/bazel');
  assert.equal(make().resolve('tooling/Software Development/DevTools/Bazel').url, '/tools/bazel');
});

test('separator drift resolves — "Lost in Public" vs "lost-in-public"', () => {
  // 179 links say `lost-in-public/`, 8 say `Lost in Public/`.
  assert.equal(make().resolve('Lost in Public/Reports/A Report').via, 'exact');
  assert.equal(make().resolve('lost-in-public/Reports/A Report').via, 'exact');
});

test('a path written against an old layout still resolves via the suffix tier', () => {
  // The "files used to be scattered" case: the folder moved, the tail did not.
  const r = make().resolve('Explainers for AI/Large Codebase AI');
  assert.equal(r.via, 'suffix');
  assert.equal(r.file, 'concepts/Explainers for AI/Large Codebase AI.md');
});

test('a deep vault path flattens to a flat site route', () => {
  const r = make().resolve('Tooling/Software Development/Programming Languages/Python');
  assert.equal(r.url, '/tools/python');
  assert.equal(r.display, 'Python');
});

/* ------------------------------------------------------------------ */
/* Many-to-one route folding                                           */
/* ------------------------------------------------------------------ */

test('four vault folders fold onto one public route', () => {
  const r = make();
  assert.equal(r.resolve('vocabulary/Monorepo').url, 'https://www.lossless.group/more-about/monorepo');
  assert.equal(r.resolve('organizations/Google').url, 'https://www.lossless.group/more-about/google');
  assert.equal(r.resolve('sources/Some Article').url, 'https://www.lossless.group/more-about/some-article');
  assert.equal(r.resolve('concepts/Explainers for AI/Large Codebase AI').url,
    'https://www.lossless.group/more-about/large-codebase-ai');
});

test('isLocal is inferred from the template unless stated', () => {
  assert.equal(make().resolve('vocabulary/Monorepo').isLocal, false); // absolute URL
  assert.equal(make().resolve('tooling/Software Development/DevTools/Bazel').isLocal, true);
});

test('a route may deliberately park a path so it renders as plain text', () => {
  const r = createPathResolver({
    index: VAULT,
    routes: [{ match: 'tooling', to: null }, ...ROUTES],
  });
  assert.equal(r.resolve('tooling/Software Development/DevTools/Bazel'), null);
});

test('a catch-all route claims everything left over', () => {
  const r = createPathResolver({ index: VAULT, routes: [{ match: '*', to: '/x/{slug}' }] });
  assert.equal(r.resolve('essays/How Docker Changed Everything').url, '/x/how-docker-changed-everything');
});

test('a catch-all route does NOT rescue a collision', () => {
  // The failure mode this guards: an ambiguous path falling through to `*`
  // and emitting a confidently-wrong link. Ambiguity terminates resolution.
  const r = createPathResolver({ index: VAULT, routes: [{ match: '*', to: '/x/{slug}' }] });
  assert.equal(r.resolve('Atomic Design'), null);
});

/* ------------------------------------------------------------------ */
/* Everything is configuration                                         */
/* ------------------------------------------------------------------ */

test('the cascade is configurable — dropping suffix keeps basename', () => {
  const r = createPathResolver({ index: VAULT, routes: ROUTES, cascade: ['exact', 'basename'] });
  // Suffix-only match no longer resolves as suffix…
  assert.equal(r.resolve('Explainers for AI/Large Codebase AI').via, 'basename');
  // …but the bare tier still works.
  assert.equal(r.resolve('Bazel').via, 'basename');
});

test('an empty cascade disables index lookup entirely', () => {
  const r = createPathResolver({ index: VAULT, routes: ROUTES, cascade: [] });
  assert.equal(r.resolve('Bazel'), null);          // no route claims a bare name
  assert.equal(r.resolve('tooling/Bazel').via, 'route');
});

test('slugFrom is configurable per resolver and per route', () => {
  const tail = createPathResolver({ index: VAULT, routes: ROUTES, slugFrom: 'tail' });
  assert.equal(
    tail.resolve('tooling/Software Development/DevTools/Bazel').url,
    '/tools/software-development/devtools/bazel',
  );
  const perRoute = createPathResolver({
    index: VAULT,
    routes: [{ match: 'tooling', to: '/tools/{slug}', slugFrom: 'full' }, ...ROUTES],
  });
  assert.ok(perRoute.resolve('tooling/Software Development/DevTools/Bazel').url.startsWith('/tools/tooling/'));
});

test('custom template tokens cover what the built-ins do not', () => {
  const r = createPathResolver({
    index: VAULT,
    routes: [{ match: 'tooling', to: '/{shelf}/{slug}' }],
    tokens: { shelf: (parts) => parts.segments[1]?.toLowerCase().replace(/\s+/g, '-') ?? 'misc' },
  });
  assert.equal(r.resolve('tooling/Software Development/DevTools/Bazel').url,
    '/software-development/bazel');
});

test('an unknown token is left visible rather than silently blanked', () => {
  const r = createPathResolver({ index: VAULT, routes: [{ match: '*', to: '/{nope}/{slug}' }] });
  assert.equal(r.resolve('vocabulary/Monorepo').url, '/{nope}/monorepo');
});

test('base strips a mount prefix so a vault can live anywhere', () => {
  const r = createPathResolver({
    index: VAULT.map((p) => `src/generated-content/${p}`),
    base: 'src/generated-content',
    routes: ROUTES,
  });
  assert.equal(r.resolve('tooling/Software Development/DevTools/Bazel').url, '/tools/bazel');
});

test('caseSensitive and looseSeparators can both be turned off', () => {
  // Scoped to the exact tier so the assertion is about matching, not about
  // the basename tier rescuing it afterwards.
  const strict = createPathResolver({
    index: VAULT, routes: ROUTES, caseSensitive: true, looseSeparators: false,
    cascade: ['exact'],
  });
  assert.equal(strict.resolve('Tooling/Software Development/DevTools/Bazel'), null);
  assert.ok(strict.resolve('tooling/Software Development/DevTools/Bazel'));
});

test('under case sensitivity the basename tier still rescues a correctly-cased name', () => {
  // Worth pinning: strictness on the *path* should not cost you the bare-name
  // tier, which is the one carrying 28% of the corpus.
  const strict = createPathResolver({ index: VAULT, routes: ROUTES, caseSensitive: true });
  assert.equal(strict.resolve('Tooling/Software Development/DevTools/Bazel').via, 'basename');
});

/* ------------------------------------------------------------------ */
/* Relative paths                                                      */
/* ------------------------------------------------------------------ */

test('./ and ../ resolve against the document that wrote them', () => {
  const r = make();
  assert.equal(
    r.resolve('./Bazel', { from: 'tooling/Software Development/DevTools/Python.md' }).url,
    '/tools/bazel',
  );
  assert.equal(
    r.resolve('../../Programming Languages/Python', { from: 'tooling/Software Development/DevTools/Bazel.md' }).url,
    '/tools/python',
  );
});

test('a relative path with no context degrades instead of throwing', () => {
  assert.doesNotThrow(() => make().resolve('../../../Bazel'));
});

/* ------------------------------------------------------------------ */
/* Deferral — the queue, not a per-link scan                           */
/* ------------------------------------------------------------------ */

test('unresolvable paths can be queued and given a placeholder route', () => {
  const r = make({ deferred: { to: '/go/{path}', classes: ['is-provisional'] } });
  const out = r.resolve('Nowhere/At/All');
  assert.equal(out.via, 'deferred');
  assert.equal(out.url, '/go/Nowhere/At/All');
  assert.deepEqual(out.classes, ['is-provisional']);
});

test('the deferred queue deduplicates and counts, for a post-build pass', () => {
  const r = make({ deferred: { to: '/go/{path}' } });
  r.resolve('Nowhere/At/All');
  r.resolve('Nowhere/At/All');
  r.resolve('Somewhere Else');
  const q = r.deferred();
  assert.equal(q.length, 2);
  assert.equal(q[0].count, 2);           // most frequent first
  assert.equal(q[0].reason, 'not-in-index');
});

test('deferral can be scoped to collisions only', () => {
  const r = make({ deferred: { to: '/go/{path}', when: 'ambiguous' } });
  assert.equal(r.resolve('Nowhere/At/All'), null);       // not deferred
  assert.equal(r.resolve('Atomic Design').via, 'deferred');
});

/* ------------------------------------------------------------------ */
/* Integration with the wikilink plugin                                */
/* ------------------------------------------------------------------ */

test('wikilinks accept the declarative `paths` config end to end', async () => {
  const tree = await parseMarkdown('See [[Tooling/Software Development/DevTools/Bazel]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES } },
  });
  const [link] = ofType(tree, 'link');
  assert.equal(link.url, '/tools/bazel');
  assert.equal(link.data.hProperties.class, 'wikilink wikilink--local');
});

test('a bare wikilink resolves end to end', async () => {
  const tree = await parseMarkdown('See [[Bazel]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES } },
  });
  assert.equal(ofType(tree, 'link')[0].url, '/tools/bazel');
});

test('a colliding wikilink renders as plain text with no anchor', async () => {
  const tree = await parseMarkdown('See [[Atomic Design]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES } },
  });
  assert.equal(ofType(tree, 'link').length, 0);
  assert.ok(text(tree).includes('Atomic Design'));
  assert.ok(!text(tree).includes('[['), 'no raw wikilink syntax leaks to the reader');
});

test('an external fold gets target=_blank', async () => {
  const tree = await parseMarkdown('See [[vocabulary/Monorepo]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES } },
  });
  const [link] = ofType(tree, 'link');
  assert.equal(link.url, 'https://www.lossless.group/more-about/monorepo');
  assert.equal(link.data.hProperties.target, '_blank');
});

test('an author-supplied display wins over the derived one', async () => {
  const tree = await parseMarkdown('See [[Bazel|the build tool]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES } },
  });
  assert.equal(text(ofType(tree, 'link')[0]), 'the build tool');
});

test('preferAuthorDisplay: false normalises drifted display text away', async () => {
  const tree = await parseMarkdown('See [[Bazel|the build tool]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES, preferAuthorDisplay: false } },
  });
  assert.equal(text(ofType(tree, 'link')[0]), 'Bazel');
});

test('anchors survive resolution', async () => {
  const tree = await parseMarkdown('See [[Bazel#Getting Started]].\n', {
    wikilinks: { paths: { index: VAULT, routes: ROUTES } },
  });
  assert.equal(ofType(tree, 'link')[0].url, '/tools/bazel#getting-started');
});

test('a hand-written resolver still wins over paths — back-compatible', async () => {
  const tree = await parseMarkdown('See [[Bazel]].\n', {
    wikilinks: {
      resolver: () => ({ url: '/override', isLocal: true, display: 'Override' }),
      paths: { index: VAULT, routes: ROUTES },
    },
  });
  assert.equal(ofType(tree, 'link')[0].url, '/override');
});

test('wikilinks remain off when neither resolver nor paths is supplied', async () => {
  const tree = await parseMarkdown('See [[Bazel]].\n');
  assert.equal(ofType(tree, 'link').length, 0);
  assert.ok(text(tree).includes('[[Bazel]]'));
});
