---
site_uuid: 8db06ecd-9058-402e-b734-962bb995d605
hex_code: a688ef
title: "Code-Fence Formats"
lede: "Route fenced code blocks to format handlers for Mermaid, Graphviz, PlantUML, Vega-Lite, YANG, JSON Schema, and JSON Canvas."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Code-Fences
  - Mermaid
  - Diagrams
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Code-fence formats (diagrams, schemas, UML)

A fenced code block is a natural place to author a diagram, and every project ends up hand-wiring a routing table inside its renderer to handle `mermaid`. `remark-lfm-code-fences` replaces that table with a registry that **ships empty** — it knows no formats until you name them, so a splash page never carries diagram knowledge it doesn't use.

## Quick start

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

## Included handlers

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

## YANG and JSON Schema render as text

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

## PlantUML needs no renderer

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

## Mermaid

LFM recognizes a `mermaid` fence and leaves the drawing to your site. Register the handler, and each block comes through as a `code` node with `data.fence.format === 'mermaid'` and the diagram source in `node.value`. Hand that source to mermaid.js in the browser:

```ts
import mermaid from 'mermaid';

mermaid.initialize({ startOnLoad: false });
const { svg } = await mermaid.render('diagram-1', node.value);
mount.innerHTML = svg;
```

Until your renderer does this, a Mermaid block shows as an ordinary code block.

To match your site's colors, use Mermaid's `base` theme with `themeVariables` rather than fighting its generated styles with CSS. [`splash/src/lib/mermaid-theme.ts`](../splash/src/lib/mermaid-theme.ts) is a working version to copy, and the [demo page](https://lossless-group.github.io/lossless-flavored-markdown-package/demo/) shows it running.

## Writing your own handler

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
