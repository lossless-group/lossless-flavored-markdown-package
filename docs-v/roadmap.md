---
site_uuid: b85c64d9-ba10-4630-8a74-3535e0de7076
hex_code: 3dfb7d
title: "Roadmap"
lede: "What's planned for the package, separated into new triggers and wider authoring-syntax support."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Roadmap
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Roadmap

For what has already shipped, see the [changelog](../changelog/).

## Extending the trigger catalog

- **remark-bare-link**: the parse-time plugin that consumes the bundled catalog and emits leaf directives. Sites currently classify at render time.

## Broader polyglot reach

- **Markdoc `{% tag %}` normalization**: converge Markdoc-flavored content into the same AST.
- **MDX-lite `<Component />` normalization**: accept MDX-shaped author syntax without JSX execution.

The first kind adds triggers. The second changes which authoring conventions converge on the canonical AST.

## Astro companion

`@lossless-group/lfm-astro`, components and integration glue for Astro sites, isn't published yet. Until it is, use this package directly.

See the full spec: [Codifying a Comprehensive Extended Markdown Flavor and Shared Package](https://github.com/lossless-group/astro-knots/blob/master/context-v/specs/Codifying-a-Comprehensive-Extended-Markdown-Flavor-and-Shared-Package.md)
