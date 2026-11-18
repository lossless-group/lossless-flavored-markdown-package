// Starlight's `docs` collection, read straight from the package repo:
// README.md is the landing page, and every guide in docs-v/ is a page named
// after its file. docs-v/index.md is left out; the sidebar does its job here.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: '..',
      pattern: ['README.md', 'docs-v/*.md', '!docs-v/index.md'],
      generateId: ({ entry }) =>
        entry === 'README.md' ? 'index' : entry.replace(/^docs-v\//, '').replace(/\.md$/, ''),
    }),
    // The guides use `lede` for their one-line summary; Starlight calls it
    // `description`. The README has no frontmatter, so it gets a title here.
    schema: (context) =>
      z.preprocess(
        (data: any) => ({
          ...data,
          title: data?.title ?? 'Lossless Flavored Markdown',
          description: data?.description ?? data?.lede,
        }),
        docsSchema()(context),
      ),
  }),
};
