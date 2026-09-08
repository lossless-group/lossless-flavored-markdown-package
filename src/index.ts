/**
 * @module
 *
 * **Lossless Flavored Markdown** — a polyglot extended markdown pipeline for remark/rehype.
 *
 * One package, one import. Bundles unified, remark-parse, remark-gfm, remark-directive,
 * and custom plugins into a single `parseMarkdown()` call.
 *
 * @example Basic usage
 * ```ts
 * import { parseMarkdown } from '@lossless-group/lfm';
 *
 * const tree = await parseMarkdown('# Hello\n\nSome **markdown** content.');
 * // tree is an MDAST — pass to your renderer
 * ```
 *
 * @example As a remark preset
 * ```ts
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import { remarkLfm } from '@lossless-group/lfm';
 *
 * const processor = unified().use(remarkParse).use(remarkLfm);
 * const tree = await processor.run(processor.parse(content));
 * ```
 */

/** Parse a markdown string into an MDAST tree with all LFM extensions applied. */
export { parseMarkdown, createLfmProcessor } from './parse.js';

/** The remarkLfm preset — chains remarkGfm + remarkDirective + remarkCallouts. */
export { remarkLfm } from './preset.js';

/** Obsidian callout normalizer — transforms `> [!type]` into directive nodes. */
export { remarkLfmCallouts, remarkCallouts } from './plugins/remark-lfm-callouts.js';

/** Citation processor — hex-code renumbering, structured definition parsing. */
export { remarkLfmCitations, remarkCitations } from './plugins/remark-lfm-citations.js';

/** Code-fence router — annotates fences with a resolved format handler.
 *  Ships with an empty registry; you pay for the formats you name. */
export { remarkLfmCodeFences, remarkCodeFences } from './plugins/remark-lfm-code-fences.js';

/** Heading anchor ids + document outline — stamps `data.id` on every heading
 *  and attaches `tree.data.headings`. A fragment URL is a public contract;
 *  this is the one place that decides what it says. */
export {
  remarkLfmHeadingIds,
  remarkHeadingIds,
  slugifyHeading,
  nestHeadings,
  filterHeadings,
} from './plugins/remark-lfm-heading-ids.js';

/** `$$` eyebrow / `&&` subheading binder — wraps a heading and its adjacent
 *  editorial lines in one `<hgroup>`, and stamps `eyebrow` onto the outline. */
export {
  lfmHeadingBlocks,
  EYEBROW_MARKERS,
  SUBHEADING_MARKER,
  HEADING_BLOCK_NAME,
} from './plugins/lfm-heading-blocks.js';

/** Obsidian wikilink resolver — site-configured internal/external path mapping
 *  for `[[Page]]`, `[[Page|Display]]`, `[[folder/Page#Section|Display]]`. */
export { remarkLfmWikilinks, remarkLosslessWikilinks } from './plugins/remark-lfm-wikilinks.js';

/** Build-time Open Graph metadata fetcher — enriches external links with preview data. */
export { lfmOgFetcher, remarkOgFetcher } from './plugins/lfm-og-fetcher.js';

/** `:::link-preview` / `:::link-rollup` directive annotator — stamps `data.linkPreviewSpec`. */
export { lfmLinkPreview, remarkLinkPreview } from './plugins/lfm-link-preview.js';

/** `:::image-carousel` / `:::img-carousel` normalizer — collapses the alias,
 *  extracts slides, and orders sequence variants by their filename timestamp. */
export {
  lfmImageCarousel,
  parseImageStamp,
  sortSlides,
  collectCarouselSlides,
  CAROUSEL_VARIANTS,
  SEQUENCE_VARIANTS,
  DEFAULT_CAROUSEL_VARIANT,
} from './plugins/lfm-image-carousel.js';

export type {
  /** Payload attached to `containerDirective.data.carousel`. */
  CarouselData,
  /** One slide, with its parsed `capturedAt` and preserved `authoredIndex`. */
  CarouselSlide,
  /** Variant taxonomy for `ImageCarousel--*` components. */
  CarouselVariant,
  /** Ordering policy — chronological (default for sequence variants), reverse, or authored. */
  CarouselSort,
} from './plugins/lfm-image-carousel.js';

/** Vault-path → site-route resolver. The declarative half of wikilink
 *  resolution: normalisation, the index cascade (exact → suffix → basename),
 *  relative paths, and template expansion, so sites supply config rather than
 *  a hand-written resolver function. Opt-in; omit it and nothing changes. */
export { createPathResolver, slugifyPath } from './utils/resolve-path.js';

export type {
  /** Declarative configuration for `createPathResolver`. */
  PathResolverConfig,
  /** One routing rule — vault prefix(es) → destination template. */
  PathRoute,
  /** The object `createPathResolver` returns. */
  PathResolver,
  /** A successful resolution, including which cascade tier answered. */
  ResolvedPath,
  /** Which tier answered: exact | suffix | basename | route. */
  ResolutionTier,
  /** Why a resolution failed, or that a route deliberately parked it. */
  PathDiagnostic,
  /** Decomposed path handed to slug strategies and templates. */
  PathParts,
  /** What `{slug}` means for a route. */
  SlugStrategy,
  /** Optional per-call context — the document the link was written from. */
  ResolveContext,
} from './utils/resolve-path.js';

/** URL classifier — turns a raw URL into provider/kind metadata via the catalog matchers. */
export { classifyLink, getBareLinkUrl, collectLinkNodes } from './utils/classify-link.js';

export type {
  /** Spec attached to `containerDirective.data.linkPreviewSpec`. */
  LinkPreviewSpec,
  /** Format taxonomy for `LinkPreview__*` components. */
  LinkPreviewFormat,
  /** Format taxonomy for `LinkRollup__*` components. */
  LinkRollupFormat,
} from './plugins/lfm-link-preview.js';

export type {
  /** Result of a successful URL classification. */
  LinkClassification,
  /** Catalog `kind` taxonomy. */
  LinkProviderKind,
} from './utils/classify-link.js';

/** Per-build OG dispatcher (cache + retries + concurrency + rate-limit). */
export { OGDispatcher, createOGDispatcher } from './utils/og-dispatcher.js';

/** OG cache loader and class — direct access for sites that want to inspect or invalidate. */
export { OGCache, loadOGCache, hashUrl } from './utils/og-cache.js';

export type {
  /** Normalized component node produced by all trigger syntaxes. */
  LfmComponentNode,
  /** Callout node produced by remarkCallouts. */
  LfmCalloutNode,
  /** Options for the remarkLfm preset. */
  RemarkLfmOptions,
  /** Options for the remarkHeadingIds plugin. */
  RemarkHeadingIdsOptions,
  /** Options for the remarkCodeFences plugin. */
  RemarkCodeFencesOptions,
  /** A code-fence format handler. */
  FenceFormat,
  /** Stamped onto a claimed `code` node's `data.fence`. */
  FenceData,
  /** One entry in the `tree.data.headings` outline. */
  LfmHeading,
  /** The nested form of the outline, produced by `nestHeadings()`. */
  LfmHeadingNode,
  /** Plain-text payload on a heading block's `data.headingBlock`. */
  HeadingBlockData,
  /** Input passed to a wikilink resolver function. */
  WikilinkResolverInput,
  /** Resolution returned by a wikilink resolver function. */
  WikilinkResolution,
  /** Options for the remarkLosslessWikilinks plugin. */
  WikilinkOptions,
  /** Render-surface metadata for a single link. */
  LinkPreviewData,
  /** Result returned by an OG backend. */
  OGFetchResult,
  /** Backend identifier strings accepted by the dispatcher. */
  OGBackendName,
  /** Backend function signature. */
  OGBackend,
  /** Options passed to a backend on each call. */
  OGBackendOptions,
  /** Per-site OG fetch configuration. */
  OGFetchOptions,
} from './types/index.js';

export type {
  /** A single parsed citation with index, metadata, and raw text. */
  Citation,
  /** The full citation dataset attached to tree.data.citations. */
  CitationsData,
  /** A validation warning from the citation processor. */
  CitationWarning,
  /** Options for the remarkCitations plugin. */
  RemarkCitationsOptions,
} from './plugins/remark-lfm-citations.js';
