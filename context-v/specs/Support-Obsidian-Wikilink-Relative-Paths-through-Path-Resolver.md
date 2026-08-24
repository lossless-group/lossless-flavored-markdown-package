---
site_uuid: 157e1db7-4483-400c-a227-7317dfc1f064
hex_code: n2a3ar
title: "Support Obsidian Wikilink Relative Paths through a Path Resolver"
lede: "Wikilink destinations are per-site, so LFM demands a resolver function and every consumer writes the same one by hand — badly. This is the stub for turning that into configuration, including the 28% of wikilinks a prefix matcher structurally cannot see."
slug: support-obsidian-wikilink-relative-paths-through-path-resolver
publish: true
date_created: 2026-08-23
date_modified: 2026-08-23
date_authored_initial_draft: 2026-08-23
date_authored_current_draft: 2026-08-23
at_semantic_version: 0.0.0.2
status: Draft
category: Spec
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Opus 5 (1M context)
summary: "Stub spec for a declarative path-resolution layer under remarkLfmWikilinks. Records the corpus measurements that motivate it (28% of wikilinks are bare, 98.4% of basenames are globally unique, 73 collide), the correction that relative paths are NOT the actual driver despite this document's title, and the open questions that need answering before any of it is designed. An unreviewed prototype exists on disk, staged and uncommitted — it is a proposal, not a decision."
tags:
  - Spec
  - Wikilinks
  - Path-Resolution
  - Obsidian
  - Configuration
  - Stub
---

# Support Obsidian Wikilink Relative Paths through a Path Resolver

**This is a stub, parked deliberately.** It exists so the problem is not
re-derived from scratch in a fortnight. Nothing here is designed, agreed, or
authorised, and the prototype referenced at the bottom is unreviewed.

## Summary

`remarkLfmWikilinks` owns wikilink *syntax* and delegates *destinations* to a
site-supplied `resolver` function, on the correct grounds that destinations are
inherently per-site. The unintended consequence is that every consuming site
writes the same resolver by hand — a chain of `if (path.startsWith(…))`
branches covering the prefixes its author happened to think of, silently
dropping everything else.

The proposal is a **policy layer expressed as data** that produces the function
the plugin already wants: the site supplies routing config, LFM supplies the
mechanics. Opt-in, in the same way `codeFences` and `ogFetch` are.

## Two senses of "relative", and both matter

An earlier draft of this stub "corrected" its own filename, asserting that
relative paths were not the driver because the corpus contains zero `../` or
`./` links. **That correction was wrong.** It read *relative* in the filesystem
sense when the Obsidian sense is the operative one. Kept here rather than
quietly deleted, because the misreading is an easy one to repeat.

**Vault-relative — the whole corpus.** Every Obsidian wikilink is a path
relative to the vault root. `[[Vocabulary/Build Systems]]` means
*vault-root/Vocabulary/Build Systems*, not a filesystem path. Mapping those
onto site routes is the entire job, and it is what this document's filename
means. All 13,846 links are relative paths in this sense.

**Document-relative — supported, not currently exercised.** Obsidian's *new
link format* setting can emit `../concepts/Foo`, resolved against the linking
document rather than the vault root. This vault emits none today (measured
2026-08-23), but that is a property of one vault's settings, not of the format.
A resolver must handle them — which means **it must know which document a link
was written in.** See the unresolved-link contract below, which needs the same
thing for a different reason.

**Bare names — 28%, and the hardest case.** `[[DevOps]]`, no folder segment at
all. Obsidian resolves these by shortest-unique-path against its vault index; a
prefix matcher cannot see them by construction.

## The unresolved-link contract

Settled 2026-08-23. Not a design question — a requirement any implementation
inherits.

1. **Never fail the build.** An unresolvable link is a content problem, not a
   compile error. A vault of thousands of hand-edited files always has some.
2. **Log the path that could not be resolved, and the document it appears in.**
   Either alone is close to useless.
3. **Render as plain text, not a hyperlink.** No anchor, no bracket syntax.

Points 1 and 3 are already `remarkLfmWikilinks` behaviour. **Point 2 is not
currently expressible through its API**, and closing that gap may be worth more
than the resolver itself, because it turns a silent failure into a worklist:

- `onUnresolved` receives `WikilinkResolverInput` — `{ path, anchor, display,
  raw }`. No source document.
- The transformer is declared `function transformer(tree: Root)`. Remark passes
  `(tree, file)`; the `VFile` carrying `path` / `history` is never taken.

Additive fix, independent of everything else in this spec, and shippable on its
own.

## The measurements that motivate it

Unverified. Produced by throwaway scripts that were not committed; re-run
before relying on any of these.

| Fact | Value | Why it matters |
|---|---|---|
| Vault size | 4,702 files / 13,846 wikilinks | scale |
| Wikilinks with no folder segment | 3,839 — **28%** | prefix matching cannot see these |
| Basenames globally unique | 4,622 of 4,702 — **98.4%** | basename resolution is viable |
| Colliding basenames | 73 (153 files) | …but must not guess |
| Bare links hitting a collision | 25 — **0.7%** | refusing to guess costs almost nothing |
| Pathed links hitting an exact vault path | **89.8%** | the common case is cheap |
| Case drift | `Tooling` 3,591 / `tooling` 38 | folding is required, not optional |
| Separator drift | `lost-in-public` 179 / `Lost in Public` 8 | ` `, `-`, `_` must be equivalent |

## Goals

- Let a site express wikilink destinations as **configuration**, not as a
  hand-written function, without removing the option of a hand-written one.
- Resolve bare `[[Page]]` links, which requires an index of the vault.
- Fold the case and separator drift the vault actually contains.
- Support many-to-one route folding — `concepts/`, `vocabulary/`,
  `organizations/` and `sources/` are four vault folders and one public index.
- Never emit a confidently-wrong link. Ambiguity resolves to plain text.
- Stay additive: existing consumers see no behaviour change.

## Non-goals

- Replacing `remarkLfmWikilinks`. The syntax/destination split stays.
- Shipping a default resolver in the package. Still wrong for every consumer
  but the one we picked.
- Fuzzy or Levenshtein matching. A near-miss link is worse than no link.
- Solving link resolution for anything that needs a network call at parse time.

## Open questions

- [ ] **Is this LFM's job at all?** It could equally be a small per-site helper,
      or a shared package that is not LFM. Putting it in a published library
      raises the review bar considerably.
- [ ] Should ambiguity default to plain text, or to a deterministic pick?
      (Prototype defaults to plain text; that choice is not settled.)
- [ ] Does an index belong in the package's contract at all, given LFM has so
      far been careful to know nothing about the filesystem?
- [ ] How should the source document reach `onUnresolved` — widen
      `WikilinkResolverInput`, add a second argument, or hand the resolver the
      `VFile`? Affects the public type shape either way.
- [ ] What settles destinations that an index cannot know (API-backed, or a
      sibling site's route table)? A queue and a post-build pass, an SSR route,
      or out of scope?
- [ ] Version and release shape. Additive suggests a minor bump; the public
      type shape of `WikilinkOptions` does change (`resolver` required →
      optional), which deserves its own look.

## Prior art on disk — unreviewed

A working prototype is **staged and uncommitted** in this repo. It is a
proposal produced during a spike that had a different brief; it has not been
reviewed and should not be treated as the design.

- `src/utils/resolve-path.ts` — the resolver (+806)
- `test/resolve-path.test.mjs` — 39 assertions (+370)
- 10 further files touched, incl. a staged **0.5.1 → 0.6.0 version bump**
- Full inventory: `LFM-RESOLVER-REVIEW.md` in the `lossless-toolkit-site`
  Variant A working copy
- `context-v/Maintain-Path-Resolution-for-Wikilinks.md` — design record written
  alongside the prototype, and equally unreviewed

Discard is a two-command operation; the review file documents it.

## Related

- `context-v/blueprints/Naming-Plugins-Against-the-Remark-Ecosystem.md` — why a
  resolver is `utils/` rather than `plugins/`
- `context-v/Workspace-vs-JSR-for-LFM-Consumers.md` — the consumer surface any
  API change here lands on
- `lossless-toolkit-site/context-v/issues/Need-to-Resolve-Obsidian-Wikilink-Paths.md`
  — the consuming-site issue that surfaced this
