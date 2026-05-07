---
title: remark-callouts
lede: Obsidian `> [!type] Title` blocks normalized into directive nodes — same downstream shape, two upstream syntaxes.
order: 40
status: Stable
icon: ❝
tags: [Callouts, Obsidian]
---

Authors writing in Obsidian get callout previews in their editor. Authors
writing in plain markdown can use `:::callout{type="warning"}`. Both end up as
the same `:::callout` directive node — your `<Callout>` component renders one
shape regardless of which tool wrote the file.
