---
site_uuid: 914ec243-6cf4-4aa7-9d2d-5a1a44ec3821
hex_code: 535433
title: "Headings"
lede: "Bind an eyebrow and subheading to a heading, and build a table of contents from the document outline."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Headings
  - Table-of-Contents
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Headings

## Heading blocks (eyebrow, heading, subheading)

Every card component you have ever built renders a three-part heading: a small label above, the headline, and a line of supporting text below. Markdown gives you one of the three.

```markdown
$$ Portfolio Operations
## Every email from a portco, filed as PDFs
&& Two passes, inventory before export — so you can verify coverage
```

```html
<hgroup class="heading-block">
  <p class="heading-block-eyebrow eyebrow">Portfolio Operations</p>
  <h2 id="every-email-from-a-portco-filed-as-pdfs">Every email from a portco, filed as PDFs</h2>
  <p class="heading-block-subheading subheading">Two passes, inventory before export</p>
</hgroup>
```

**Position is the entire rule.** The markers mean nothing on their own — `$$` is an eyebrow only when the very next line is a heading, `&&` a subheading only when the previous line was one. Everywhere else they are ordinary text. Everything else follows: no blank line between them, order fixed, the heading mandatory, either optional line omittable, any heading level.

That is also why it is safe on by default. A parser meeting a `$$` asks one question, and on almost every existing document the answer is no.

| Marker | Becomes | Rendered as | Required |
|---|---|---|---|
| `$$ ` (or `^^ `) | `eyebrow` | `<p class="heading-block-eyebrow eyebrow">` | No |
| `## ` | the heading | `<h2>` — any level | **Yes** |
| `&& ` | `subheadings[]` | `<p class="heading-block-subheading subheading">` | No |

**The class names are public API.** LFM ships no CSS, so they are the only thing you can style against. Each part carries two: the `heading-block-*` one is scoped to the block, which is what lets `.heading-block .eyebrow` outrank your own `.prose p`; the bare `eyebrow` / `subheading` is deliberate reuse of whatever your card components already style.

The eyebrow and subheading are `<p>`, never headings — the accessibility guidance for `hgroup`, and what keeps them out of your table of contents as sections that do not exist.

**On `$$` and LaTeX.** It is the display-math delimiter everywhere, and the positional rule defuses most of the overlap: a math block's next line is a formula, never an `##`. `^^` is an accepted alias from day one, so if math ever lands, `$$` can be deprecated for eyebrows without a content migration.

Degradation matters here, because this syntax lands in files read outside your renderer. In Obsidian, on GitHub, in any plain preview, `$$ Portfolio Operations` renders as literal text above the heading. Ugly, not broken, still readable.

## Table of contents (the heading outline)

`remarkLfmHeadingIds` gives every heading a stable, deduped anchor and attaches an ordered outline at `tree.data.headings`:

```ts
export interface LfmHeading {
  id: string;              // final anchor id, after dedupe
  text: string;            // plain text, markup stripped
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  duplicateOf?: string;    // this slug collided with an earlier heading
  synthetic?: boolean;     // text slugified to nothing; a positional id was used
  inContainer?: string;    // innermost enclosing callout / details / blockquote / listItem
  eyebrow?: string;        // when the heading is part of an eyebrow block
}
```

**`inContainer` is the one that makes a ToC possible.** A heading inside a `> [!warning]` callout is not a document section, but it still deserves an anchor — a share link into a callout is a link like any other. The outline records where it sits so you can leave it out of the ToC without taking its anchor away. It carries the container's *name* rather than a boolean, because a `details` heading is a navigable section while a callout one is an aside, and you may reasonably want to treat them differently.

Two pure folds ship alongside, for the same reason `slugifyHeading` does — every consumer writes them, and the edge cases (a document opening at `h3`, an `h2` → `h4` jump, a trailing `h6`) would each be got wrong independently:

```ts
import { nestHeadings, filterHeadings } from '@lossless-group/lfm';

const outline = (tree as any).data?.headings ?? [];

const toc = nestHeadings(
  filterHeadings(outline, 2, 3)            // depth band; drops `synthetic` entries
    .filter((h) => !h.inContainer),        // your call — asides out, sections in
);
// LfmHeadingNode[] — LfmHeading plus `children`, so anything you decorated survives
```

Depth gaps are **not** filled with placeholders: an `h4` under an `h2` becomes a direct child, because inventing an empty `h3` would put a waypoint in the ToC with no anchor to point at.

Components, layout, breakpoints, scroll tracking and measuring your pinned header stay out of the package, permanently. The seam: **LFM decides what a heading is called and where it sits; your render layer decides what the reader sees.**
