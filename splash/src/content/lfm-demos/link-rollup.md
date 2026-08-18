---
title: Link rollups
kind: feature
plugin: lfm-link-preview
result_label: containerDirective data.linkPreviewSpec
order: 90
note: >-
  Attributes parsed, URLs collected in document order and deduped, each link
  classified against the provider catalog. No network call happens here —
  fetching is the og-fetcher's job, and only when you enable it.
---

:::link-rollup{format="gallery" columns="2"}
- https://www.youtube.com/watch?v=dQw4w9WgXcQ
- https://example.com/article
:::
