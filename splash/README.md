# lfm/splash

GitHub Pages splash for [`@lossless-group/lfm`](https://jsr.io/@lossless-group/lfm).

Live: <https://lossless-group.github.io/lossless-flavored-markdown-package/>

## What this is

A small Astro site that:

1. Greets visitors with a hero, the SCT (Syntax → Component Pipeline) paradigm diagram, and a curated gallery of LFM features.
2. Renders the parent's `changelog/` and (when populated) `context-v/` as readable archives.
3. Deploys for free off GitHub Pages on push to `main`.

It is **not** the eventual marketing site for LFM — when that exists, it'll live elsewhere with its own custom domain. The directory is named `splash/` precisely to keep that linguistic space open.

## How this stays out of the published package

Both publish channels use explicit allowlists, so nothing under `splash/` ever ships:

| Channel | Defined in | Allowlist |
|---|---|---|
| JSR (canonical) | `deno.json` → `publish.include` | `src/**/*.ts`, `src/**/*.md`, `deno.json`, `LICENSE`, `README.md` |
| npm mirror | `package.json` → `"files"` | `src`, `dist`, `README.md`, `LICENSE` |
| Build (`tsup`) | `tsup.config.ts` → `entry` | hard-coded `src/...ts` paths |

The `"private": true` in `splash/package.json` is defense-in-depth — it keeps this directory off any registry even if `npm publish` were run from inside it.

## Local dev

```bash
pnpm install --ignore-workspace
pnpm dev
```

The dev server respects `base: '/lossless-flavored-markdown-package/'`, so visit
<http://localhost:4321/lossless-flavored-markdown-package/>.

> `--ignore-workspace` keeps the splash from joining any parent monorepo workspace; it installs its own deps independently.

## Build

```bash
pnpm build
pnpm preview
```

Static output lands in `dist/`.

## Where things live

| Path | Purpose |
|---|---|
| `src/pages/index.astro` | Hero, SCT diagram, feature gallery, latest changelog |
| `src/pages/changelog/` | List + detail for `../changelog/` |
| `src/pages/context-v/` | List + detail for `../context-v/` (when present) |
| `src/components/SctDiagram.astro` | The Syntax → Parse → Component three-stage flow |
| `src/content/feature-highlights/*.md` | Curated cards in the feature gallery |
| `src/content/sct-examples/*.md` | Worked examples driving the SCT diagram's "Live example" panel |
| `src/content.config.ts` | Lenient collection schemas; reads `../changelog` and `../context-v` |
| `src/loaders/frontmatter.ts` | Tiny YAML-subset frontmatter parser (~150 lines, no `gray-matter`) |
| `src/layouts/BaseLayout.astro` | Tokens, fonts, head, body shell |
| `src/styles/theme.css` | Two-tier tokens + three-mode contract |

### Path aliases

`tsconfig.json` declares: `@components/*`, `@layouts/*`, `@loaders/*`, `@lib/*`, `@styles/*`, `@content/*`, `@pages/*`, `@/*`.

## Curating the feature gallery

Each card is one markdown file under `src/content/feature-highlights/`. Frontmatter:

```yaml
---
title: remark-callouts
lede: One-sentence pitch.
order: 40              # lower sorts first; alphabetical tiebreak
status: Stable         # Stable | Beta | Alpha | Experiment
icon: 📣               # emoji or path under /public
featured: true         # featured cards take a wider tile
tags: [Callouts, Obsidian]
---

Long-form description in markdown. Renders as the card's expanded body.
```

`order` ties are broken alphabetically by filename — never throws.

## Adding an SCT worked example

Drop a file in `src/content/sct-examples/`:

```yaml
---
title: Video Embeds
order: 10
featured: true        # the index hero renders the featured one
syntax_label: bare URL or directive
syntax_examples:
  - kind: bare
    code: 'youtu.be/share={id}'
  - kind: directive
    code: ':::youtube-share[https://youtu.be/jCe2wg1ulus]'
parse_file: src/plugins/remark-link-preview.ts
component_file: components/YoutubeShareEmbed--Base.astro
status: live          # live | planned
---

Body renders below the example panel.
```

## Deploy

`.github/workflows/pages.yml` (in the parent repo root) builds this site on push to `main` and deploys via `actions/deploy-pages@v4`. Configure GitHub Pages on the repo to "GitHub Actions" as the source.

## See also

- `context-v/habits/Maintain-a-Github-Splash-Page-for-each-Repo.md` (in `lossless-monorepo`) — the habit calling for one of these per repo
- `content-farm/splash/` — the canonical reference implementation (pseudomonorepo variant)
- `ai-labs/memopop-ai/apps/memopop-site/` — first instance of the pattern
