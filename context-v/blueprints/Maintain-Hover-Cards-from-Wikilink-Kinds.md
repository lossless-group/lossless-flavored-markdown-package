---
date_created: 2026-11-18
date_modified: 2026-11-18
site_uuid: ad2ed7ae-33bf-430f-bb3a-cc8a30cb8ce8
hex_code: wvcorj
publish: true
title: "Maintain Hover Cards from Wikilink Kinds"
lede: "A wikilink to a person or a tool should be able to open that card on hover. LFM can make that a renderer switch instead of URL parsing, by naming what each link points at."
slug: maintain-hover-cards-from-wikilink-kinds
at_semantic_version: 0.0.0.1
authors:
  - Michael Staton
augmented_with:
  - "Claude Code on Claude Opus 5.5"
tags:
  - Extended-Markdown
  - Wikilinks
  - Hover-Cards
  - Consumer-Contract
  - Render-Pipeline
image_prompt: "A row of brass name plates set into a page of text; one, touched by a fingertip, lifts out of the page and unfolds into a small portrait card hovering just above the line."
date_authored_initial_draft: 2026-11-18
date_authored_current_draft: 2026-11-18
type: Blueprints
---

# Maintain Hover Cards from Wikilink Kinds

## Why care?

Our write-ups name people and tools constantly. A reader who wants to know who
someone is, or what a tool does, has to leave the sentence. A **hover card**
answers in place: hover the name and its card opens, with a link through. The
name is the established one: Radix and shadcn ship a `HoverCard` primitive, and
GitHub calls its version "hovercards".

The site work is small. What LFM can add is the part every site would otherwise
reinvent: knowing **what kind of thing a link points at**.

## What exists today

FullStack VC shipped hover cards on 2026-11-18 without any LFM change
(`astro-knots/sites/fullstack-vc`, `src/components/markdown/HoverCard.astro`;
the site pattern is the astro-knots blueprint
[[Hover-Cards-for-People-and-Tool-Links]]). It works like this:

1. `remarkLosslessWikilinks` resolves `[[georgebabu|George Babu]]` to a `link`
   node pointing at `/people/georgebabu`.
2. The site's resolver returns `classes: ['wikilink--person']`, which LFM
   already appends to `data.hProperties.class`.
3. The renderer matches the URL against `/people/<handle>` and `/tools/<handle>`
   and draws a `HoverCard` for those links.

Step 3 is the weak point. The renderer re-derives, by regex on the URL, what the
resolver already knew. Every site will write that regex differently, and it
breaks the day a route moves.

## The proposal: links carry their kind

Let a resolution name what it points at, and have LFM stamp that onto the node.

```ts
// types/index.ts — additive; every field optional
export interface WikilinkResolution {
  url: string;
  isLocal: boolean;
  display: string;
  classes?: string[];
  /** What the link points at, for renderers that treat kinds differently:
   *  'person' | 'tool' | 'page' | … — the vocabulary is the site's. */
  kind?: string;
  /** Kind-specific identity, e.g. { handle: 'georgebabu' }. Plain JSON. */
  data?: Record<string, string | number | boolean>;
}
```

LFM writes it to the link node, next to the existing `hProperties`:

```ts
linkNode.data = {
  hProperties: { class: 'wikilink wikilink--local wikilink--person' },
  wikilink: { kind: 'person', target: 'georgebabu', data: { handle: 'georgebabu' } },
};
```

The declarative `paths` resolver gains the same field per route, so sites that
resolve by config don't need a hand-written function:

```ts
paths: {
  routes: [
    { match: 'people', to: '/people/{slug}', kind: 'person' },
    { match: 'tools',  to: '/tools/{slug}',  kind: 'tool' },
  ],
}
```

When `kind` is set and `classes` isn't, LFM adds `wikilink--{kind}` itself, so
CSS can target kinds with no extra config.

### What the renderer does with it

```astro
{type === 'link' && (() => {
  const wl = node.data?.wikilink;
  if (wl?.kind === 'person' || wl?.kind === 'tool') {
    return <HoverCard href={node.url} kind={wl.kind} handle={wl.data.handle}>…</HoverCard>;
  }
  return <a href={node.url}>…</a>;
})()}
```

No URL parsing, and a renderer that doesn't know a kind just draws the link.

## Rules for the card itself

These belong to the site renderer, not LFM, but every implementation should
follow them. They came out of FullStack VC's first build.

- **Carry the card in a `<template>`.** Wikilinks sit inside paragraphs, and a
  card is block markup: a `<div>` inside a `<p>` makes the browser close the
  paragraph early. `<template>` is valid phrasing content and isn't rendered;
  one script clones it into a single floating popover.
- **Fill cards at build time.** The renderer looks the entity up while
  rendering. Nothing is fetched on hover.
- **Never card something private.** A person whose profile isn't public gets a
  plain link. The card is a second publication surface; treat it as one.
- **Delay in, delay out.** Open after ~250ms so skimming doesn't flash cards;
  close after ~180ms so the pointer can move into the card.
- **Keyboard and phones.** Focus opens it, Escape closes it. Touch devices
  don't hover: a tap follows the link.
- **One popover per page,** positioned above or below the link, whichever has
  room, and hidden on scroll.

## Relation to link previews

LFM already has *link previews*: `:::link-preview` and the build-time Open
Graph fetcher, which unfurl **external** URLs **inline**, as part of the page.
Hover cards are the other half of the same idea, for **internal** entities,
**on demand**. Keep the names separate: a "link preview" is in the document; a
"hover card" appears when you ask.

## Status and next steps

- **Shipped site-side:** fullstack-vc, 2026-11-18, via `classes` and URL matching.
- **Proposed for LFM:** `kind` and `data` on `WikilinkResolution` and on path
  routes, and `node.data.wikilink` on the emitted link. Additive and optional;
  a minor release. Tests: a kind stamps `data.wikilink` and the derived class;
  no kind leaves the node exactly as today.
- **Then:** move fullstack-vc's renderer from URL matching to `data.wikilink`,
  and add the reference `HoverCard` to `packages/lfm-astro` for other sites to copy.

## See also

- [[Maintain-Path-Resolution-for-Wikilinks]]: the declarative `paths` resolver this extends
- [[Maintain-Heading-Anchors-and-Share-Links]]: the same "identity as data, affordance in the renderer" split
- astro-knots blueprint [[Hover-Cards-for-People-and-Tool-Links]]: the site-side pattern
