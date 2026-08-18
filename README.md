# @lossless-group/lfm

**Lossless Flavored Markdown** — MDX power without MDX's opinions.

A polyglot markdown pipeline where user-configured *syntax-triggers* normalize many authoring conventions (CommonMark + GFM, `remark-directive`, Obsidian callouts, hex-code citations, bare-URL embeds) into a single AST shape, ready for any framework's component pipeline. Plain `.md` files get the expressive power of MDX without the JSX-shaped lock-in.

One package, one import. Bundles unified, remark-parse, remark-gfm, remark-directive, and the LFM custom plugins.

**Live splash · feature gallery · changelog ·** [`lossless-group.github.io/lossless-flavored-markdown-package`](https://lossless-group.github.io/lossless-flavored-markdown-package/)

## The STC paradigm

LFM's whole pitch in three stages. Authors keep authoring in whatever syntax their tool prefers; a `remark` plugin matches the pattern (the *trigger*); the parser emits one canonical AST node a renderer dispatches to.

```mermaid
flowchart LR
    subgraph SYN["01 · Syntax — author"]
        S1[":::callout{type=warning}"]
        S2["&gt; [!warning] Title"]
        S3["bare youtu.be/{id}"]
        S4["[^a1b2c3]"]
    end

    subgraph TRG["02 · Trigger — LFM ships"]
        T1["remark-lfm-callouts"]
        T2["lfm-link-preview"]
        T3["remark-lfm-citations"]
    end

    subgraph CMP["03 · Component — your renderer"]
        C1["one MDAST callout node"]
        C2["one MDAST link-preview node"]
        C3["one MDAST citation node"]
    end

    S1 --> T1
    S2 --> T1
    S3 --> T2
    S4 --> T3
    T1 --> C1
    T2 --> C2
    T3 --> C3
```

The polyglot point: **the two arrows landing on `remark-lfm-callouts`.** A directive callout and an Obsidian callout block produce the *same* MDAST node, so your `<Callout>` component renders one shape regardless of which authoring tool wrote the file. Adding a new authoring syntax means a new normalizer plugin — no consumer changes, no renderer rewrites.

This package owns stages 01 + 02 (and the matching catalog at stage 01). The component renderer is yours.

## When to reach for LFM

- You want MDX-class richness (callouts, citations, embeds, custom components) but **don't want JSX in your markdown**.
- You have authors using **multiple tools** (Obsidian, plain editors, Astro CMS) and want their syntax preferences to converge to one rendered output.
- You're building an **Astro / Svelte / Solid / vanilla** site and want a parser that produces a normalized AST your components can render directly.
- You need **build-time OG / link-preview enrichment** without a runtime network round-trip.

If you want JSX-in-markdown specifically, use MDX. If you want CommonMark only, use `remark-parse` directly. LFM sits between them.

## Install

**Canonical: from JSR** — [jsr.io/@lossless-group/lfm](https://jsr.io/@lossless-group/lfm)

Two equivalent ways to consume from JSR with pnpm:

```jsonc
// package.json — npm-alias form (works on any pnpm version)
{
  "dependencies": {
    "@lossless-group/lfm": "npm:@jsr/lossless-group__lfm@^0.3.0"
  }
}
```

```ini
# .npmrc — required for the npm-alias form to resolve
@jsr:registry=https://npm.jsr.io
```

```jsonc
// package.json — pnpm jsr: protocol form (newer pnpm)
{
  "dependencies": {
    "@lossless-group/lfm": "jsr:^0.3.0"
  }
}
```

**Mirror on GitHub Packages** ([github.com/lossless-group/lossless-flavored-markdown-package/pkgs/npm/lfm](https://github.com/lossless-group/lossless-flavored-markdown-package/pkgs/npm/lfm)) is published as parity but isn't the recommended consumption path. If you do want it, add `@lossless-group:registry=https://npm.pkg.github.com` plus a `${GITHUB_TOKEN}` auth line to `.npmrc` and install as `@lossless-group/lfm@^0.3.0`.

**Astro consumers:** the sister scaffold `@lossless-group/lfm-astro` lives at [`../lfm-astro/`](../lfm-astro/) — components and integration glue for Astro sites. Not yet published; track its progress in the [astro-knots changelog](https://github.com/lossless-group/astro-knots/tree/master/changelog) and use this package directly in the meantime.

## Usage

### Simple (recommended)

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(markdownContent);
// tree is an MDAST — pass to your renderer
```

### As a remark preset

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkLfm } from '@lossless-group/lfm';

const processor = unified()
  .use(remarkParse)
  .use(remarkLfm);

const mdast = processor.parse(content);
const tree = await processor.run(mdast);
```

### Cherry-pick plugins

```ts
import { remarkLfmCallouts } from '@lossless-group/lfm';
```

## What's included

| Plugin | What it does |
|--------|-------------|
| remark-gfm | Tables, task lists, strikethrough, autolinks |
| remark-directive | `:::name{}` directive syntax parsing |
| remark-lfm-callouts | Obsidian `> [!type] Title` → directive normalization |
| remark-lfm-heading-ids | Stable, unique anchor id on every heading (`data.id`) + a document outline at `tree.data.headings`. One definition of what a fragment URL says, shared by every site. |
| remark-lfm-citations | Hex-code footnote renumbering + structured citation extraction |
| remark-lfm-wikilinks | Obsidian `[[Page]]` / `[[folder/Page#Section\|Display]]` → resolved `link` MDAST nodes via a site-supplied resolver. Internal vs external destinations are a per-site decision the package never bakes in. |
| remark-lfm-code-fences | Routes fenced code blocks to format handlers, stamping `data.fence`. Ships with an **empty** registry — you name the formats you want. Seven handlers included, none adding a dependency. |
| lfm-link-preview | `:::link-preview` / `:::link-rollup` directives → annotated AST nodes carrying `data.linkPreviewSpec` (the format taxonomy a renderer dispatches on) |
| lfm-og-fetcher | Build-time OpenGraph fetcher that enriches link nodes with `LinkPreviewData` (cache-backed, configurable backend) |
| lfm-image-carousel | `:::image-carousel` / `:::img-carousel` → one renderer-ready `data.carousel` payload with slides extracted and sequence variants ordered |
| lfm-heading-blocks | `$$` eyebrow / `&&` subheading bound to the adjacent heading → one `<hgroup>`, plus `eyebrow` on the outline entry |

Three prefixes, one rule. `remark-*` is the ecosystem's — `remark-gfm` and `remark-directive` are dependencies, not ours. `remark-lfm-*` means the remark ecosystem has a formal plugin for this capability and we do it our own way. `lfm-*` means we invented it — our syntax trigger, our handling, no upstream equivalent. Full rule: `context-v/blueprints/Naming-Plugins-Against-the-Remark-Ecosystem.md`.

Everything renamed in 0.5.0 kept its old export name as a **permanent alias** — `remarkCallouts`, `remarkHeadingIds`, `remarkOgFetcher` and the rest all still resolve, and a test asserts they do. Nothing needs changing on upgrade; the names above are simply what to write in new code.

The `remarkLfm` preset enables **gfm, directives, callouts, citations, heading-ids and heading-blocks** by default. Three are opt-in because each needs something from you: `remark-lfm-code-fences` needs formats registered, `remark-lfm-wikilinks` needs a resolver, and `lfm-og-fetcher` needs `enabled: true` because it makes network calls.

The plugins above are the **triggers** in [the STC paradigm](#the-stc-paradigm) — each one matches its own family of authoring syntaxes and normalizes them into one canonical MDAST shape. Adding a syntax is adding a normalizer plugin; consumers don't change.

## Options

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(content, {
  gfm: true,         // GFM features (default: true)
  directives: true,  // Directive syntax (default: true)
  callouts: true,    // Obsidian callout normalization (default: true)
  citations: true,   // Hex-code footnote renumbering (default: true)
  headingIds: true,     // Heading anchor ids + outline (default: true)
  headingBlocks: true,  // $$ eyebrow / && subheading binding (default: true)
  // codeFences: { formats: [yang, plantuml] }  // see Code-fence formats — opt-in
  // wikilinks: { resolver: ... }               // see Wikilinks — opt-in
});
```

## Heading blocks (eyebrow, heading, subheading)

Every card component you have ever built renders a three-part heading: a small label above, the headline, and a line of supporting text below. Markdown gives you one of the three.

```markdown
$$ Portfolio Operations
## Every email from a portco, filed as PDFs
&& Two passes, inventory before export — so you can verify coverage
```

```html
<hgroup class="heading-block">
  <p class="heading-block-eyebrow eyebrow">Portfolio Operations</p>
  <h2 id="every-email-from-a-portco-filed-as-pdfs">Every email from a portco, filed as PDFs</h2>
  <p class="heading-block-subheading subheading">Two passes, inventory before export</p>
</hgroup>
```

**Position is the entire rule.** The markers mean nothing on their own — `$$` is an eyebrow only when the very next line is a heading, `&&` a subheading only when the previous line was one. Everywhere else they are ordinary text. Everything else follows: no blank line between them, order fixed, the heading mandatory, either optional line omittable, any heading level.

That is also why it is safe on by default. A parser meeting a `$$` asks one question, and on almost every existing document the answer is no.

| Marker | Becomes | Rendered as | Required |
|---|---|---|---|
| `$$ ` (or `^^ `) | `eyebrow` | `<p class="heading-block-eyebrow eyebrow">` | No |
| `## ` | the heading | `<h2>` — any level | **Yes** |
| `&& ` | `subheadings[]` | `<p class="heading-block-subheading subheading">` | No |

**The class names are public API.** LFM ships no CSS, so they are the only thing you can style against. Each part carries two: the `heading-block-*` one is scoped to the block, which is what lets `.heading-block .eyebrow` outrank your own `.prose p`; the bare `eyebrow` / `subheading` is deliberate reuse of whatever your card components already style.

The eyebrow and subheading are `<p>`, never headings — the accessibility guidance for `hgroup`, and what keeps them out of your table of contents as sections that do not exist.

**On `$$` and LaTeX.** It is the display-math delimiter everywhere, and the positional rule defuses most of the overlap: a math block's next line is a formula, never an `##`. `^^` is an accepted alias from day one, so if math ever lands, `$$` can be deprecated for eyebrows without a content migration.

Degradation matters here, because this syntax lands in files read outside your renderer. In Obsidian, on GitHub, in any plain preview, `$$ Portfolio Operations` renders as literal text above the heading. Ugly, not broken, still readable.

## Table of contents (the heading outline)

`remarkLfmHeadingIds` gives every heading a stable, deduped anchor and attaches an ordered outline at `tree.data.headings`:

```ts
export interface LfmHeading {
  id: string;              // final anchor id, after dedupe
  text: string;            // plain text, markup stripped
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  duplicateOf?: string;    // this slug collided with an earlier heading
  synthetic?: boolean;     // text slugified to nothing; a positional id was used
  inContainer?: string;    // innermost enclosing callout / details / blockquote / listItem
  eyebrow?: string;        // when the heading is part of an eyebrow block
}
```

**`inContainer` is the one that makes a ToC possible.** A heading inside a `> [!warning]` callout is not a document section, but it still deserves an anchor — a share link into a callout is a link like any other. The outline records where it sits so you can leave it out of the ToC without taking its anchor away. It carries the container's *name* rather than a boolean, because a `details` heading is a navigable section while a callout one is an aside, and you may reasonably want to treat them differently.

Two pure folds ship alongside, for the same reason `slugifyHeading` does — every consumer writes them, and the edge cases (a document opening at `h3`, an `h2` → `h4` jump, a trailing `h6`) would each be got wrong independently:

```ts
import { nestHeadings, filterHeadings } from '@lossless-group/lfm';

const outline = (tree as any).data?.headings ?? [];

const toc = nestHeadings(
  filterHeadings(outline, 2, 3)            // depth band; drops `synthetic` entries
    .filter((h) => !h.inContainer),        // your call — asides out, sections in
);
// LfmHeadingNode[] — LfmHeading plus `children`, so anything you decorated survives
```

Depth gaps are **not** filled with placeholders: an `h4` under an `h2` becomes a direct child, because inventing an empty `h3` would put a waypoint in the ToC with no anchor to point at.

Components, layout, breakpoints, scroll tracking and measuring your pinned header stay out of the package, permanently. The seam: **LFM decides what a heading is called and where it sits; your render layer decides what the reader sees.**

## Image carousels

```markdown
:::image-carousel{variant="stepper" title="Setting up Aside"}
::image{src="/Welcome_20260817T164659Z.jpg" alt="Welcome screen" label="Welcome" caption="…"}
::image{src="/Recovery_20260817T171052Z.jpg" alt="Recovery key" label="Recovery key"}
:::
```

Slides are extracted (from `::image{}` directives or plain `![alt](src)`), the `img-carousel` alias collapses to one name, and order resolves — all into a single `data.carousel` payload, so every framework reads one contract instead of re-walking children.

Four variants: `filmstrip`, `stepper`, `peek`, `contact-sheet`. The first three are *sequences* and default to `sort="chronological"`, reading the ISO 8601 basic-format stamp the house image-prep convention appends to each filename. `contact-sheet` is excluded deliberately — it renders every frame at once, so there is no reading order to reorder.

> **The stamp marks a prep run, not a capture.** Every image from one invocation carries an identical stamp, so chronological ordering only ever reorders *across* batches. The sort is stable and falls back to `authoredIndex`, which makes the ordinary case correct — but an image belonging mid-sequence that was uploaded later will move to the end. `sort="authored"` opts out. There is a worked example of exactly this on the [demo page](https://lossless-group.github.io/lossless-flavored-markdown-package/demo/).

## Wikilinks (Obsidian-style internal/external resolution)

Obsidian wikilinks (`[[Page]]`, `[[Page|Display]]`, `[[folder/Page#Section|Display]]`) are first-class authoring vocabulary in vaults — and dead text in standard Markdown. `remarkLfmWikilinks` resolves them into proper `link` MDAST nodes against a **site-supplied resolver function**. The plugin owns the syntax (regex, MDAST splice, link node shape); each site owns its destinations (which prefix routes where, what's local vs external, what's intentionally parked).

This split exists because wikilink destinations are inherently per-site. The same `[[Vocabulary/Polyrepo]]` resolves to `lossless.group/more-about/polyrepo` from one site and `glossary.example.com/polyrepo` from another. Baking a default resolver into the package would be wrong for every consumer except the one we picked.

### Quick start

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(content, {
  wikilinks: {
    resolver: (input) => {
      const path = input.path.toLowerCase();

      // Internal: same-site routes (path-only URL, isLocal: true).
      if (path.startsWith('essays/')) {
        const slug = path.slice('essays/'.length).replace(/\s+/g, '-');
        return {
          url: `/essays/${slug}`,
          isLocal: true,
          display: input.display ?? input.path.split('/').pop() ?? '',
        };
      }

      // External: full URLs (isLocal: false → target="_blank" added).
      if (path.startsWith('vocabulary/') || path.startsWith('concepts/')) {
        const slug = path.replace(/^[^/]+\//, '').replace(/\s+/g, '-');
        return {
          url: `https://www.lossless.group/more-about/${slug}`,
          isLocal: false,
          display: input.display ?? input.path.split('/').pop() ?? '',
        };
      }

      // No match → render as plain display text. The plugin handles
      // the fallback display string automatically.
      return null;
    },
    onUnresolved: (input) => {
      console.log(`[wikilinks] unresolved: ${input.raw}`);
    },
  },
});
```

### Resolver contract

```ts
import type {
  WikilinkResolverInput,
  WikilinkResolution,
  WikilinkOptions,
} from '@lossless-group/lfm';

// Input — produced by the plugin from one [[...]] match.
interface WikilinkResolverInput {
  path: string;          // "Vocabulary/Build Systems"
  anchor: string | null; // "Section Heading" or null
  display: string | null;// author-supplied or null
  raw: string;           // the literal "[[...]]"
}

// Output — used verbatim to build the <a> node, OR null to render
// the wikilink as plain display text (no anchor, no class).
interface WikilinkResolution {
  url: string;          // "/essays/foo" or "https://..."
  isLocal: boolean;     // true → wikilink--local class, no target=_blank
  display: string;      // final visible text
  classes?: string[];   // extra CSS classes appended to the base
}
```

### Rendering

Resolved wikilinks emit standard `link` MDAST nodes with `data.hProperties.class` set to `wikilink wikilink--local` or `wikilink wikilink--external`. External wikilinks also get `target="_blank" rel="noopener noreferrer"`. **No custom MDAST node type, no custom renderer component required** — the regular link branch in your AstroMarkdown / rehype-react / etc. pipeline handles them.

```html
<!-- External -->
<a class="wikilink wikilink--external"
   target="_blank" rel="noopener noreferrer"
   href="https://www.lossless.group/more-about/build-systems">Build Systems</a>

<!-- Internal -->
<a class="wikilink wikilink--local"
   href="/essays/foo-bar">Foo Bar</a>
```

### What gets matched (and what doesn't)

The plugin walks `text` MDAST nodes only. Wikilink syntax inside fenced code blocks, inline code, and HTML stays literal:

````markdown
This [[Vocabulary/Polyrepo]] resolves.

But ` [[concepts/foo]] ` (inline code) does NOT.

```ts
const ex = '[[Tooling/Bazel]]'; // also untouched — code fence
```
````

### When the resolver returns `null`

Operating principle: *supporting 40% of intended wikilinks is better than supporting none.* Unresolved wikilinks render as plain prose — just the display string (or path's last segment, with `.md` stripped and hyphens turned to spaces). No `<a>`, no class, no markup hint. The optional `onUnresolved` callback fires once per unresolved match — typical use is piping into a build-time audit log.

### A worked example: per-site resolver with rule arrays

The recommended pattern for non-trivial sites is to declare prefix rules as data, not as `if`-branches in the resolver:

```ts
const PREFIX_RULES = [
  { prefix: 'essays/',     template: '/essays/{slug}',                                 isLocal: true },
  { prefix: 'tooling/',    template: 'https://www.lossless.group/toolkit/{slug}',      isLocal: false },
  { prefix: 'vocabulary/', template: 'https://www.lossless.group/more-about/{slug}',   isLocal: false },
  { prefix: 'concepts/',   template: 'https://www.lossless.group/more-about/{slug}',   isLocal: false },
];

const slugify = (s: string) =>
  s.split('/').map(seg => seg.trim().toLowerCase().replace(/\s+/g, '-')).join('/');

const resolver = (input: WikilinkResolverInput): WikilinkResolution | null => {
  const lower = input.path.toLowerCase();
  for (const rule of PREFIX_RULES) {
    if (lower.startsWith(rule.prefix)) {
      const tail = lower.slice(rule.prefix.length);
      return {
        url: rule.template.replace('{slug}', slugify(tail)),
        isLocal: rule.isLocal,
        display: input.display ?? input.path.split('/').pop() ?? '',
      };
    }
  }
  return null;
};
```

Adding a destination is then six lines in the rule array. The reference implementation in `mpstaton-site` adds two more rule shapes (`ExactRule` for one-off overrides, `DeferredRule` for "deliberately parked, don't keep showing up as untouched"). Both are optional.

## Code-fence formats (diagrams, schemas, UML)

A fenced code block is a natural place to author a diagram, and every project ends up hand-wiring a routing table inside its renderer to handle `mermaid`. `remark-code-fences` replaces that table with a registry that **ships empty** — it knows no formats until you name them, so a splash page never carries diagram knowledge it doesn't use.

### Quick start

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkLfmCodeFences } from '@lossless-group/lfm';
import { yang } from '@lossless-group/lfm/formats/yang';
import { mermaid, jsonSchema } from '@lossless-group/lfm/formats';

const processor = unified()
  .use(remarkParse)
  .use(remarkLfmCodeFences, { formats: [yang, jsonSchema, mermaid] });
```

Or through the preset:

```ts
await parseMarkdown(content, { codeFences: { formats: [yang, mermaid] } });
```

The plugin **annotates** the `code` node rather than replacing it:

```ts
node.data.fence = {
  format: 'yang',      // the handler's name
  parsed: { … },       // present when the handler supplied a `parse`
  error: 'why it failed',  // present instead of `parsed` when `parse` threw
};
```

That matters: a renderer that doesn't recognize a format still has a normal code block to fall back on, and a malformed diagram records an error instead of failing your build.

### Included handlers

None are registered by default. Import what you want.

| Handler | Fence languages | Produces | Who draws it |
|---|---|---|---|
| `yang` | `yang` | RFC 8340 tree diagram | nobody — it's text |
| `jsonSchema` | `json-schema` | schema tree, `$ref`s expanded | nobody — it's text |
| `plantuml` | `plantuml`, `puml`, `uml` | server URLs (`svg`, `png`, `editor`) | a PlantUML server, via `<img>` |
| `vegaLite` | `vega-lite`, `vl` | spec + `{ mark, channels, data }` | vega-embed, client-side |
| `mermaid` | `mermaid` | nothing — claims the language | mermaid.js, client-side |
| `graphviz` | `graphviz`, `dot` | nothing — claims the language | `@viz-js/viz` (WASM) |
| `jsonCanvas` | `jsoncanvas`, `canvas` | normalized `{ nodes, edges }` | your canvas renderer |

**None of them add a dependency.** "Supporting a diagram language" means three different things depending on who does the drawing, and the handlers are honest about which one applies.

### YANG and JSON Schema render as text

Both parse to a tree, so nothing ships to the browser:

````markdown
```yang
module acme { container system { leaf host-name { type string; } } }
```
````

```
module: acme
  +--rw system
     +--rw host-name?   string
```

YANG handles the real RFC 7950 grammar — `mandatory true` suppresses the `?`, `leaf-list` takes `*`, `presence` takes `!`, list keys render as `[key]`, `config false` propagates `ro` to every descendant, `uses` expands groupings inline, and rpc/notification get `x`/`n`. JSON Schema expands local `$ref`s with cycle detection.

### PlantUML needs no renderer

PlantUML covers the full UML surface Mermaid doesn't — class, activity, component, deployment, use-case — and rendering it usually means running Java. It doesn't have to. A PlantUML server accepts the source deflated and encoded into the URL path, and `node:zlib` is a runtime builtin:

```ts
const { svg, png, editor, kind } = node.data.fence.parsed;
// <img src={svg} alt={`PlantUML ${kind} diagram`} />
```

No client JavaScript, no package. Bare source is auto-wrapped in `@startuml`/`@enduml`.

> **The default server is the public plantuml.com instance, which means your diagram source travels to a third party inside the URL.** Fine for public docs; for anything else, self-host:
>
> ```ts
> import { createPlantUml } from '@lossless-group/lfm/formats/plantuml';
> const plantuml = createPlantUml({ server: 'https://uml.internal.example' });
> ```

`plantuml` is deliberately **not** re-exported from `/formats` — it imports a node builtin, and pulling that into the barrel would make it unusable in a browser. Import it by subpath.

### Writing your own handler

A handler is plain data plus an optional pure function, so you can publish one without coordinating with this package:

```ts
import type { FenceFormat } from '@lossless-group/lfm/types';

export const abc: FenceFormat<AbcTune> = {
  name: 'abc',
  match: ['abc', 'abc-notation'],
  parse: (raw) => parseAbc(raw),   // omit to merely claim the language
};
```

Throwing from `parse` is safe — the message lands on `data.fence.error` and the renderer falls back to source.

## OG fetching (build-time)

`lfmOgFetcher` walks the tree, finds external links and link-preview directives, fetches their OpenGraph metadata via a configurable backend, and annotates the AST with `LinkPreviewData`. Runs at parse time so renderers have everything they need with no client-side round-trip — popovers and previews appear instantly on hover.

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { remarkLfm, lfmOgFetcher } from '@lossless-group/lfm';

const processor = unified()
  .use(remarkParse)
  .use(remarkLfm)
  .use(lfmOgFetcher, {
    enabled: true,
    backend: 'direct',         // or 'opengraph-io' (with apiKey)
    timeout: 5000,             // ms — don't bump above 10s, one unreachable URL stalls the build
    maxConcurrent: 4,
    ttl: 60 * 60 * 24 * 7,     // 7 days, in seconds
    failCacheTtl: 60 * 60 * 24 // 1 day for failed fetches, in seconds
  });
```

Sites that need direct cache access import `OGCache`, `OGDispatcher`, `createOGDispatcher`, or `loadOGCache` for inspection or invalidation. The annotated `LinkPreviewData` shape aligns with the canonical Sources schema in `cite-wide` so a future "promote to canonical" pipeline is additive rather than a rename.

## Citations

Footnotes with hex-code identifiers get renumbered to display indices and lifted into a structured citation dataset on `tree.data.citations`:

```markdown
Global aging is accelerating.[^a1b2c3]
Healthcare costs are rising.[^d4e5f6]

[^a1b2c3]: 2024. [Population Ageing](https://example.com). Published: 2024-07-11
[^d4e5f6]: 2025. [Cost Drivers](https://example.com). Published: 2024-11-22
```

After `parseMarkdown(content)`, the MDAST is mutated in place:

- `footnoteReference` nodes carry `node.data.citationIndex` (the display number, e.g. `1`, `2`) and `node.data.citationHex` (the original identifier).
- `footnoteDefinition` nodes are removed from the tree.
- The full citation dataset (title, URL, source domain, published / updated dates, raw text, parsed flag) lives at `tree.data.citations.ordered` for a Sources-style component to render at the bottom of the article.

## Bare-link auto-unfurl (catalog ships now, plugin pending)

A URL on its own line — paragraph with a single autolink child — is the LFM signal that the author wants the URL rendered as an embedded player or rich card rather than a clickable link. The classification + dispatch pipeline:

```
bare URL paragraph                            // CommonMark + GFM autolink pass
       │
       ▼
remark-bare-link plugin (forthcoming)
       │  reads src/plugins/Bare-Link-Provider-Catalog.md
       │  matches host + path (+ query) against ordered providers
       ▼
leafDirective { provider, id, url, kind }     // standard MDAST directive node
       │
       ▼
renderer dispatches by directive name         // YouTubeEmbed, VimeoEmbed, etc.
```

**The catalog file** — `src/plugins/Bare-Link-Provider-Catalog.md` — ships with this package starting at 0.2.2. Its YAML frontmatter is the canonical record of supported providers; the body explains the matching rules. v0.2.2 catalog includes four `stable` providers:

| Provider | URL shapes | Directive | Component name |
|---|---|---|---|
| `youtube-video` | `youtu.be/{id}`, `youtube.com/watch?v={id}` | `::youtube-video` | `YouTubeEmbed` |
| `youtube-short` | `youtube.com/shorts/{id}` | `::youtube-short` | `YouTubeShortsEmbed` |
| `youtube-playlist` | `youtube.com/playlist?list={id}` | `::youtube-playlist` | `YouTubePlaylistEmbed` |
| `vimeo` | `vimeo.com/{id}` (incl. channels + unlisted hash), `player.vimeo.com/video/{id}` | `::vimeo` | `VimeoEmbed` |

Plus `planned` entries for Vimeo additions, Loom, Spotify, and SoundCloud — kept in the catalog as documented intent.

**Until `remark-bare-link` lands**, sites can run the same classification at render time. Reference implementation: `sites/mpstaton-site/src/lib/markdown/classify-bare-link.ts` in the [astro-knots monorepo](https://github.com/lossless-group/astro-knots) — a ~100-line pure classifier with `getBareLinkUrl(node)` (MDAST autolink shape detector) and `classifyBareLink(url)` (host/path/query matchers). It mirrors the catalog's matchers in TypeScript so consuming sites have the same dispatch behavior the future plugin will produce.

**Inline links stay autolinks.** The detector requires the paragraph to have *exactly one child* that's a `link` whose visible text equals its URL — so `Check this out https://youtu.be/...` mid-sentence stays a clickable link, not an embed. CommonMark's paragraph rule does the blank-line gating for free.

## Types

```ts
import type {
  LfmComponentNode,    // Normalized node from any trigger syntax
  LfmCalloutNode,      // Callout directive node
  Citation,            // Single citation: index, hex, title, url, source, dates, raw
  CitationsData,       // tree.data.citations shape: { map, ordered, warnings }
  LfmHeading,          // One entry in the tree.data.headings outline
  LfmHeadingNode,      // Nested form, from nestHeadings() — LfmHeading + children
  HeadingBlockData,    // data.headingBlock: { eyebrow?, subheadings[] }
  CarouselData,        // data.carousel: variant, sort, title, numbered, slides
  CarouselSlide,       // One slide, with capturedAt and preserved authoredIndex
  FenceFormat,         // A code-fence handler: name, match[], optional parse()
  FenceData,           // data.fence: { format, parsed?, error? }
  RemarkLfmOptions,    // Preset options
  LinkPreviewData,     // Annotated link metadata (canonical Sources-aligned)
  LinkPreviewSpec,     // What remark-link-preview stamps on directive nodes
  OGFetchOptions,      // lfmOgFetcher options (backend, ttl, timeout, etc.)
  OGFetchResult,       // What an OG backend returns
  OGBackendName,       // 'direct' | 'opengraph-io' | …
} from '@lossless-group/lfm';
```

## Tests

```bash
pnpm test        # builds, then runs the suite
pnpm test:only   # skip the build when dist/ is current
```

182 assertions, **zero test dependencies** — `node:test` and `node:assert` are already in the runtime. They run against `dist/`, not `src/`, so each run exercises the barrel exports, the tsup entry map and the built output rather than only the TypeScript.

A few of the files guard things that would otherwise fail silently somewhere else:

| File | Guards |
|---|---|
| `naming-contract` | Every deprecated export alias still resolves. Drop one and it breaks in a consuming repo weeks later, not here. |
| `export-parity` | `package.json` and `deno.json` declare the same subpaths. They drifted once, and the entire fence registry was unimportable from JSR for two releases. |
| `heading-ids` | The slugifier's *quirks* — extension stripping, `--` collapse, underscore survival. Published anchors depend on them. |
| `demo-fixtures` | The splash's demo examples still demonstrate what they claim, parsed from the real markdown files on disk. |

## Roadmap

Shipped at 0.2.x — directives, callouts, citations, link-preview annotation, OG fetching, the bare-link catalog.

Shipped at 0.4.x — heading anchor ids + document outline (`remark-heading-ids`), and code-fence format routing (`remark-code-fences`, which closes the old *remark-code-components* roadmap item).

### Incremental — extending the trigger catalog

- **remark-bare-link** — the parse-time plugin that consumes the bundled catalog and emits leaf directives (sites currently classify at render time)
- **remark-backlinks** — `[[wikilink]]` resolution
- **remark-toc** — auto-generated table of contents

### Paradigm-completing — broader polyglot reach

- **Markdoc `{% tag %}` normalization** — converge Markdoc-flavored content into the same AST
- **MDX-lite `<Component />` normalization** — accept MDX-shaped author syntax without JSX execution

That separation matters: incremental plugins extend what triggers exist; the polyglot work extends *which authoring conventions* converge to the canonical AST.

See the full spec: [Codifying a Comprehensive Extended Markdown Flavor and Shared Package](https://github.com/lossless-group/astro-knots/blob/master/context-v/specs/Codifying-a-Comprehensive-Extended-Markdown-Flavor-and-Shared-Package.md)

## What shipped when

See [`changelog/`](./changelog/) for entry-by-entry notes following the [Lossless changelog conventions](https://github.com/lossless-group/lossless-skills/tree/main/changelog-conventions). The same entries render on the [live splash](https://lossless-group.github.io/lossless-flavored-markdown-package/changelog/) with full-text search, tags, and date sorting.

## See also

- **Live splash** — [`lossless-group.github.io/lossless-flavored-markdown-package`](https://lossless-group.github.io/lossless-flavored-markdown-package/) · the package's own GitHub Pages presence: STC diagram, feature gallery, changelog, context-v notes, full-text search
- **Live demo** — [`/demo`](https://lossless-group.github.io/lossless-flavored-markdown-package/demo/) · every feature as a real markdown file beside the payload `parseMarkdown` actually returned, computed at build time. The same files are the fixtures the test suite runs against
- **Design system** — [`splash/DESIGN.md`](./splash/DESIGN.md) · token inventory + Ideogram creative brief for OG image generation, formatted to the [Google `@google/design.md`](https://github.com/google-labs-code/design.md) spec
- **Spec** — [Codifying a Comprehensive Extended Markdown Flavor and Shared Package](https://github.com/lossless-group/astro-knots/blob/master/context-v/specs/Codifying-a-Comprehensive-Extended-Markdown-Flavor-and-Shared-Package.md) · the full specification this package implements
- **Sister scaffold** — `@lossless-group/lfm-astro` (forthcoming) · components and integration glue for Astro consumers

## License

MIT
