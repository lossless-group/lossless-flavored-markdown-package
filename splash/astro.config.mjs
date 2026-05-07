// @ts-check
import { defineConfig } from 'astro/config';

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
  build: {
    format: 'directory',
  },
});
