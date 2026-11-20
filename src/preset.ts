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
import { remarkLfmCallouts } from './plugins/remark-lfm-callouts.js';
import { remarkLfmCitations } from './plugins/remark-lfm-citations.js';
import { remarkLfmHeadingIds } from './plugins/remark-lfm-heading-ids.js';
import { remarkLfmCodeFences } from './plugins/remark-lfm-code-fences.js';
import { remarkLfmWikilinks } from './plugins/remark-lfm-wikilinks.js';
import { lfmOgFetcher } from './plugins/lfm-og-fetcher.js';
import { lfmLinkPreview } from './plugins/lfm-link-preview.js';
import { lfmImageCarousel } from './plugins/lfm-image-carousel.js';
import { lfmHeadingBlocks } from './plugins/lfm-heading-blocks.js';
import { lfmTaskMetadata } from './plugins/lfm-task-metadata.js';
import { remarkLfmMdx } from './plugins/remark-lfm-mdx.js';
import { lfmWordColons } from './plugins/lfm-word-colons.js';
import { lfmCrossReferenceEmbeds } from './plugins/lfm-cross-reference-embeds.js';
import { remarkLfmComments } from './plugins/remark-lfm-comments.js';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
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
    headingBlocks: true,
    comments: true,
    ...options,
  } satisfies RemarkLfmOptions;

  const processor = this;

  if (opts.gfm) {
    processor.use(remarkGfm as Plugin);
  }

  if (opts.directives) {
    processor.use(remarkDirective as Plugin);
    // `re:Invent` is a word, not a `:Invent` directive.
    processor.use(lfmWordColons);
  }

  // MDX: opt-in, for .mdx files only, since it changes how `<` and `{` parse.
  // Runs before every transform so the rest of the pipeline sees componentNodes
  // and plain text, never raw JSX or ESM.
  if (opts.mdx) {
    processor.use(remarkLfmMdx, opts.mdx === true ? undefined : opts.mdx);
  }

  // Comments: on by default, since a `%%note%%` is written to stay private.
  // Runs before every other transform, so nothing downstream (embeds, ids, the
  // outline, citations) ever sees what was commented out.
  if (opts.comments !== false) {
    processor.use(remarkLfmComments);
  }

  // Embeds: opt-in, since a site has to say how to load another document.
  // Runs before callouts, citations, heading ids and wikilinks, so embedded
  // nodes go through the host's pipeline like its own. Each embedded document
  // is parsed with these same options, one level deeper, minus the features
  // that belong to the host: ids, eyebrows and citations are computed once,
  // for the whole page.
  if (opts.crossReferenceEmbeds) {
    const depth = (opts.crossReferenceEmbeds as { depth?: number }).depth ?? 0;
    processor.use(lfmCrossReferenceEmbeds, {
      ...opts.crossReferenceEmbeds,
      depth,
      parseEmbedded: async (markdown: string, nextDepth: number) => {
        const inner = unified().use(remarkParse).use(remarkLfm, {
          ...options,
          mdx: false,
          citations: false,
          headingIds: false,
          headingBlocks: false,
          crossReferenceEmbeds: { ...(opts.crossReferenceEmbeds as object), depth: nextDepth } as any,
        });
        return (await inner.run(inner.parse(markdown))) as Root;
      },
    } as any);
  }

  if (opts.callouts) {
    processor.use(remarkLfmCallouts as Plugin);
  }

  // Citations must come after gfm (which creates footnote nodes).
  if (opts.citations) {
    processor.use(remarkLfmCitations as Plugin);
  }

  // Heading ids run before anything that might rewrite heading children, so
  // the slug is computed from the text as authored. Enabled by default: an id
  // on a heading breaks nothing, and without it each site recomputes slugs
  // itself and they drift apart (see
  // context-v/specs/Maintain-Heading-Anchors-and-Share-Links.md).
  if (opts.headingIds !== false) {
    processor.use(
      remarkLfmHeadingIds,
      opts.headingIds === true || opts.headingIds === undefined ? undefined : opts.headingIds,
    );
  }

  // Heading blocks run immediately after heading ids, and the order is load
  // bearing in both directions: ids must be computed from the document as
  // authored, and the `<hgroup>` this emits is a containerDirective — running
  // it first would make every eyebrow heading look nested, so `inContainer`
  // would filter the whole document out of its own table of contents. It also
  // back-fills `eyebrow` onto the outline entries the id plugin just built.
  if (opts.headingBlocks !== false) {
    processor.use(lfmHeadingBlocks);
  }

  // Code fences: opt-in only, and inert without registered formats. Kept out
  // of the defaults deliberately — a splash page shouldn't carry diagram
  // knowledge it never uses. Use `.use(remarkLfmCodeFences, …)` directly for the
  // leanest bundle; this is the convenience path.
  if (opts.codeFences?.formats?.length) {
    processor.use(remarkLfmCodeFences, opts.codeFences);
  }

  // Wikilinks: opt-in only — destinations are per-site, so a resolver is
  // required. Runs after callouts so wikilinks inside `> [!info]` callout
  // bodies still resolve. Skipped entirely when `wikilinks` is omitted or
  // `false`, which is the default.
  if (opts.wikilinks && opts.wikilinks !== (false as any)) {
    processor.use(remarkLfmWikilinks, opts.wikilinks);
  }

  // Task metadata: opt-in only — most existing checkboxes weren't written to
  // this convention. Runs after wikilinks so a `#` inside `[[Page #Section]]` is
  // already part of a link node and can't read as a tag.
  if (opts.taskMetadata) {
    processor.use(
      lfmTaskMetadata,
      opts.taskMetadata === true ? undefined : opts.taskMetadata,
    );
  }

  // OG fetcher runs before the link-preview annotator so the per-URL
  // `linkPreview` data is attached to each `link` node before link-preview
  // walks them. Disabled by default; the plugin itself short-circuits when
  // `enabled !== true`.
  if (opts.ogFetch) {
    processor.use(lfmOgFetcher, opts.ogFetch);
  }

  // Link-preview directive annotation runs whenever directives are enabled.
  // It stamps `data.linkPreviewSpec` on `:::link-preview` / `:::link-rollup`
  // containerDirective nodes (including any per-URL `items` data the
  // og-fetcher just attached) so the renderer can dispatch and pass props
  // to LinkPreviewCard / LinkRollup without re-walking children.
  if (opts.directives) {
    processor.use(lfmLinkPreview);
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
