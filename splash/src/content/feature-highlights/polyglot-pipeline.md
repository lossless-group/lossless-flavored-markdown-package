---
title: Polyglot pipeline
lede: Many authoring conventions, one canonical AST. Authors pick the syntax their tool prefers; renderers see one shape.
order: 10
status: Stable
icon: ¶
featured: true
tags: [Core, AST, Normalization]
---

`:::callout{type="warning"}`, `> [!warning]`, and (eventually) Markdoc `{% callout %}`
all produce **the same MDAST node**. Adding a new authoring syntax means a new
normalizer plugin — no consumer changes, no renderer rewrites.

This is the headline pitch: LFM owns the *trigger → tokenize → normalize* path.
Your framework owns rendering.
