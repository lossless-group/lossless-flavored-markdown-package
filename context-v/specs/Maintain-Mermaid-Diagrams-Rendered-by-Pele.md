---
date_created: 2026-11-21
date_modified: 2026-11-21
site_uuid: 9e1084b6-b199-4f68-8697-b76a662c2a97
publish: true
title: "Maintain Mermaid Diagrams Rendered by Pele"
lede: "Mermaid fences become SVG at build time, with no JavaScript and no Mermaid theme to fight. Pele, the Obsidian team's renderer, takes Mermaid text and returns themeable SVG, synchronously, with no DOM. LFM wires it in as an opt-in subpath, so the core package stays small."
slug: maintain-mermaid-diagrams-rendered-by-pele
at_semantic_version: 0.0.0.1
status: Draft
authors:
  - Michael Staton
augmented_with:
  - "Claude Code on Claude Opus 5.5"
tags:
  - Extended-Markdown
  - Render-Pipeline
  - Code-Fences
  - Mermaid
  - Diagrams
  - Pele
hex_code: hh2xun
date_authored_initial_draft: 2026-11-21
date_authored_current_draft: 2026-11-21
type: Specs
---

# Maintain Mermaid Diagrams Rendered by Pele

## Why

Today LFM recognizes a `mermaid` fence and stops. `formats/index.ts` says it plainly: "Recognition only — mermaid.js is a client-side renderer." Every site then draws diagrams its own way:

- `lfm/splash` loads mermaid.js and keeps `src/lib/mermaid-theme.ts`, a long file whose job is to stop Mermaid's injected `<style>` from making diagrams "look like a screenshot from another website".
- `astro-knots/sites/dark-matter` has `MermaidDiagram.astro` and `MermaidWrapper.astro`, which import `mermaid@11` from jsDelivr at runtime.
- `banner-site` has its own `ContentEnhancer.astro` path.

All of them need JavaScript in the reader's browser. So a memo exported to PDF, an RSS reader, a page with scripts off, and a preview an agent builds all show raw Mermaid source.

[Pele](https://github.com/obsidianmd/pele) is the Obsidian team's Mermaid renderer: MIT, `pele@1.13.0` on npm, docs at [pele.run](https://pele.run). Its contract fits LFM's own rules closely:

| LFM rule (from `remark-lfm-code-fences.ts`) | Pele (from its `AGENTS.md`, docs, and our test) |
| --- | --- |
| Nothing nondeterministic; identical markdown, identical output | "Identical inputs and text measurer must produce identical SVG." Confirmed: two renders of one source were byte-identical. |
| A malformed diagram must not fail a build | Throws a typed `PeleError` with `code`, `line`, `column`, `snippet`. Catchable, and precise enough to show the author. |
| LFM ships no CSS; sites theme with tokens | Colors and fonts are CSS variables (`--pele-*`) on the root `<svg class="pele">`. Light and dark switch with no re-render. |
| Browser entry has no Node imports | "Rendering must be synchronous, without DOM access." No runtime dependencies. Ran in plain Node. |

We usually keep our own Mermaid-to-SVG path. We're choosing Pele instead because it covers every diagram type built into Mermaid 12.1.0, tests its parsers against Mermaid's own parser specs with differential fuzzing, and is maintained by a team that renders Mermaid for millions of Obsidian notes.

## What we checked (2026-11-21)

From a scratch install of `pele@1.13.0` in Node 24:

- **Speed and determinism.** A five-line flowchart with a decision and a `click` link rendered in about 8 ms. A second render was byte-identical (2,678 characters).
- **Self-contained output.** The SVG has no `<style>` and no `<script>`. Colors go through inline custom properties with fallbacks, for example `--_bg:var(--pele-bg,#fff)`, so the SVG looks right with no stylesheet and themes when one is present.
- **Errors.** `flowchart LR\n A -->` throws `PeleError`, code `syntax`, line 2, with a caret snippet. `zenuml` throws code `unsupported-diagram`.
- **Links.** `click C "https://example.com"` comes back in `result.links` as `{ id: "C", href: "https://example.com/", internal: false }`.
- **Size.** `dist/pele.js` with every type is 729 KB raw and 274 KB gzipped. `pele/core` plus `pele/diagrams/<type>` lets a consumer register only the types it uses.

## Decisions

### 1. Render at build time, enhance in the browser

There are two tiers, and the first one is the point:

1. **Static SVG at build time.** A rehype plugin renders each Mermaid fence to SVG with Pele's `render()` while the page is built. That makes the page complete with no JavaScript: exports, PDFs (WeasyPrint draws inline SVG), feeds, and agent previews all get the diagram.
2. **Optional browser enhancement.** A small helper calls Pele's `mount()` on those figures. It re-renders at the container's real width, measures the site's real font, and adds pinch and wheel zoom. Sites opt in. Without it, the static SVG still shrinks to fit (`responsive: true`, Pele's default).

### 2. A subpath, with Pele as an optional peer dependency

The core package doesn't import Pele. A new entry, `@lossless-group/lfm/mermaid`, does. Pele is an optional `peerDependency`, so a splash page that never draws a diagram never installs 2.4 MB of renderer.

This follows the existing line in `formats/index.ts`: "Anything needing a third-party parser or a client-side renderer belongs in a companion package, not here." A subpath with an optional peer dependency is the lightest form of that companion. Shiki is the exception that went in as a full dependency; Pele shouldn't follow it, because most consumers draw no diagrams.

### 3. The mdast `code` node is still annotated, never replaced

The fence plugin's rule holds. In the markdown tree, a Mermaid fence stays a `code` node, and the new format only adds facts to `data.fence`. Replacement with SVG happens later, in the HTML tree (hast), where it belongs. A renderer that doesn't run the rehype step still gets readable source.

### 4. The existing `mermaid` format stays as it is

`mermaid` from `@lossless-group/lfm/formats` stays recognition-only, so sites already using mermaid.js don't change. The new format, `mermaidPele`, claims the same language, `mermaid`. A site registers one or the other, not both. If both are registered, the last one wins, as the registry does today; the docs say so.

### 5. Anything Pele can't draw falls back to the source

On any `PeleError`, the output is the original code block with a short error line, never an empty box and never a failed build. That covers syntax errors, an unregistered type, a limit hit, and types Pele doesn't support, such as ZenUML and other external Mermaid plugins. We don't fall back to mermaid.js. A site that needs ZenUML keeps using the recognition-only format.

## The API

```ts
import { mermaidPele, rehypeLfmMermaid, mountLfmMermaid } from '@lossless-group/lfm/mermaid';
```

### `mermaidPele`: the fence format

```ts
export const mermaidPele: FenceFormat<MermaidFence> = {
  name: 'mermaid',
  match: ['mermaid'],
  parse(raw) { /* pele.parse(raw); return the facts below, or throw */ },
};

interface MermaidFence {
  type: string;          // Pele's name, e.g. 'flowchart'
  mermaidType: string;   // Mermaid's name, e.g. 'flowchart-v2'
  title?: string;        // from frontmatter or accTitle, for alt text
}
```

Its `parse` runs Pele's `parse()` to check the source and records only small, serializable facts. The model itself isn't stored: it isn't JSON, and rendering needs width and font, which the parse step doesn't have. If `parse` throws, the fence plugin already records the error in `data.fence.error`, and the renderer falls back to the source.

**Known gap.** The fence plugin records `error` as a message string only. Pele also gives `code`, `line`, and `column`. Widen `FenceData` with an optional `errorDetail: { code?: string; line?: number; column?: number }`. The change is additive.

### `rehypeLfmMermaid`: build-time SVG

```ts
unified()
  .use(remarkParse)
  .use(remarkLfmCodeFences, { formats: [mermaidPele] })
  .use(remarkRehype)
  .use(rehypeLfmMermaid, options)
  .use(rehypeStringify);
```

It finds every `<pre><code class="language-mermaid">` and replaces it with:

```html
<figure class="lfm-mermaid" data-lfm-mermaid="flowchart" data-lfm-mermaid-id="m-3f9a2c">
  <svg class="pele pele-flowchart" …>…</svg>
  <pre class="lfm-mermaid__source" hidden><code class="language-mermaid">…source…</code></pre>
</figure>
```

- **The source stays in the page**, hidden, so the browser enhancement can re-render, copy buttons keep working, and a reader can view it.
- **Ids are derived, not random.** `idPrefix` is `m-` plus a short hash of the source and its position among the page's Mermaid fences. Two identical diagrams on one page don't share ids, and the same page builds the same way twice. Pele requires a unique prefix per diagram on a page.
- **Errors render as source plus a message.** The output is `<figure class="lfm-mermaid lfm-mermaid--error">`, holding the visible `<pre>` and a `<p class="lfm-mermaid__error">` with the message as text. The message contains diagram source, so it goes in as a text node, never as HTML; Pele's security page asks for exactly that.

Options pass a fixed subset through to Pele. Authors never set them; the site does:

| Option | Default | Why |
| --- | --- | --- |
| `fontFamily`, `fontFamilyMono` | `sans-serif`, `monospace` | Pele measures labels in this font. Use the site's body font, and the same value as `--pele-font` in CSS. |
| `fontSize` | `16` | Match the body size. |
| `now` | **required when a Gantt chart is present** | Gantt charts default to the current time, which breaks determinism. Pass the document's `date_modified` or a build timestamp. If neither is given, use `0` and warn once. |
| `links`, `linkSchemes`, `linkRel` | on; `http`, `https`, `mailto`; `noopener` | Pele's defaults, minus `tel`. |
| `images`, `imageSchemes` | `false` | Images in diagrams make network requests when shown. Off for exports and memos; sites can turn them on. |
| `limit`, `outputLimit`, `maxEdges` | Pele's defaults (50,000 / 4,000,000 / 5,000) | Already sensible. |
| `icons` | none | Pele inserts icon markup unfiltered. A site that wants `fa:` icons supplies a resolver over a trusted set. |
| `math` | none | Same rule. The site supplies a KaTeX or MathJax resolver if it wants `$$…$$` in labels. |
| `types` | all | Optional list such as `['flowchart', 'sequence']`. Registers only those types from `pele/core`, for smaller builds. |

Hand-written `%%{init}%%` and frontmatter `config:` in the diagram still apply. Pele reads them, and colors set in the source are fixed by design.

### `mountLfmMermaid`: optional browser enhancement

```ts
import { mountLfmMermaid } from '@lossless-group/lfm/mermaid/client';
mountLfmMermaid(document, { zoom: 'auto' });
```

For each `figure.lfm-mermaid` without the error class, it reads the hidden source and calls Pele's `mount()` with the same `idPrefix`. That re-renders at the container's width, picks up `--pele-font` from CSS, re-measures once web fonts load, and adds zoom. It returns the `Mounted` handles so a site can `destroy()` them on page transitions; Astro view transitions need this. It lives in its own subpath, `/mermaid/client`, so a server-only consumer never bundles DOM code.

For pages with no build step, such as agent work artifacts, both packages are on jsDelivr:

```html
<script type="module">
  import { renderMarkdownToHtml } from '…/@lossless-group/lfm@0.12.0/browser/+esm'; // once 0.12.0 ships
  import { mount } from 'https://cdn.jsdelivr.net/npm/pele@1.13.0/dist/pele.js';
</script>
```

Pin exact versions in pages. Pele's docs suggest `@1` for convenience, but our artifact rules want an exact version.

## Theming

Map site tokens to Pele's variables once, in the site's CSS. This replaces `mermaid-theme.ts` and the Mermaid `themeVariables` work:

```css
.lfm-mermaid .pele {
  --pele-bg: var(--color-surface);
  --pele-fg: var(--color-text);
  --pele-muted: var(--color-text-muted);
  --pele-line: var(--color-text);
  --pele-surface: var(--color-surface-raised);
  --pele-surface-alt: var(--color-surface-sunken);
  --pele-border: var(--color-border);
  --pele-accent: var(--color-accent);
  --pele-critical: var(--color-danger);
  --pele-error: var(--color-danger);
  --pele-font: var(--font-body);
  --pele-font-mono: var(--font-mono);
  --pele-radius: var(--radius-sm);
  /* charts: --pele-series-1 … --pele-series-8 */
}
```

Because these are custom properties resolved by the browser, the three-mode contract (light, dark, vibrant) from the `theme-system` skill works for free: change the tokens and the diagram follows with no re-render. Charts should map `--pele-series-1` to `-8` to the site's categorical palette. Pele draws some text in `--pele-bg` on series colors, so check contrast in every mode.

LFM still ships no CSS. `docs-v/mermaid.md` will carry this block as a pattern to copy, as `mermaid-theme.ts` does today.

## Fonts: the one real catch

Pele sizes each node from the measured width of its label. In a browser it measures with a canvas. At build time there is no canvas, so it estimates from a built-in table of Arial widths, and `fontFamily` only names the font that's drawn.

So a static SVG built for a font much wider or narrower than Arial can have labels that crowd or float in their boxes. Three mitigations, in order of cost:

1. Accept it. For sans-serif body fonts the difference is small, and Pele's own responsive scaling hides most of it.
2. Enable `mountLfmMermaid`. It re-renders with real measurements as soon as the page loads.
3. Pass a `measurer`. LFM could later offer one built from a font's metrics (for example with `opentype.js` at build time). This is out of scope for v1 and noted under open questions.

## Wikilinks and internal links

Obsidian users write `click B "Some Note"` to link a node to a note. Pele reports each link in `result.links` with an `internal` flag. In our test, a bare note name came back with `internal: false`, so the exact rule for "internal" needs confirming in Pele's source before we depend on it.

Plan: when `rehypeLfmMermaid` is given the same `resolver` that `remarkLfmWikilinks` uses, it rewrites each link whose `href` resolves as a note name to the site route, through the `<a>` elements Pele emits (`data-id` matches `LinkInfo.id`). With no resolver, it leaves them as Pele drew them. Don't strip wikilinks from the source; the older site implementation did that, and `formats/index.ts` warns against it.

## Security

Markdown authors write the diagram text; the site controls the options. Following Pele's security page:

- Pele escapes text, drops JavaScript `click` callbacks, blocks `javascript:`, `data:` and `vbscript:` URLs, and filters styles.
- Options are never read from the document or its frontmatter. Frontmatter `config:` inside the diagram is Mermaid config, which Pele limits by design.
- Errors are inserted as text.
- `icons` and `math` resolvers are the site's responsibility and must use trusted sets. LFM supplies none.
- No time limit runs at build time. For untrusted content, such as a hosted service rendering partner uploads, run rendering in a worker that can be terminated. MemoPop's connector would need this if partners' text ever reaches it.

## Where this lands first

- **`lfm/splash`**: replace the mermaid.js path in `demo.astro` and retire `src/lib/mermaid-theme.ts`. This is the reference implementation.
- **MemoPop exports.** [[Render-Previews-and-Exports-with-LFM]] in the orchestrator plans a server-side LFM renderer for HTML and PDF exports. With this subpath, Mermaid in a memo becomes an SVG in the PDF instead of a code block.
- **`dark-matter` and `banner-site`**: later, on their own schedule. They keep working on the recognition-only format.

## Tests

Write these first, in `test/mermaid-pele.test.mjs`, and watch them fail.

| ID | Checks |
| --- | --- |
| LFM-MMD-01 | `mermaidPele.parse` returns `{ type: 'flowchart', mermaidType: 'flowchart-v2' }` for a flowchart, and throws on `flowchart LR\n A -->`. |
| LFM-MMD-02 | Through the preset, a bad fence keeps its `code` node and gets `data.fence.error` plus `errorDetail.line === 2`. |
| LFM-MMD-03 | `rehypeLfmMermaid` replaces a valid fence with `figure.lfm-mermaid` holding one `svg.pele` and the hidden source. |
| LFM-MMD-04 | Determinism: the same document renders to byte-identical HTML twice. |
| LFM-MMD-05 | Two identical diagrams on one page get different `idPrefix` values, and no `id` in the output repeats. |
| LFM-MMD-06 | A Gantt chart with no `now` renders with `now: 0` and logs one warning. With `now`, the output is stable. |
| LFM-MMD-07 | An error message containing `<img onerror>` in the diagram source appears as escaped text, not markup. |
| LFM-MMD-08 | `zenuml` falls back to the visible source with `lfm-mermaid--error`, and the build doesn't throw. |
| LFM-MMD-09 | The core entry and `/browser` don't import `pele`. Extend `test/browser-entry.test.mjs` to bundle `/browser` and assert `pele` is absent. |
| LFM-MMD-10 | `/mermaid` bundles for the browser with no Node builtins, using the same esbuild check as `/browser`. |
| LFM-MMD-11 | With a wikilink resolver, `click B "Some Note"` becomes an `<a>` to the resolved route; without one it's unchanged. |
| LFM-MMD-12 | `types: ['flowchart']` renders flowcharts and falls back to the source for a sequence diagram. |

## Phases

1. **Subpath and format.** Add `src/mermaid/index.ts` with `mermaidPele` and `rehypeLfmMermaid`. Add the optional peer dependency, the `./mermaid` export in `package.json`, the `tsup` entry, and the `deno.json` export with `npm:pele@^1.13.0`. Widen `FenceData` with `errorDetail`. Tests 01–10 and 12.
2. **Client helper.** Add `src/mermaid/client.ts` with `mountLfmMermaid` and the `./mermaid/client` export.
3. **Wikilinks.** Add resolver support. Test 11, after confirming Pele's `internal` rule.
4. **Splash migration.** Move `lfm/splash` over, delete `mermaid-theme.ts`, and add `docs-v/mermaid.md` with the theming block.
5. **Release** as 0.12.0, with notes in `changelog/releases/`. Update the `lossless-flavored-markdown` skill's `references/package-and-setup.md` to describe the new subpath.

## Open questions

- **Peer dependency or dependency?** An optional peer dependency keeps installs small but makes consumers add `pele` themselves. Shiki went in as a full dependency. This spec recommends the peer dependency.
- **JSR.** Deno resolves `npm:pele` fine. Check that JSR's type checker accepts an optional npm peer behind a subpath before the 0.12.0 tag.
- **Font metrics at build time.** Is a font-metrics `measurer` worth building, or is the browser enhancement enough? Decide after looking at real diagrams on two sites with non-Arial fonts.
- **Pele's "internal" links.** Read `src/svg` and the link filter in Pele to confirm what makes a link `internal` before Phase 3.
- **Upstream pace.** Pele went from 1.11.0 to 1.13.0 in five days (2026-10-26 to 2026-10-31). Pin the minor range (`^1.13.0`) and re-check at each LFM release.

## Related

- `src/plugins/remark-lfm-code-fences.ts`: the annotate-never-replace and determinism rules this spec keeps
- `src/formats/index.ts`: the recognition-only `mermaid` format, unchanged
- `docs-v/code-fences.md`: the format table that gains a `mermaidPele` row
- `docs-v/browser.md`: the `/browser` entry and the no-Node rule
- `splash/src/lib/mermaid-theme.ts`: retired in Phase 4
- [Pele docs](https://pele.run): [API](https://pele.run/api), [Theming](https://pele.run/theming), [Security](https://pele.run/security), [Compatibility](https://pele.run/compatibility)
