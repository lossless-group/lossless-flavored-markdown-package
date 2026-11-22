/**
 * The browser entry, `@lossless-group/lfm/browser`.
 *
 * The root entry can't load in a browser: it re-exports the OG cache and
 * dispatcher, which import `node:fs`, `node:crypto` and `node:path`, and the
 * preset imports the OG fetcher statically. `/browser` exists so a page (a
 * Claude artifact, a CodePen, a static site with no build step) can import LFM
 * from a CDN such as jsDelivr and parse markdown, hex-code citations included.
 *
 * Two guards:
 *
 * 1. Bundle `dist/browser.js` for the browser with esbuild, dependencies
 *    included, and fail if anything in the graph imports a Node builtin. That
 *    is what jsDelivr's `+esm` and esm.sh do to the file, so a Node import that
 *    creeps in later (a new plugin, a new dependency) fails here instead of in
 *    someone's artifact.
 * 2. Render a sample through unified + remark-rehype + rehype-stringify, using
 *    only the browser entry, and check the citation numbering.
 *
 * Both read `dist/`, the artifact the CDNs serve. `pnpm test` builds first.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { build } from 'esbuild';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

import * as browser from '../dist/browser.js';
import * as root from '../dist/index.js';
import { md } from './helpers.mjs';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const builtins = new Set(builtinModules.filter((m) => !m.startsWith('_')));

/** True for `node:fs`, `fs`, `fs/promises` and the like. */
function isNodeBuiltin(specifier) {
  if (specifier.startsWith('node:')) return true;
  return builtins.has(specifier) || builtins.has(specifier.split('/')[0]);
}

/** Bundle the browser entry the way a CDN would, recording Node imports. */
async function bundleForBrowser() {
  const nodeImports = [];
  const result = await build({
    entryPoints: [join(pkgRoot, 'dist/browser.js')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
    plugins: [
      {
        name: 'record-node-builtins',
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (!isNodeBuiltin(args.path)) return undefined;
            nodeImports.push(`${args.path} (imported by ${relative(pkgRoot, args.importer)})`);
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });
  return { ...result, nodeImports, code: result.outputFiles[0].text };
}

const bundled = bundleForBrowser();

test('the browser entry bundles for the browser without a Node builtin', async () => {
  const { errors, nodeImports } = await bundled;
  assert.deepEqual(errors, [], 'esbuild should bundle dist/browser.js for platform "browser"');
  assert.deepEqual(
    nodeImports,
    [],
    'the browser entry must not import a Node builtin, directly or through a dependency',
  );
});

test('the browser bundle leaves out Node-only LFM modules and Shiki', async () => {
  const { metafile, code } = await bundled;
  const inputs = Object.keys(metafile.inputs);
  // Shiki is browser-safe but large, and parsing doesn't need it: it stays
  // behind the separate /highlight subpath.
  const unwanted = inputs.filter((p) => /og-cache|og-dispatcher|og-backends|plantuml|lfm-tasks|node_modules\/(\.pnpm\/)?shiki|@shikijs/.test(p));
  assert.deepEqual(unwanted, []);
  assert.doesNotMatch(code, /\bBuffer\.from\(/, 'Buffer is a Node global');
  assert.doesNotMatch(code, /from ["']node:/);
});

test('the browser entry exports the parser, the preset and every plugin', () => {
  for (const name of [
    'parseMarkdown',
    'createLfmProcessor',
    'remarkLfm',
    'remarkLfmCallouts',
    'remarkLfmCitations',
    'remarkLfmCodeFences',
    'remarkLfmHeadingIds',
    'lfmHeadingBlocks',
    'remarkLfmWikilinks',
    'lfmLinkPreview',
    'lfmImageCarousel',
    'lfmTaskMetadata',
    'remarkLfmMdx',
    'lfmCrossReferenceEmbeds',
    'remarkLfmComments',
    'createPathResolver',
    'classifyLink',
  ]) {
    assert.equal(typeof browser[name], 'function', `${name} should be exported from /browser`);
  }
});

test('the browser entry leaves out what needs Node', () => {
  for (const name of ['OGCache', 'loadOGCache', 'hashUrl', 'OGDispatcher', 'createOGDispatcher', 'lfmOgFetcher']) {
    assert.equal(browser[name], undefined, `${name} needs Node and should not be on /browser`);
    assert.notEqual(root[name], undefined, `${name} should still be on the root entry`);
  }
});

const sample = md`
  # Sources out of order

  The second source is cited first.[^a3f9b2] Then the first one.[^1ucdcd]
  And the second again.[^a3f9b2]

  > [!note]
  > A callout, for good measure.

  [^1ucdcd]: [First Source](https://example.com/first) Published: 2026-01-15
  [^a3f9b2]: [Second Source](https://example.org/second)
`;

test('the browser preset builds the same tree as the root preset', async () => {
  assert.deepEqual(await browser.parseMarkdown(sample), await root.parseMarkdown(sample));
});

test('hex-code citations render through remark-rehype, numbered by first appearance', async () => {
  // Two steps, on purpose: LFM's transforms run first, then remark-rehype.
  // In one chain, .use(remarkLfm).use(remarkRehype), the preset's plugins are
  // attached after remark-rehype and run on the HTML tree instead. See
  // context-v/issues/Preset-Transforms-Run-After-Later-Plugins.md.
  const lfm = unified().use(remarkParse).use(browser.remarkLfm);
  const tree = await lfm.run(lfm.parse(sample));
  const hast = await unified().use(remarkRehype).run(tree);
  const html = unified().use(rehypeStringify).stringify(hast);

  // In the text: a3f9b2 is cited first, so it is 1, and 1ucdcd is 2, even
  // though 1ucdcd is defined first. A repeat citation keeps its number.
  const refs = [...html.matchAll(/<a href="#user-content-fn-([^"]+)"[^>]*>(\d+)<\/a>/g)].map(
    ([, id, n]) => `${id}:${n}`,
  );
  assert.deepEqual(refs, ['a3f9b2:1', '1ucdcd:2', 'a3f9b2:1']);

  // LFM takes the definitions out of the tree and hands them over as data, so
  // the page renders its own sources list, in the same order.
  const { citations } = tree.data;
  assert.deepEqual(
    citations.ordered.map((c) => [c.index, c.identifier, c.title, c.url]),
    [
      [1, 'a3f9b2', 'Second Source', 'https://example.org/second'],
      [2, '1ucdcd', 'First Source', 'https://example.com/first'],
    ],
  );
  assert.deepEqual(citations.warnings, []);
  assert.doesNotMatch(html, /data-footnotes/, 'the definitions are data, not a GFM footnote section');

  // The rest of LFM came along: the callout is a directive, not a blockquote.
  assert.match(html, /<h1[^>]*>Sources out of order<\/h1>/);
  assert.doesNotMatch(html, /\[!note\]/);
  assert.match(html, /A callout, for good measure\./);
});
