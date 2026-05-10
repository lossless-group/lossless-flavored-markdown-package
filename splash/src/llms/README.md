# Source of truth: human-editable prose for the llms.txt endpoints

These markdown files are read at build time by the endpoints in
`splash/src/pages/llms.txt.ts` and `splash/src/pages/llms-full.txt.ts`. The
endpoints are deliberately dumb — they do token substitution and append the
dynamic content. **All voice, framing, and structural prose lives here, not
in TypeScript.**

If you want to tweak the wording on `/llms.txt` or `/llms-full.txt`, edit the
corresponding `.md` file in this directory and rebuild. No code changes.

## Files

- `llms.md` — template for `/llms.txt` (the link index).
- `llms-full.md` — template for `/llms-full.txt` (the concatenated full content).

## Tokens (substituted at build time)

| Token | Used in | Replaced with |
|---|---|---|
| `{{SITE_NAME}}` | both | `STATIC_SEO.siteName` from `splash/src/lib/seo.ts` (`"Lossless Flavored Markdown"`). |
| `{{FEATURE_COUNT}}` | `llms.md` | Number of entries in the `feature-highlights` collection. |
| `{{EXAMPLE_COUNT}}` | `llms.md` | Number of entries in the `stc-examples` collection. |
| `{{CHANGELOG_COUNT}}` | both | Number of published `changelog` entries (those with `publish !== false`). |
| `{{CONTEXTV_COUNT}}` | both | Number of published `context-v` entries (those with `publish !== false`). |
| `{{SEARCH_URL}}` | `llms.md` | Absolute URL to `/search/` on the deployed site. |
| `{{LLMS_FULL_URL}}` | `llms.md` | Absolute URL to `/llms-full.txt`. |
| `{{LLMS_INDEX_URL}}` | `llms-full.md` | Absolute URL to `/llms.txt`. |
| `{{FEATURES_INDEX}}` | `llms.md` | Bullet list of feature highlights, sorted by `order` then title. Links target `${root}/#features` (the home page's features section anchor). |
| `{{EXAMPLES_INDEX}}` | `llms.md` | Bullet list of STC examples, sorted by `order` then title. Links target `${root}/` (examples render inline on the home page; no per-example route exists). |
| `{{CHANGELOG_INDEX}}` | `llms.md` | Bullet list of published changelog entries, sorted by `date_modified` descending. Links target `${root}/changelog/<id>/`. |
| `{{CONTEXTV_INDEX}}` | `llms.md` | Bullet list of published context-v entries, sorted alphabetically by title. Links target `${root}/context-v/<id>/`. |
| `{{CORPUS_BODIES}}` | `llms-full.md` | Concatenation of every published `changelog` + `context-v` entry's raw body, each preceded by a metadata header and separated by a horizontal rule. Sorted: changelog first (by date_modified desc), then context-v (alpha by title). |

Tokens are simple `{{NAME}}` placeholders — no Mustache, no Handlebars, no
templating engine. If a token is missing in the markdown, the endpoint emits
the file without it. If you add a new dynamic value, register it in the
endpoint's substitution map and document it here.

## Why a separate directory and not `src/lib/` or `src/content/`?

`src/lib/` is for code (TypeScript). `src/content/` is for Astro content
collections, which expect specific schemas and Astro-managed loaders. These
files are neither — they're prose templates that the build step reads as raw
strings via Vite's `?raw` import. Giving them their own directory keeps the
purpose obvious and makes the source-of-truth boundary easy to find.

## Publish gate

Both endpoints filter `changelog` and `context-v` entries with
`entry.data.publish !== false` — the **exact** predicate used by
`src/pages/changelog/[...slug].astro` and `src/pages/context-v/[...slug].astro`.
If those page templates change their gate, the endpoints must follow so
drafts cannot leak into `/llms-full.txt` after they were excluded from the
rendered HTML.
