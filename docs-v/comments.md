---
site_uuid: 15bd8f4e-d2a2-4bff-ba68-926d7d86e94c
hex_code: x7rx8m
title: "Comments"
lede: "Obsidian's %%private notes%% stay private: LFM leaves them out of the page."
publish: true
date_created: 2026-11-19
date_modified: 2026-11-19
date_authored_initial_draft: 2026-11-19
date_authored_current_draft: 2026-11-19
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Comments
  - Obsidian
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5
---

# Comments

In Obsidian, anything between two `%%` markers is a note to yourself. You see
it while editing, and it's gone when reading. LFM does the same: comments never
reach the page. This is on by default.

```markdown
Ship on Friday. %%unless legal is still reviewing%%
```

renders as "Ship on Friday."

## Inline and block comments

A comment can sit inside a sentence, or wrap whole blocks: paragraphs,
headings, lists, code, anything.

```markdown
%%
## Open questions

- Is the pricing final?
- Who signs off?
%%
```

A commented-out heading never gets an id and never appears in the table of
contents. Everything downstream (cross-reference embeds, citations, heading
ids) runs after comments are removed, so none of it sees what you hid.

## What counts as a comment

- **Text between two `%%` markers**, even across paragraphs. A comment can
  open in one paragraph and close three blocks later.
- **Not `%%` in code.** In a code span or fence, `%%` is just text, as in
  Obsidian.
- **An unclosed `%%` hides the rest of the document.** That's what Obsidian
  does, and it's the safe failure: a note left half-open stays private instead
  of being published.
- A list item, paragraph or heading that held nothing but a comment is removed
  entirely, so you don't get an empty bullet.

## Turning it off

To show `%%` text as written:

```ts
parseMarkdown(content, { comments: false });
```

Or, outside the preset, use the plugin on its own:

```ts
import { remarkLfmComments } from '@lossless-group/lfm';

unified().use(remarkParse).use(remarkLfmComments);
```

## Not included

- HTML comments (`<!-- … -->`) are a separate thing. Markdown passes them
  through as HTML, and how your renderer treats raw HTML decides whether
  they show.
