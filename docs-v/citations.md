---
site_uuid: fad11234-8321-4596-af03-19bd2b0c7827
hex_code: 24626f
title: "Citations"
lede: "Renumber hex-code footnotes for display and lift them into a structured citation dataset."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Citations
  - Footnotes
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Citations

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
