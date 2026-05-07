// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';

// Splash for @lossless-group/lfm.
// Hosted on GitHub Pages from lossless-group/lossless-flavored-markdown-package.
// Live URL: https://lossless-group.github.io/lossless-flavored-markdown-package/
//
// If a custom domain is added later, set `site` to that domain and `base` to '/'.
// (Distinct from any future custom-domain marketing site — that would live elsewhere.)
export default defineConfig({
  site: 'https://lossless-group.github.io',
  base: '/lossless-flavored-markdown-package/',
  trailingSlash: 'ignore',

  // astro-pagefind runs Pagefind against `dist/` after `astro build` and copies
  // pagefind/* into the published output. Search runs entirely client-side from
  // the static index — no backend, no cost, mode-pivot-aware via theme tokens.
  // See astro-knots/context-v/explorations/Implementing-Full-Text-Search-by-Default.md
  // for the convention rationale.
  integrations: [pagefind()],

  build: {
    // Pagefind needs a stable per-page URL — directory output ensures each
    // entry's data-pagefind-body lives at /changelog/<slug>/index.html.
    format: 'directory',
  },
});
