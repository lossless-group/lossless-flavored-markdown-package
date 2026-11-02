---
site_uuid: cb753da3-2aab-4e0f-a061-4edca2c087fb
hex_code: d2d7f5
title: "Link Previews"
lede: "Fetch OpenGraph metadata at build time, and classify bare URLs as embeds with the bundled provider catalog."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Link-Previews
  - OpenGraph
  - Embeds
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Link Previews

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
