---
site_uuid: a3716fe9-96c3-403c-8cec-9d0668cb768c
hex_code: 6cb197
title: "Wikilinks and Path Resolution"
lede: "Resolve Obsidian wikilinks to real links, with a function you write or a config object that routes paths for you."
publish: true
date_created: 2026-11-02
date_modified: 2026-11-02
date_authored_initial_draft: 2026-11-02
date_authored_current_draft: 2026-11-02
at_semantic_version: 0.0.1.0
status: Published
category: Docs
tags:
  - Wikilinks
  - Path-Resolution
  - Obsidian
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Claude Opus 5.5 (1M context)
---

# Wikilinks and Path Resolution

## Wikilinks (Obsidian-style internal/external resolution)

Obsidian wikilinks (`[[Page]]`, `[[Page|Display]]`, `[[folder/Page#Section|Display]]`) are first-class authoring vocabulary in vaults — and dead text in standard Markdown. `remarkLfmWikilinks` resolves them into proper `link` MDAST nodes against a **site-supplied resolver function**. The plugin owns the syntax (regex, MDAST splice, link node shape); each site owns its destinations (which prefix routes where, what's local vs external, what's intentionally parked).

This split exists because wikilink destinations are inherently per-site. The same `[[Vocabulary/Polyrepo]]` resolves to `lossless.group/more-about/polyrepo` from one site and `glossary.example.com/polyrepo` from another. Baking a default resolver into the package would be wrong for every consumer except the one we picked.

### Quick start

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(content, {
  wikilinks: {
    resolver: (input) => {
      const path = input.path.toLowerCase();

      // Internal: same-site routes (path-only URL, isLocal: true).
      if (path.startsWith('essays/')) {
        const slug = path.slice('essays/'.length).replace(/\s+/g, '-');
        return {
          url: `/essays/${slug}`,
          isLocal: true,
          display: input.display ?? input.path.split('/').pop() ?? '',
        };
      }

      // External: full URLs (isLocal: false → target="_blank" added).
      if (path.startsWith('vocabulary/') || path.startsWith('concepts/')) {
        const slug = path.replace(/^[^/]+\//, '').replace(/\s+/g, '-');
        return {
          url: `https://www.lossless.group/more-about/${slug}`,
          isLocal: false,
          display: input.display ?? input.path.split('/').pop() ?? '',
        };
      }

      // No match → render as plain display text. The plugin handles
      // the fallback display string automatically.
      return null;
    },
    onUnresolved: (input) => {
      console.log(`[wikilinks] unresolved: ${input.raw}`);
    },
  },
});
```

### Resolver contract

```ts
import type {
  WikilinkResolverInput,
  WikilinkResolution,
  WikilinkOptions,
} from '@lossless-group/lfm';

// Input — produced by the plugin from one [[...]] match.
interface WikilinkResolverInput {
  path: string;          // "Vocabulary/Build Systems"
  anchor: string | null; // "Section Heading" or null
  display: string | null;// author-supplied or null
  raw: string;           // the literal "[[...]]"
}

// Output — used verbatim to build the <a> node, OR null to render
// the wikilink as plain display text (no anchor, no class).
interface WikilinkResolution {
  url: string;          // "/essays/foo" or "https://..."
  isLocal: boolean;     // true → wikilink--local class, no target=_blank
  display: string;      // final visible text
  classes?: string[];   // extra CSS classes appended to the base
}
```

### Rendering

Resolved wikilinks emit standard `link` MDAST nodes with `data.hProperties.class` set to `wikilink wikilink--local` or `wikilink wikilink--external`. External wikilinks also get `target="_blank" rel="noopener noreferrer"`. **No custom MDAST node type, no custom renderer component required** — the regular link branch in your AstroMarkdown / rehype-react / etc. pipeline handles them.

```html
<!-- External -->
<a class="wikilink wikilink--external"
   target="_blank" rel="noopener noreferrer"
   href="https://www.lossless.group/more-about/build-systems">Build Systems</a>

<!-- Internal -->
<a class="wikilink wikilink--local"
   href="/essays/foo-bar">Foo Bar</a>
```

### What gets matched (and what doesn't)

The plugin walks `text` MDAST nodes only. Wikilink syntax inside fenced code blocks, inline code, and HTML stays literal:

````markdown
This [[Vocabulary/Polyrepo]] resolves.

But ` [[concepts/foo]] ` (inline code) does NOT.

```ts
const ex = '[[Tooling/Bazel]]'; // also untouched — code fence
```
````

### When the resolver returns `null`

Operating principle: *supporting 40% of intended wikilinks is better than supporting none.* Unresolved wikilinks render as plain prose — just the display string (or path's last segment, with `.md` stripped and hyphens turned to spaces). No `<a>`, no class, no markup hint. The optional `onUnresolved` callback fires once per unresolved match — typical use is piping into a build-time audit log.

### A worked example: per-site resolver with rule arrays

The recommended pattern for non-trivial sites is to declare prefix rules as data, not as `if`-branches in the resolver:

```ts
const PREFIX_RULES = [
  { prefix: 'essays/',     template: '/essays/{slug}',                                 isLocal: true },
  { prefix: 'tooling/',    template: 'https://www.lossless.group/toolkit/{slug}',      isLocal: false },
  { prefix: 'vocabulary/', template: 'https://www.lossless.group/more-about/{slug}',   isLocal: false },
  { prefix: 'concepts/',   template: 'https://www.lossless.group/more-about/{slug}',   isLocal: false },
];

const slugify = (s: string) =>
  s.split('/').map(seg => seg.trim().toLowerCase().replace(/\s+/g, '-')).join('/');

const resolver = (input: WikilinkResolverInput): WikilinkResolution | null => {
  const lower = input.path.toLowerCase();
  for (const rule of PREFIX_RULES) {
    if (lower.startsWith(rule.prefix)) {
      const tail = lower.slice(rule.prefix.length);
      return {
        url: rule.template.replace('{slug}', slugify(tail)),
        isLocal: rule.isLocal,
        display: input.display ?? input.path.split('/').pop() ?? '',
      };
    }
  }
  return null;
};
```

Adding a destination is then six lines in the rule array. The reference implementation in `mpstaton-site` adds two more rule shapes (`ExactRule` for one-off overrides, `DeferredRule` for "deliberately parked, don't keep showing up as untouched"). Both are optional.

## Path resolution (the declarative half of wikilinks)

`remarkLfmWikilinks` owns wikilink *syntax* and delegates *destinations* to a site-supplied `resolver`. That split is right, and it left something unaddressed: almost every consumer then writes the same resolver, by hand, as a chain of `if (path.startsWith(...))` branches that handles the paths its author happened to think of and silently drops the rest.

`createPathResolver` is the missing half — resolution as **data you configure**, not code you write. Three layers, three owners: the plugin owns syntax, this owns mechanics, your site owns a config object.

**It is opt-in exactly like `codeFences` and `ogFetch`.** Omit it and nothing changes.

```ts
import { parseMarkdown } from '@lossless-group/lfm';

const tree = await parseMarkdown(content, {
  wikilinks: {
    paths: {
      index: vaultPaths,           // string[] — one readdir sweep at build time
      routes: [
        // Four vault folders, one public index.
        { match: ['concepts', 'vocabulary', 'organizations', 'sources'],
          to: 'https://www.lossless.group/more-about/{slug}' },
        { match: 'tooling',  to: '/tools/{slug}' },
        { match: 'essays',   to: '/essays/{slug}' },
      ],
    },
  },
});
```

### Why an index, and not just prefix rules

Measured across the Lossless `content` vault (4,702 files, 13,556 navigational wikilinks — `![[embeds]]` excluded, since the resolver is never asked to route one). Re-derived 2026-09-08 with `node scripts/measure-vault.mjs`, which is committed: **re-run it rather than trusting this table.** The corpus moves under authors' hands, so these will drift. If a default stops following from the numbers, change the default.

| Fact | Value | Consequence |
|---|---|---|
| Wikilinks with **no folder at all** — `[[DevOps]]` | 3,624 — **26.7%** | A prefix-matching resolver cannot see a quarter of the corpus |
| Files whose basename is **unique** in the vault | 4,563 of 4,702 — **97.0%** | Basename resolution is safe far more often than not |
| Basenames that **collide** | 66 (139 files) | …but not always. Ambiguity is reported, never guessed |
| Bare wikilinks that actually hit a collision | 17 of 3,624 — **0.5%** | The dangerous case is rare, and it is handled |
| Pathed links hitting an **exact** vault path | 9,108 of 9,932 — **91.7%** | The common case is cheap |
| Case drift on segment one | `Tooling` 3,572 vs `tooling` 38 | Case-insensitive by default, not by option |
| Separator drift | `lost-in-public` 179 vs `Lost in Public` 8 | ` `, `-`, `_` are equivalent, not merely trimmed |
| Literal `../` or `./` links | **0** | Relative support is for authoring futures, not present pain |

### The cascade

Each tier is more speculative than the last, and every result reports which one answered (`via`), so a site can trust exact hits and audit the guesses:

| Tier | Matches | Rescues |
|---|---|---|
| `exact` | the normalised path is a vault file, verbatim | the 90% case |
| `suffix` | the path is a trailing run of segments of exactly one file | links written before a reorganisation |
| `basename` | the final segment names exactly one file | **the 28% of bare `[[Page]]` links** |
| `route` | nothing in the index — fall through to prefix rules | vaults with no index supplied |

**A tier matching more than one file does not fall through.** It stops, reports `ambiguous`, and resolves to nothing — so the wikilink renders as plain text with no anchor. A link that is wrong in a way nobody notices is worse than no link. That also means a `*` catch-all route will *not* rescue a collision.

### Performance — it is a Map, not a grep

The worry this design answers explicitly: resolving per-link by globbing or fuzzy-matching would make a build crawl. Nothing here scans per link. The index is three `Map`s built once; each resolution is a handful of `Map.get()` calls.

Measured on the full vault above:

```
fs walk (the site does this)  : 16.7 ms
index build (once)            : 21.9 ms
resolve ALL 13,556 wikilinks  : 103.7 ms  →  7.65 µs per link
```

**~100ms added to a whole-corpus build.** No queue is needed to make this fast; it already is.

### Deferral — for destinations an index genuinely cannot know

Deferral exists for the case where the answer is not on disk: a destination behind an API, in a sibling site's route table, or in content that has not been built yet.

```ts
paths: {
  index: vaultPaths,
  routes: [...],
  deferred: { to: '/link-resolve?p={path}', when: 'both', classes: ['is-provisional'] },
}
```

Unresolvable paths get a placeholder URL — point it at an SSR route to settle at request time — and land on a deduplicated, frequency-sorted worklist for a post-build rewrite pass:

```ts
const resolver = createPathResolver({ ... });
// …after the build has walked every document:
for (const entry of resolver.deferred()) {
  // { input, reason, url, candidates?, count }
}
```

### Everything is configuration

There is no policy baked into the package. Every judgment call is a field:

| Option | Default | Controls |
|---|---|---|
| `routes` | — | vault prefix(es) → destination template. First match wins; `'*'` is a catch-all; `to: null` deliberately parks a path |
| `index` | none | the vault sweep that unlocks bare names |
| `cascade` | `['exact','suffix','basename']` | which tiers to attempt, in order. `['exact','basename']` is a real preference, not a threshold |
| `onAmbiguous` | `'plain'` | `'plain'` \| `'first'` \| your own `(input, candidates) => file \| null` |
| `slugFrom` | `'basename'` | what `{slug}` means — `'basename'` \| `'tail'` \| `'full'` \| a function. Overridable per route |
| `tokens` | `{}` | extra `{token}` expansions beyond `{slug} {name} {path} {tail} {dir} {prefix}` |
| `base` | none | strip a mount prefix, so a vault at `src/generated-content/` routes as though at the root |
| `looseSeparators` | `true` | treat ` `, `-`, `_` as the same character |
| `caseSensitive` | `false` | match case-sensitively |
| `extensions` | `['.md','.mdx']` | stripped before matching |
| `slugify` / `display` | house defaults | override the slugifier or the display-text derivation |
| `preferAuthorDisplay` | `true` | whether an explicit `\|Display` beats the derived one |
| `deferred` | none | placeholder template + the post-build queue |
| `onDiagnostic` | none | every failure, with candidates on `ambiguous` |

`resolve()` takes a plain string and returns a plain result, so it is **not wikilink-specific** — the same "a human wrote a vault path, where does that live?" problem applies to image `src`, plain link targets, and frontmatter cross-references. `toWikilinkResolver()` is a thin adapter, not the main interface.

### Result against the real corpus

With the four routes above and no catch-all: **79.2% of 13,556 wikilinks resolve** — 8,200 exact, 2,094 by bare name, 441 by route, 3 by suffix. 42 collisions correctly become plain text. The rest are reported as `not-in-index` (mostly genuinely dangling) or `no-route` (folders those four rules don't claim).

Against a plugin whose stated operating principle is *supporting 40% of intended wikilinks is better than supporting none*, that is the difference between a vault that links and one that doesn't.
