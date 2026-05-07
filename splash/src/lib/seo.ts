/**
 * Static SEO copy for the LFM splash. Centralized so MetaTags + index hero +
 * og image generation all read from one source of truth.
 */

/**
 * OG / share image candidates — first round, generated via Ideogram per the
 * creative brief in `splash/DESIGN.md`. ImageKit-hosted; absolute URLs work
 * directly as `og:image` content.
 *
 * Future iteration:
 *   - Generate variants that leave headroom for an SVG title overlay so the
 *     banner itself can render "Lossless Flavored Markdown: <subtitle>"
 *     compositionally rather than relying on the platform's preview layer.
 *   - The current images are the visual aesthetic; the title-bearing version
 *     comes next.
 */
export const OG_IMAGES = {
  /** 1152×864 (4:3 landscape). Primary banner — the current `og:image` default. */
  banner: {
    url: 'https://ik.imagekit.io/xvpgfijuw/Image-Gin/2026-05/MarkEdit_content_1778193270620_fcifqzmRQ.webp',
    width: 1152,
    height: 864,
    type: 'image/webp',
    alt: 'Lossless Flavored Markdown — manuscript-meets-parser banner',
  },
  /** 1408×704 (≈2:1 wide). Closer to the OG 1.91:1 sweet spot — useful for
      Twitter/X large-image cards or LinkedIn-style banners. */
  wide: {
    url: 'https://ik.imagekit.io/xvpgfijuw/Image-Gin/2026-05/MarkEdit_content_1778193272219_FKDFzMbtq.webp',
    width: 1408,
    height: 704,
    type: 'image/webp',
    alt: 'Lossless Flavored Markdown — wide manuscript-meets-parser banner',
  },
  /** 1024×1024 (square). For Twitter `summary` card, social avatars, square share surfaces. */
  square: {
    url: 'https://ik.imagekit.io/xvpgfijuw/Image-Gin/2026-05/MarkEdit_content_1778193271406_w4BRdDH0U.webp',
    width: 1024,
    height: 1024,
    type: 'image/webp',
    alt: 'Lossless Flavored Markdown — square mark',
  },
  /** 736×1312 (≈9:16 portrait). For Stories / Pinterest / mobile-vertical share surfaces. */
  portrait: {
    url: 'https://ik.imagekit.io/xvpgfijuw/Image-Gin/2026-05/MarkEdit_content_1778193271777_xYg9QdmkC.webp',
    width: 736,
    height: 1312,
    type: 'image/webp',
    alt: 'Lossless Flavored Markdown — vertical manuscript-meets-parser banner',
  },
} as const;

/** The OG image used by default. Pages override via the `ogImage*` props on BaseLayout. */
export const DEFAULT_OG = OG_IMAGES.banner;

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
      'Roll your own flavor. A polyglot extended-markdown pipeline. Authors keep writing — LFM normalizes the variations. Ready for any framework without lock-in to someone elses flavor.',
  },

  changelog: {
    title: 'Changelog',
    description: 'What shipped, when, and why — entry-by-entry notes for @lossless-group/lfm.',
  },

  contextV: {
    title: 'Context Vigilance',
    description:
      'The context files, specs, habits, and reflections that shape how LFM is built. Versioned context, intentionally legible.',
  },
} as const;
