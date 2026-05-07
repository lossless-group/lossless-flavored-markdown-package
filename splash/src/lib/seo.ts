/**
 * Static SEO copy for the LFM splash. Centralized so MetaTags + index hero +
 * og image generation all read from one source of truth.
 */

export const STATIC_SEO = {
  /** The site-wide brand string appended to per-page titles. */
  brand: 'Lossless Flavored Markdown',

  /** What appears as the suffix on every page title. */
  titleSuffix: ' — LFM',

  /** Canonical site URL (set in astro.config.mjs#site combined with base). */
  siteName: 'Lossless Flavored Markdown',

  root: {
    title: 'Lossless Flavored Markdown',
    description:
      'A polyglot extended-markdown pipeline. Authors keep writing — LFM normalizes the variations. One AST shape, many authoring conventions, ready for any framework.',
  },

  changelog: {
    title: 'Changelog',
    description: 'What shipped, when, and why — entry-by-entry notes for @lossless-group/lfm.',
  },

  contextV: {
    title: 'Context Vigilance',
    description:
      'The specs, habits, and reflections that shape how LFM is built. Versioned context, intentionally legible.',
  },
} as const;
