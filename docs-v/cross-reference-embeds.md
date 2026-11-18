---
site_uuid: d46bf05b-45d8-4206-a9a1-27aa3e092986
hex_code: xe2r4e
title: "Cross-reference embeds"
lede: "Write ![[Note#Heading]] and that section of another document shows up here, marked as borrowed, with a link back to the original."
publish: true
date_created: 2026-11-17
date_modified: 2026-11-17
date_authored_initial_draft: 2026-11-17
date_authored_current_draft: 2026-11-17
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Embeds
  - Obsidian
  - Transclusion
  - Wikilinks
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
---

# Cross-reference embeds

Obsidian lets one note show a section of another. LFM calls these
*cross-reference embeds*, to keep them apart from other kinds of embed (link
previews, media). Put this on a line of its own:

```md
![[Google Maps#Google Maps API managing policies.]]
```

and the "Google Maps API managing policies." section of the Google Maps note
appears in place, under its own heading. Write once, show it wherever it's
relevant. LFM does the same when it parses, so the published page shows it too.

## Syntax

Each on a line of its own:

| You write | You get |
|---|---|
| `![[Note]]` | The whole document, minus its frontmatter |
| `![[Note#Heading]]` | One section |
| `![[Note#Heading#Subheading]]` | A section inside a section |
| `![[folder/Note#Heading\|Label]]` | Obsidian's order: the label after the pipe |
| `![[folder/Note\|Label#Heading]]` | Also accepted: the `#` part is the section, wherever it sits |

- **A section** runs from its heading to the next heading of the same or higher
  level, so its subsections come along.
- **Headings match** ignoring case, markup and extra spaces. The heading's slug
  also matches: `#google-maps-api-managing-policies` works.
- **File embeds** like `![[photo.png]]` are left alone for your image handling.
- **An embed inside a sentence** stays text; it has to be on its own line.

## Turn it on

LFM never reads files itself. You tell it how to load a document:

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(body, {
  crossReferenceEmbeds: {
    // Return the markdown, or null if there's no such document. May be async.
    load: async ({ path }) => {
      const entry = await findNote(path);         // your index, e.g. a content collection
      if (!entry) return null;
      return { markdown: entry.body, url: `/notes/${entry.id}/`, title: entry.data.title };
    },
  },
});
```

`load` receives `{ path, section, sections, display, raw }`. Return the markdown
as a string, or `{ markdown, url, title }`:

- `url` is where the "open the original" link goes.
- `title` is the name in the "from …" line. It defaults to the document's
  frontmatter `title`, then its file name. A `|Label` overrides both.

Other options:

- `url(input)`: the link to the original, when `load` doesn't return one.
- `maxDepth`: how many embeds deep to follow (embeds inside embedded documents).
  Default 2. It also stops a note that embeds itself.
- `onUnresolved(input)`: called for each embed that couldn't be filled, with
  `status` saying why. Handy for a build-time report.

Cross-reference embeds make parsing async, so use `parseMarkdown` or `processor.run()`, not
`runSync`.

## What you get

One block per embed:

```js
{
  type: 'containerDirective',
  name: 'cross-reference-embed',
  attributes: { source: 'Tooling/Products/Google Maps', section: '…', title: 'Google Maps', href: '/notes/google-maps/' },
  data: {
    crossReferenceEmbed: {
      path: 'Tooling/Products/Google Maps',
      section: 'Google Maps API managing policies.',   // 'A › B' for #A#B
      display: 'Google Maps',                          // the |Label, or null
      title: 'Google Maps',
      url: '/notes/google-maps/',
      status: 'ok',
      raw: '![[Tooling/Products/Google Maps|Google Maps#Google Maps API managing policies.]]',
    },
  },
  children: [ /* the section, starting with its heading */ ],
}
```

- **The embedded document is parsed with your same options,** so its callouts,
  wikilinks and MDX work.
- **Its headings get ids on the host page,** marked `inContainer: 'cross-reference-embed'` in
  `tree.data.headings`. `filterHeadings` keeps them. If your table of contents
  should list only the page's own sections, drop them:
  `filterHeadings(headings).filter((h) => h.inContainer !== 'cross-reference-embed')`.
- **When something can't be found,** the block still arrives, empty, with
  `status` set to `missing-document`, `missing-section` or `too-deep`. Show a
  quiet note and the link rather than nothing.
- **Footnotes inside an embedded section** aren't renumbered into the host's
  citations yet.

## Rendering it

Draw it so it reads as part of the page: same type and spacing, no box. Add a
small "From *Title*" line and an "Open original" link so the reader knows it's
borrowed and can go to the source.

The reference component is `CrossReferenceContentEmbed.astro` in astro-knots'
`packages/lfm-astro/components/`. It draws a thin rule down the left side, the
source line above the content, and the link at its right. `AstroMarkdown`
dispatches `containerDirective` nodes named `cross-reference-embed` to it.
