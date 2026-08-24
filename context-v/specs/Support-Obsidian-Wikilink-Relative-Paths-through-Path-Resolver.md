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
at_semantic_version: 0.0.0.1
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

## Correction to this document's own title

The filename says *relative paths*. **Relative paths are not the driver.**

Measured across the Lossless `content` vault on 2026-08-23: there are **zero**
literal `../` or `./` wikilinks in 13,846 links. Supporting them is cheap and
worth doing for authoring futures, but prioritising this work on that basis
would be prioritising it on a non-problem.

The actual driver is **bare names** — `[[DevOps]]` with no folder segment at
all — which a prefix matcher cannot resolve by construction.

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
- [ ] Should unresolved wikilinks be **loud** — a build-time warning or count —
      rather than silently rendering as prose? Arguably the more valuable half
      of this whole problem, and independent of the resolver.
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
