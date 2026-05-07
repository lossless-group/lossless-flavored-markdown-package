---
title: link-preview · og-fetcher
lede: Build-time OpenGraph enrichment. Cards and rollups carry full metadata before the page ships.
order: 60
status: Stable
icon: ◇
featured: true
tags: [OpenGraph, Build-time, Cards]
---

`remarkOgFetcher` walks the tree, finds external links and `:::link-preview`
directives, fetches OG metadata, and annotates the AST with `LinkPreviewData`.
Direct + OpenGraph.io backends, configurable cache, separate TTLs for hits and
failures so a transient upstream error doesn't poison results for a week.

The `LinkPreviewData` shape aligns with the canonical Sources schema in
`cite-wide`, so promoting an OG card to a canonical citation is additive — not a
rename pass.
