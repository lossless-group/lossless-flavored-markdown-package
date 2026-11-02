---
site_uuid: 5222da2b-69bd-4797-ac75-26fe1ddf204a
hex_code: 1c31a7
title: "Image Carousels"
lede: "Turn a directive and a list of images into one carousel payload that any framework can render."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Images
  - Carousels
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Image carousels

```markdown
:::image-carousel{variant="stepper" title="Setting up Aside"}
::image{src="/Welcome_20260817T164659Z.jpg" alt="Welcome screen" label="Welcome" caption="…"}
::image{src="/Recovery_20260817T171052Z.jpg" alt="Recovery key" label="Recovery key"}
:::
```

Slides are extracted (from `::image{}` directives or plain `![alt](src)`), the `img-carousel` alias collapses to one name, and order resolves — all into a single `data.carousel` payload, so every framework reads one contract instead of re-walking children.

Four variants: `filmstrip`, `stepper`, `peek`, `contact-sheet`. The first three are *sequences* and default to `sort="chronological"`, reading the ISO 8601 basic-format stamp the house image-prep convention appends to each filename. `contact-sheet` is excluded deliberately — it renders every frame at once, so there is no reading order to reorder.

> **The stamp marks a prep run, not a capture.** Every image from one invocation carries an identical stamp, so chronological ordering only ever reorders *across* batches. The sort is stable and falls back to `authoredIndex`, which makes the ordinary case correct — but an image belonging mid-sequence that was uploaded later will move to the end. `sort="authored"` opts out. There is a worked example of exactly this on the [demo page](https://lossless-group.github.io/lossless-flavored-markdown-package/demo/).
