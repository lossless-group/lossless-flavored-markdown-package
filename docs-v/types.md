---
site_uuid: bfa8d0a2-0ec7-440c-9794-17bdf4c975ad
hex_code: 22cd87
title: "Types"
lede: "The TypeScript types the package exports, with what each one describes."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Types
  - Public-API
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Types

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
  LinkPreviewSpec,     // What lfm-link-preview stamps on directive nodes
  OGFetchOptions,      // lfmOgFetcher options (backend, ttl, timeout, etc.)
  OGFetchResult,       // What an OG backend returns
  OGBackendName,       // 'direct' | 'opengraph-io' | …
} from '@lossless-group/lfm';
```
