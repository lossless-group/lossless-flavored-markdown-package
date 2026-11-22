---
site_uuid: 0c9d7e2a-5b31-4f8e-8a6d-3e1f9b4c2a70
hex_code: b7w4cd
title: "In the Browser"
lede: "Import LFM from a CDN and render markdown, hex-code citations included, in a page with no build step."
publish: true
date_created: 2026-11-21
date_modified: 2026-11-21
date_authored_initial_draft: 2026-11-21
date_authored_current_draft: 2026-11-21
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Browser
  - CDN
  - Publishing
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
---

# In the browser

`@lossless-group/lfm/browser` is LFM with nothing that needs Node. It loads in a
page with no build step: a Claude artifact, a CodePen, a plain HTML file. It
has the parser, the `remarkLfm` preset and every plugin, citations included.

It leaves out one thing: Open Graph fetching (`lfmOgFetcher`, `OGDispatcher`,
`OGCache`), which keeps a cache file on disk. The `ogFetch` option is ignored
there, with a warning. Fetch link previews at build time with the root entry.

Syntax highlighting stays on its own subpath, `@lossless-group/lfm/highlight`,
so parsing doesn't download Shiki. The code-fence formats on `/formats` are
browser-safe too, except `/formats/plantuml`.

## From a CDN

The package is on the public npm registry, so jsDelivr, unpkg and esm.sh all
serve it. Pin a version: replace `<version>` below with one from
[npm](https://www.npmjs.com/package/@lossless-group/lfm?activeTab=versions).

| CDN | URL |
|---|---|
| jsDelivr | `https://cdn.jsdelivr.net/npm/@lossless-group/lfm@<version>/browser/+esm` |
| esm.sh | `https://esm.sh/@lossless-group/lfm@<version>/browser` |
| unpkg | `https://unpkg.com/@lossless-group/lfm@<version>/dist/browser.js` (raw file: needs an import map for its dependencies) |

jsDelivr's `+esm` reads the package's `exports` map, so `/browser/+esm` works,
and it bundles LFM's dependencies for the browser. The file path works too:
`https://cdn.jsdelivr.net/npm/@lossless-group/lfm@<version>/dist/browser.js/+esm`.

## Render to HTML

LFM produces an MDAST. To get HTML, run it through `remark-rehype` and
`rehype-stringify`:

```html
<div id="out"></div>
<script type="module">
  import { unified } from 'https://cdn.jsdelivr.net/npm/unified@11/+esm';
  import remarkRehype from 'https://cdn.jsdelivr.net/npm/remark-rehype@11/+esm';
  import rehypeStringify from 'https://cdn.jsdelivr.net/npm/rehype-stringify@10/+esm';
  import { parseMarkdown } from 'https://cdn.jsdelivr.net/npm/@lossless-group/lfm@<version>/browser/+esm';

  const markdown = `
  > [!note]
  > Hex-code citations are numbered by first appearance.

  A claim.[^a3f9b2] Another one.[^1ucdcd]

  [^1ucdcd]: [First Source](https://example.com/first)
  [^a3f9b2]: [Second Source](https://example.org/second) Published: 2026-01-15
  `;

  const tree = await parseMarkdown(markdown);                  // every LFM transform runs here
  const hast = await unified().use(remarkRehype).run(tree);    // MDAST to HTML tree
  let html = unified().use(rehypeStringify).stringify(hast);

  // LFM takes footnote definitions out of the tree and hands them over as
  // data, in citation order, so the page renders its own sources list. The
  // ids match the links remark-rehype puts on each [^hex].
  const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  html += '<ol class="sources">' + tree.data.citations.ordered.map((c) =>
    `<li id="user-content-fn-${esc(c.identifier)}">` +
    (c.url ? `<a href="${esc(c.url)}">${esc(c.title ?? c.url)}</a>` : esc(c.raw)) +
    '</li>').join('') + '</ol>';

  document.querySelector('#out').innerHTML = html;
</script>
```

`a3f9b2` renders as 1 and `1ucdcd` as 2, because that is the order they're
cited in, whatever order they're defined in. Each entry in
`tree.data.citations.ordered` carries `index`, `identifier`, `title`, `url`,
`source` and any `publishedDate`; see [Citations](citations.md).

Keep the two steps separate. In one chain,
`unified().use(remarkParse).use(remarkLfm).use(remarkRehype)`, the preset's
plugins are attached after `remark-rehype` and run on the HTML tree, so
callouts and citations are skipped. The issue is logged in
`context-v/issues/Preset-Transforms-Run-After-Later-Plugins.md`.

## With a bundler

In a project with a bundler, import the same subpath from the installed package:

```ts
import { parseMarkdown, remarkLfm } from '@lossless-group/lfm/browser';
```

Use it for client-side code (a live preview, an editor) so the bundle doesn't
pull in the Node-only modules the root entry re-exports.
