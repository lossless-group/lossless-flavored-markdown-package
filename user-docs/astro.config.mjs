// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { remarkDocsLinks } from './src/remark-docs-links.mjs';

// User docs for @lossless-group/lfm, built from ../docs-v and ../README.md (see
// src/content.config.ts). docs-v/ stays the one source; nothing is copied here.
// Served from the same GitHub Pages site as ../splash, under /docs/: the Pages
// workflow builds both and puts this dist/ at splash's dist/docs/.
const base = '/lossless-flavored-markdown-package/docs/';

export default defineConfig({
  site: 'https://lossless-group.github.io',
  base,
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [[remarkDocsLinks, { base }]],
  },
  integrations: [
    starlight({
      title: 'LFM docs',
      description: 'Lossless Flavored Markdown: many markdown conventions, one AST for your components.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/lossless-group/lossless-flavored-markdown-package' },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Getting started', link: '/' },
        {
          label: 'What you can write',
          items: [
            'headings',
            'citations',
            'cross-reference-embeds',
            'mdx',
            'wikilinks',
            'link-previews',
            'images',
            'code-fences',
            'highlighting',
            'tasks',
          ],
        },
        { label: 'Reference', items: ['types', 'roadmap'] },
        {
          label: 'More',
          items: [
            { label: 'Live demo', link: 'https://lossless-group.github.io/lossless-flavored-markdown-package/demo/' },
            { label: 'Changelog', link: 'https://lossless-group.github.io/lossless-flavored-markdown-package/changelog/' },
            { label: 'On JSR', link: 'https://jsr.io/@lossless-group/lfm' },
          ],
        },
      ],
    }),
  ],
});
