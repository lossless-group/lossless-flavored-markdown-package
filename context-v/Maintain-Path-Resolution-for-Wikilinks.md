---
site_uuid: 8b41d2a7-5e93-4c60-b1f8-27ad6e0c94d5
hex_code: 3wnz8k
title: "Maintain Path Resolution for Wikilinks"
lede: "How vault paths become site routes — the index cascade, why ambiguity refuses to guess, and the rule that every judgment call is a config field rather than a decision baked into the package."
publish: true
date_created: 2026-08-23
date_modified: 2026-08-23
date_authored_initial_draft: 2026-08-23
date_authored_current_draft: 2026-08-23
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Opus 5 (1M context)
at_semantic_version: 0.0.1.0
status: Signed-Off
tags:
  - Wikilinks
  - Path-Resolution
  - Configuration
  - Content-Pipeline
  - Obsidian
summary: "The design record for src/utils/resolve-path.ts. Load before adding a tier to the cascade, before changing what happens on a basename collision, before adding a config option, or when a site asks why its bare [[Page]] links do or do not resolve."
---

# Maintain Path Resolution for Wikilinks

## The split, and where this sits in it

Three layers, three owners. Keep them separate.

| Layer | File | Owns |
|---|---|---|
| Syntax | `src/plugins/remark-lfm-wikilinks.ts` | the regex, the MDAST splice, the `link` node shape |
| Mechanics | `src/utils/resolve-path.ts` | normalisation, the index cascade, relative paths, templates, ambiguity |
| Destinations | the consuming site | a config object, and nothing else |

The plugin has always delegated destinations, correctly — they are per-site. What it did not delegate was *mechanics*, so every site reimplemented them badly. This module is that missing middle.

**It is a utility, not a plugin.** It lives in `src/utils/` beside `classify-link.ts`, so the naming rule in `Naming-Plugins-Against-the-Remark-Ecosystem.md` does not apply to it.

## Measure before changing anything here

Every default in this module was chosen from a measurement, not from taste. Re-measure before overriding one. The 2026-08-23 baseline, across `content/` — 4,702 files, 13,846 wikilinks:

| Fact | Value | What it decided |
|---|---|---|
| Wikilinks with no folder | 3,839 — **28%** | there is an index at all |
| Basenames globally unique | 4,622 of 4,702 — **98.4%** | `basename` is in the default cascade |
| Colliding basenames | 73 (153 files) | ambiguity refuses to guess |
| Bare links hitting a collision | 25 — **0.7%** | the refusal costs almost nothing |
| Exact-path hits among pathed links | **89.8%** | `exact` is tier one |
| Case drift | `Tooling` 3,591 / `tooling` 38 | `caseSensitive: false` default |
| Separator drift | `lost-in-public` 179 / `Lost in Public` 8 | `looseSeparators: true` default |
| Literal `../` links | **0** | relative support exists but is never assumed |

Reproduce with a `readdir` sweep plus `grep -rhoE '\[\[[^]]+\]\]'`. It takes about a minute and it is worth doing before any argument about defaults.

## The two invariants

**1. Ambiguity terminates resolution. It does not fall through.**

A tier matching several files stops the cascade, records a diagnostic, and resolves to nothing. It does not try the next tier, and it does not reach the `route` tier — which matters because a site with a `*` catch-all would otherwise emit a confidently-wrong link for precisely the case where we know that we do not know.

This was a real bug caught by the test suite, not a hypothetical. If you refactor `resolve()`, keep the explicit `lastFailure?.reason === 'ambiguous'` guard, and keep the test named *a catch-all route does NOT rescue a collision*.

**2. Nothing is decided on the consumer's behalf.**

If you find yourself writing an `if` that encodes a preference — which tier to trust, what a slug means, what happens on a collision, whether the author's `|Display` wins — it is a config field, not a branch. The count today is fifteen options and zero baked-in policy. Adding the sixteenth is cheaper than defending a default that is wrong for one site.

`cascade` is deliberately a **list, not a threshold**. The tiers are not one confidence axis: a site can rationally trust `basename` and distrust `suffix`. `['exact', 'basename']` expresses that; `minConfidence: 'suffix'` cannot. An earlier draft used the threshold and it was wrong.

## Performance — say the number, do not hand-wave

The recurring worry is that build-time path resolution means a grep per link. It does not. The index is three `Map`s built once; each resolution is a few `Map.get()` calls.

```
fs walk (the site does this)  : 15.5 ms
index build (once)            : 13.4 ms
resolve ALL 13,812 wikilinks  : 70.3 ms   →  5.09 µs per link
```

**Keep it that way.** Any change that makes resolution O(vault) per link — fuzzy matching, Levenshtein fallback, a `bySuffix` walk that scans rather than looks up — is a regression even if it raises the hit rate. The `bySuffix` map is already the expensive one to *build* (O(segments) entries per file); that cost is paid once and is fine. Paying it per link would not be.

## When deferral is the right answer, and when it is not

`deferred` is **not** a performance workaround, and it should never be recommended as one. It exists for destinations an index genuinely cannot know: behind an API, in a sibling site's route table, or in content not yet built. It emits a placeholder URL — point it at an SSR route to settle at request time — and collects a deduplicated, frequency-sorted worklist via `resolver.deferred()` for a post-build rewrite pass.

Read the queue *after* the build has walked every document. It is a running tally, not a snapshot.

## Not wikilink-specific, on purpose

`resolve()` takes a string and returns a plain object. Image `src` attributes, plain link targets, and frontmatter cross-references have the same problem. `toWikilinkResolver()` is an adapter. Resist any change that makes the core assume it is being called from the wikilink plugin.

## See also

- `changelog/2026-08-23_01.md` — the release, with the full measurement table
- `context-v/blueprints/Naming-Plugins-Against-the-Remark-Ecosystem.md` — why this is `utils/`, not `plugins/`
- `test/resolve-path.test.mjs` — 39 assertions; the two invariants above are pinned there
