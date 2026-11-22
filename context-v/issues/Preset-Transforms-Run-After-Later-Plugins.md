---
site_uuid: 6b0f3a8e-2d41-4c7e-9a55-1f8e0c2b7d93
hex_code: p7r3tq
title: "Preset Transforms Run After Plugins Added Later in the Chain"
lede: "In `unified().use(remarkParse).use(remarkLfm).use(remarkRehype)`, every LFM transform runs after remark-rehype, on the HTML tree, so callouts and citations never happen."
slug: preset-transforms-run-after-later-plugins
publish: true
date_created: 2026-11-21
date_modified: 2026-11-21
date_authored_initial_draft: 2026-11-21
date_authored_current_draft: 2026-11-21
at_semantic_version: 0.0.1.0
status: Open
category: Issue Resolution
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
summary: "remarkLfm adds its sub-plugins with this.use() from inside its attacher. unified runs attachers when the processor freezes and appends anything they add to the end of the list, so the sub-plugins' transformers run after every plugin the caller chained after remarkLfm, remark-rehype included. Found while writing the /browser render test. Workaround: run LFM to an MDAST first, then remark-rehype in a second processor."
tags:
  - Remark
  - Render-Pipeline
  - Consumer-Contract
type: Issues
---

# Preset Transforms Run After Plugins Added Later in the Chain

**Status:** Open
**Affects:** `remarkLfm` from the root entry and from `/browser`, whenever another plugin is chained after it
**Found:** 2026-11-21, writing the `/browser` render test (`test/browser-entry.test.mjs`)

## Symptom

```js
const html = String(
  await unified().use(remarkParse).use(remarkLfm).use(remarkRehype).use(rehypeStringify)
    .process('> [!note]\n> Hi\n\nCited.[^a3f9b2]\n\n[^a3f9b2]: [A](https://a.example)\n'),
);
```

renders the callout as a plain `<blockquote>` with `[!note]` in the text, and the
citation as GFM's own footnote section. `tree.data.citations` is never set. The
order the processor actually runs in:

```
remarkParse > remarkLfm > remarkRehype > rehypeStringify > remarkGfm > remarkDirective
  > lfmWordColons > remarkLfmComments > remarkLfmCallouts > remarkLfmCitations > …
```

## Cause

`remarkLfm` is an attacher that calls `this.use(...)` for each sub-plugin.
unified runs attachers when the processor freezes, in order, and appends what
they add to the end of the attacher list. So the sub-plugins' transformers land
after everything the caller chained after `remarkLfm`. GFM and directive syntax
still work, because those are parser extensions read at parse time, but every
transform runs late: on the HTML tree once remark-rehype has run.

`parseMarkdown()` and `.use(remarkParse).use(remarkLfm)` with nothing after it
are unaffected, which is how every site uses LFM today, so nothing has broken
yet. The README's "add LFM to an existing unified pipeline" invites exactly
the chain above, though, and an Astro `remarkPlugins` entry would hit it too.

## Workaround

Run LFM to an MDAST, then convert in a second processor:

```js
const lfm = unified().use(remarkParse).use(remarkLfm);
const tree = await lfm.run(lfm.parse(markdown));
const hast = await unified().use(remarkRehype).run(tree);
const html = unified().use(rehypeStringify).stringify(hast);
```

The README's browser section and the `/browser` test use this shape.

## Fix, when it's taken on

Have the preset call each sub-plugin's attacher itself (`plugin.call(this, options)`,
so parser extensions still register on the processor) and return one transformer
that runs the collected transformers in order. Then the preset's transforms run
where it sits in the chain. That changes when LFM runs relative to a caller's
later plugins, so it wants its own release note and a test chaining remark-rehype
after `remarkLfm`.
