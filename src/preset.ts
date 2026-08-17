/**
 * remarkLfm — The Lossless Flavored Markdown preset for unified/remark.
 *
 * Chains together the core LFM plugins: GFM, directives, and custom extensions.
 * Use as a single `.use(remarkLfm)` call instead of wiring up individual plugins.
 *
 * Usage:
 *   import { unified } from 'unified';
 *   import remarkParse from 'remark-parse';
 *   import { remarkLfm } from '@lossless/lfm';
 *
 *   const processor = unified()
 *     .use(remarkParse)
 *     .use(remarkLfm);
 */

import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { remarkCallouts } from './plugins/remark-callouts.js';
import { remarkCitations } from './plugins/remark-citations.js';
import { remarkHeadingIds } from './plugins/remark-heading-ids.js';
import { remarkCodeFences } from './plugins/remark-code-fences.js';
import { remarkLosslessWikilinks } from './plugins/remark-lossless-wikilinks.js';
import { remarkOgFetcher } from './plugins/og-fetcher.js';
import { remarkLinkPreview } from './plugins/remark-link-preview.js';
import { lfmImageCarousel } from './plugins/lfm-image-carousel.js';
import type { RemarkLfmOptions } from './types/index.js';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';

/**
 * The Lossless Flavored Markdown preset for unified/remark.
 *
 * Chains together GFM, directives, callouts, and citations into a single
 * `.use(remarkLfm)` call. Each sub-plugin can be toggled via options.
 *
 * @example
 * ```ts
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import { remarkLfm } from '@lossless-group/lfm';
 *
 * const processor = unified().use(remarkParse).use(remarkLfm);
 * const tree = await processor.run(processor.parse(markdown));
 * ```
 */
export const remarkLfm: Plugin<[RemarkLfmOptions?], Root> = function (options?: RemarkLfmOptions) {
  const opts = {
    gfm: true,
    directives: true,
    callouts: true,
    citations: true,
    headingIds: true,
    ...options,
  } satisfies RemarkLfmOptions;

  const processor = this;

  if (opts.gfm) {
    processor.use(remarkGfm as Plugin);
  }

  if (opts.directives) {
    processor.use(remarkDirective as Plugin);
  }

  if (opts.callouts) {
    processor.use(remarkCallouts as Plugin);
  }

  // Citations must come after gfm (which creates footnote nodes).
  if (opts.citations) {
    processor.use(remarkCitations as Plugin);
  }

  // Heading ids run before anything that might rewrite heading children, so
  // the slug is computed from the text as authored. Enabled by default: an id
  // on a heading breaks nothing, and without it each site recomputes slugs
  // itself and they drift apart (see
  // context-v/Maintain-Heading-Anchors-and-Share-Links.md).
  if (opts.headingIds !== false) {
    processor.use(
      remarkHeadingIds,
      opts.headingIds === true || opts.headingIds === undefined ? undefined : opts.headingIds,
    );
  }

  // Code fences: opt-in only, and inert without registered formats. Kept out
  // of the defaults deliberately — a splash page shouldn't carry diagram
  // knowledge it never uses. Use `.use(remarkCodeFences, …)` directly for the
  // leanest bundle; this is the convenience path.
  if (opts.codeFences?.formats?.length) {
    processor.use(remarkCodeFences, opts.codeFences);
  }

  // Wikilinks: opt-in only — destinations are per-site, so a resolver is
  // required. Runs after callouts so wikilinks inside `> [!info]` callout
  // bodies still resolve. Skipped entirely when `wikilinks` is omitted or
  // `false`, which is the default.
  if (opts.wikilinks && opts.wikilinks !== (false as any)) {
    processor.use(remarkLosslessWikilinks, opts.wikilinks);
  }

  // OG fetcher runs before the link-preview annotator so the per-URL
  // `linkPreview` data is attached to each `link` node before link-preview
  // walks them. Disabled by default; the plugin itself short-circuits when
  // `enabled !== true`.
  if (opts.ogFetch) {
    processor.use(remarkOgFetcher, opts.ogFetch);
  }

  // Link-preview directive annotation runs whenever directives are enabled.
  // It stamps `data.linkPreviewSpec` on `:::link-preview` / `:::link-rollup`
  // containerDirective nodes (including any per-URL `items` data the
  // og-fetcher just attached) so the renderer can dispatch and pass props
  // to LinkPreviewCard / LinkRollup without re-walking children.
  if (opts.directives) {
    processor.use(remarkLinkPreview);
  }

  // Image-carousel annotation rides along with directives for the same reason
  // as link-preview: it only touches `:::image-carousel` / `:::img-carousel`
  // nodes, so it is inert on any document that contains none. It collapses the
  // `img-carousel` alias and stamps `data.carousel` with extracted, ordered
  // slides so renderers never re-walk children to find them.
  if (opts.directives) {
    processor.use(lfmImageCarousel);
  }
};
