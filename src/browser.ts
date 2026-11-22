/**
 * @module
 *
 * **Lossless Flavored Markdown for the browser.** Everything you need to parse
 * LFM, including hex-code citations, with nothing that imports a Node builtin,
 * so it loads from a CDN in a page with no build step.
 *
 * Compared with the root entry it leaves out Open Graph fetching
 * (`lfmOgFetcher`, `OGDispatcher`, `OGCache`), which keeps a cache file on disk.
 * The `ogFetch` option is ignored here, with a warning. Fetch previews at build
 * time with `@lossless-group/lfm` instead. Syntax highlighting stays on its own
 * subpath, `/highlight`, so parsing doesn't download Shiki.
 *
 * @example From a CDN, rendered to HTML
 * ```js
 * import { unified } from 'https://esm.sh/unified@11';
 * import remarkParse from 'https://esm.sh/remark-parse@11';
 * import remarkRehype from 'https://esm.sh/remark-rehype@11';
 * import rehypeStringify from 'https://esm.sh/rehype-stringify@10';
 * import { remarkLfm } from 'https://cdn.jsdelivr.net/npm/@lossless-group/lfm/dist/browser.js/+esm';
 *
 * const html = String(
 *   await unified().use(remarkParse).use(remarkLfm).use(remarkRehype).use(rehypeStringify)
 *     .process('Cited.[^a3f9b2]\n\n[^a3f9b2]: [A source](https://example.com)'),
 * );
 * ```
 */

import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { createRemarkLfm } from './preset-core.js';
import type { RemarkLfmOptions } from './types/index.js';

/**
 * The remarkLfm preset, without Open Graph fetching. Same options and output as
 * the root entry's preset; `ogFetch` is ignored with a warning.
 */
export const remarkLfm: Plugin<[RemarkLfmOptions?], Root> = createRemarkLfm();

/** Parse a markdown string into an MDAST tree with all LFM extensions applied. */
export async function parseMarkdown(content: string, options?: RemarkLfmOptions): Promise<Root> {
  const processor = unified().use(remarkParse).use(remarkLfm, options);
  return (await processor.run(processor.parse(content) as Root)) as Root;
}

/** Create a unified processor with remark-parse and the LFM preset. */
export function createLfmProcessor(options?: RemarkLfmOptions): Processor {
  return unified().use(remarkParse).use(remarkLfm, options) as unknown as Processor;
}

/** Obsidian callout normalizer: `> [!type]` becomes a directive node. */
export { remarkLfmCallouts, remarkCallouts } from './plugins/remark-lfm-callouts.js';

/** Citation processor: hex-code renumbering, structured definition parsing. */
export { remarkLfmCitations, remarkCitations } from './plugins/remark-lfm-citations.js';

/** Code-fence router. Format handlers are on `/formats`, which is browser-safe too. */
export { remarkLfmCodeFences, remarkCodeFences } from './plugins/remark-lfm-code-fences.js';

/** Heading anchor ids and the document outline. */
export {
  remarkLfmHeadingIds,
  remarkHeadingIds,
  slugifyHeading,
  nestHeadings,
  filterHeadings,
} from './plugins/remark-lfm-heading-ids.js';

/** `$$` eyebrow / `&&` subheading binder. */
export {
  lfmHeadingBlocks,
  EYEBROW_MARKERS,
  SUBHEADING_MARKER,
  HEADING_BLOCK_NAME,
} from './plugins/lfm-heading-blocks.js';

/** Obsidian wikilink resolver. */
export { remarkLfmWikilinks, remarkLosslessWikilinks } from './plugins/remark-lfm-wikilinks.js';

/** `:::link-preview` / `:::link-rollup` directive annotator. */
export { lfmLinkPreview, remarkLinkPreview } from './plugins/lfm-link-preview.js';

/** `:::image-carousel` normalizer. */
export {
  lfmImageCarousel,
  parseImageStamp,
  sortSlides,
  collectCarouselSlides,
  CAROUSEL_VARIANTS,
  SEQUENCE_VARIANTS,
  DEFAULT_CAROUSEL_VARIANT,
} from './plugins/lfm-image-carousel.js';

/** Task line reader. Opt-in. */
export { lfmTaskMetadata } from './plugins/lfm-task-metadata.js';

/** MDX as a trigger syntax. */
export { remarkLfmMdx } from './plugins/remark-lfm-mdx.js';

/** Obsidian section embeds: `![[Note#Heading]]`. */
export { lfmCrossReferenceEmbeds, parseCrossReferenceEmbedTarget } from './plugins/lfm-cross-reference-embeds.js';

/** Obsidian comments: `%%private notes%%` are left out of the page. */
export { remarkLfmComments } from './plugins/remark-lfm-comments.js';

/** Task aggregator. */
export { aggregateTasks, groupTasks, tasksToMarkdown } from './utils/aggregate-tasks.js';

/** Vault-path to site-route resolver. */
export { createPathResolver, slugifyPath } from './utils/resolve-path.js';

/** URL classifier. */
export { classifyLink, getBareLinkUrl, collectLinkNodes } from './utils/classify-link.js';

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

export type {
  /** Normalized component node produced by all trigger syntaxes. */
  LfmComponentNode,
  /** Callout node produced by remarkCallouts. */
  LfmCalloutNode,
  /** Options for the remarkLfm preset. */
  RemarkLfmOptions,
  /** One binding from an MDX file's imports, with its resolved path. */
  LfmMdxImport,
  /** Options for the MDX trigger. */
  RemarkLfmMdxOptions,
  /** Options for Obsidian section embeds. */
  LfmCrossReferenceEmbedOptions,
  /** What an embed's `load` receives. */
  LfmCrossReferenceEmbedInput,
  /** A loaded document for an embed. */
  LfmCrossReferenceEmbedSource,
  /** `data.crossReferenceEmbed` on an embed node. */
  LfmCrossReferenceEmbedData,
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
  /** Options for the lfmTaskMetadata plugin. */
  LfmTaskMetadataOptions,
  /** Payload on a task `listItem`'s `data.task`. */
  LfmTaskMetadata,
  /** One entry in `tree.data.tasks`. */
  LfmTask,
  /** A parsed document handed to `aggregateTasks`. */
  LfmTaskDocument,
  /** A task returned by `aggregateTasks`, with its source. */
  LfmAggregatedTask,
  /** What tasks can be grouped on. */
  LfmTaskGroupBy,
  /** One group returned by `groupTasks`. */
  LfmTaskGroup,
  /** Options for `tasksToMarkdown`. */
  TasksToMarkdownOptions,
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
