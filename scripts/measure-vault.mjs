#!/usr/bin/env node
/**
 * measure-vault.mjs — reproduce every number quoted for path resolution.
 *
 * The measurement tables in README.md and in
 * `context-v/Maintain-Path-Resolution-for-Wikilinks.md` decided the defaults in
 * `src/utils/resolve-path.ts`: whether there is an index at all, whether
 * `basename` is in the cascade, whether ambiguity refuses to guess, whether
 * matching is case- and separator-insensitive.
 *
 * Those numbers were originally produced by throwaway scripts that were never
 * committed. Stating them as fact in a published package's documentation while
 * nobody could re-run them is an overclaim, and this file is the fix. Every row
 * printed here is a row in the README.
 *
 *   node scripts/measure-vault.mjs [vaultDir]      # default: ../content
 *   node scripts/measure-vault.mjs --json          # machine-readable
 *
 * The vault is NOT part of this repo — it is the sibling `content` repo. The
 * corpus moves under authors' hands, so re-running this will drift from the
 * committed table. That is expected: re-run it, and if a default no longer
 * follows from the numbers, change the default rather than the prose.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPathResolver } from '../dist/index.js';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const VAULT = resolvePath(args.find((a) => !a.startsWith('--')) ?? '../content');

const SKIP = new Set(['.git', 'node_modules', '.obsidian', 'dist', '.astro']);

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(full, rel));
    else if (entry.endsWith('.md')) out.push(rel);
  }
  return out;
}

// ---------------------------------------------------------------- the corpus
const tWalk0 = performance.now();
const files = walk(VAULT);
const tWalk = performance.now() - tWalk0;

// `![[embed]]` is an embed, not a navigational link — excluded, since the
// resolver is never asked to route one.
const WIKILINK = /(?<!!)\[\[([^\]]+)\]\]/g;

const links = [];
for (const f of files) {
  const body = readFileSync(join(VAULT, f), 'utf8');
  for (const m of body.matchAll(WIKILINK)) {
    // strip `#anchor` and `|display` — only the path is resolved
    const target = m[1].split('|')[0].split('#')[0].trim();
    if (target) links.push(target);
  }
}

// ------------------------------------------------------------- the questions
const bare = links.filter((l) => !l.includes('/'));
const pathed = links.filter((l) => l.includes('/'));
const relative = links.filter((l) => l.startsWith('./') || l.startsWith('../'));

const basename = (p) => p.slice(p.lastIndexOf('/') + 1).replace(/\.md$/i, '');
const byBasename = new Map();
for (const f of files) {
  const k = basename(f).toLowerCase();
  if (!byBasename.has(k)) byBasename.set(k, []);
  byBasename.get(k).push(f);
}
const colliding = [...byBasename.entries()].filter(([, v]) => v.length > 1);
const collidingFileCount = colliding.reduce((n, [, v]) => n + v.length, 0);
const uniqueBasenames = byBasename.size - colliding.length;

const collidingKeys = new Set(colliding.map(([k]) => k));
const bareHittingCollision = bare.filter((l) => collidingKeys.has(basename(l).toLowerCase()));

// drift — counted over LINKS, which is what the resolver actually sees
const firstSeg = (l) => l.split('/')[0];
const caseDrift = { Tooling: 0, tooling: 0 };
const sepDrift = { 'lost-in-public': 0, 'Lost in Public': 0 };
for (const l of pathed) {
  const s = firstSeg(l);
  if (s === 'Tooling') caseDrift.Tooling++;
  if (s === 'tooling') caseDrift.tooling++;
  if (s === 'lost-in-public') sepDrift['lost-in-public']++;
  if (s === 'Lost in Public') sepDrift['Lost in Public']++;
}

// ------------------------------------------------- tiers, via the real thing
const tIndex0 = performance.now();
const resolver = createPathResolver({
  index: files,
  // A catch-all so nothing is rejected for lack of a route: this measures which
  // TIER answers, not which destination a given site configures.
  routes: [{ match: '*', to: '/{slug}' }],
});
const tIndex = performance.now() - tIndex0;

const tResolve0 = performance.now();
const tiers = {};
let unresolved = 0;
for (const l of links) {
  const hit = resolver.resolve(l);
  if (!hit) unresolved++;
  else tiers[hit.via] = (tiers[hit.via] ?? 0) + 1;
}
const tResolve = performance.now() - tResolve0;

const exactAmongPathed = (() => {
  let n = 0;
  for (const l of pathed) {
    const hit = resolver.resolve(l);
    if (hit?.via === 'exact') n++;
  }
  return n;
})();

// ------------------------------- the documented four-route config, end to end
// README quotes a resolve-rate for the exact routes shown in its example. That
// claim is only checkable if the config is here too.
const DOC_ROUTES = [
  {
    match: ['concepts', 'vocabulary', 'organizations', 'sources'],
    to: 'https://www.lossless.group/more-about/{slug}',
  },
  { match: 'tooling', to: '/tools/{slug}' },
  { match: 'essays', to: '/essays/{slug}' },
];
const docDiags = [];
const docResolver = createPathResolver({
  index: files,
  routes: DOC_ROUTES,
  onDiagnostic: (d) => docDiags.push(d),
});
const docTiers = {};
let docResolved = 0;
for (const l of links) {
  const hit = docResolver.resolve(l);
  if (hit) {
    docResolved++;
    docTiers[hit.via] = (docTiers[hit.via] ?? 0) + 1;
  }
}
const docReasons = {};
for (const d of docDiags) docReasons[d.reason] = (docReasons[d.reason] ?? 0) + 1;

// -------------------------------------------------------------------- output
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0');
const data = {
  vault: VAULT,
  files: files.length,
  links: links.length,
  bare: bare.length,
  barePct: pct(bare.length, links.length),
  pathed: pathed.length,
  uniqueBasenames,
  uniqueBasenamePct: pct(uniqueBasenames, files.length),
  collidingBasenames: colliding.length,
  collidingFiles: collidingFileCount,
  bareHittingCollision: bareHittingCollision.length,
  bareHittingCollisionPct: pct(bareHittingCollision.length, bare.length),
  exactAmongPathed,
  exactAmongPathedPct: pct(exactAmongPathed, pathed.length),
  caseDrift,
  sepDrift,
  relative: relative.length,
  tiers,
  unresolved,
  ms: { walk: +tWalk.toFixed(1), index: +tIndex.toFixed(1), resolveAll: +tResolve.toFixed(1) },
  usPerLink: +((tResolve * 1000) / Math.max(links.length, 1)).toFixed(2),
  docConfig: {
    resolved: docResolved,
    resolvedPct: pct(docResolved, links.length),
    tiers: docTiers,
    reasons: docReasons,
  },
};

if (asJson) {
  console.log(JSON.stringify(data, null, 2));
} else {
  const row = (fact, value, decided) =>
    console.log(`| ${fact.padEnd(38)} | ${String(value).padEnd(22)} | ${decided} |`);
  console.log(`\nVault: ${VAULT}`);
  console.log(`${data.files} files, ${data.links} wikilinks (embeds excluded)\n`);
  console.log(`| ${'Fact'.padEnd(38)} | ${'Value'.padEnd(22)} | What it decided |`);
  console.log(`|${'-'.repeat(40)}|${'-'.repeat(24)}|---|`);
  row('Wikilinks with no folder', `${data.bare} — ${data.barePct}%`, 'there is an index at all');
  row('Basenames globally unique', `${data.uniqueBasenames} — ${data.uniqueBasenamePct}%`, '`basename` is in the cascade');
  row('Colliding basenames', `${data.collidingBasenames} (${data.collidingFiles} files)`, 'ambiguity refuses to guess');
  row('Bare links hitting a collision', `${data.bareHittingCollision} — ${data.bareHittingCollisionPct}%`, 'the refusal costs almost nothing');
  row('Exact-path hits among pathed', `${data.exactAmongPathed} — ${data.exactAmongPathedPct}%`, '`exact` is tier one');
  row('Case drift', `Tooling ${caseDrift.Tooling} / tooling ${caseDrift.tooling}`, '`caseSensitive: false` default');
  row('Separator drift', `${sepDrift['lost-in-public']} / ${sepDrift['Lost in Public']}`, '`looseSeparators: true` default');
  row('Literal ../ or ./ links', data.relative, 'relative support is never assumed');
  console.log(`\nTiers that answered: ${JSON.stringify(data.tiers)}  unresolved: ${data.unresolved}`);
  console.log(
    `\nfs walk ${data.ms.walk}ms · index build ${data.ms.index}ms · resolve all ${data.links} links ${data.ms.resolveAll}ms → ${data.usPerLink}µs per link`,
  );
  console.log(
    `\nREADME's four-route example, no catch-all: ${data.docConfig.resolved} of ${data.links} resolve (${data.docConfig.resolvedPct}%)` +
      `\n  by tier: ${JSON.stringify(data.docConfig.tiers)}` +
      `\n  refused: ${JSON.stringify(data.docConfig.reasons)}\n`,
  );
}
