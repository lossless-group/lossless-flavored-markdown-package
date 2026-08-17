/**
 * lfm-image-carousel: Normalizes `:::image-carousel` / `:::img-carousel`
 * container directives into a single, renderer-ready shape.
 *
 * Converts:
 *   :::image-carousel{variant="stepper" title="Setting up Aside"}
 *   ::image{src="/1.jpg" alt="Welcome screen" label="Welcome" caption="…"}
 *   ::image{src="/2.jpg" alt="Recovery key"  label="Recovery key"}
 *   :::
 *
 * Into a containerDirective with `name: "image-carousel"` and a populated
 * `node.data.carousel` payload, so every consuming framework (Astro, Svelte,
 * Solid, plain HTML) reads one contract instead of re-implementing slide
 * extraction and ordering.
 *
 * `img-carousel` is a syntactic alias and collapses to `image-carousel` here —
 * the polyglot rule: authors pick the syntax that fits their hand, the renderer
 * sees one node.
 */

import type { Root } from 'mdast';
import type { Plugin } from 'unified';

/** Variants shipped by the standard library. */
export const CAROUSEL_VARIANTS = ['filmstrip', 'stepper', 'peek', 'contact-sheet'] as const;
export type CarouselVariant = (typeof CAROUSEL_VARIANTS)[number];

export const DEFAULT_CAROUSEL_VARIANT: CarouselVariant = 'filmstrip';

/**
 * Variants whose whole point is *order* — a setup flow, a before/after, a
 * step-by-step. These default to chronological sorting; the rest default to
 * the order the author wrote.
 *
 * `contact-sheet` is deliberately excluded: it renders every frame at once in
 * a grid, so reading order is the grid's, and reordering would only shuffle
 * the ordinal badges against no visual sequence.
 */
export const SEQUENCE_VARIANTS: readonly CarouselVariant[] = ['filmstrip', 'stepper', 'peek'];

export type CarouselSort = 'chronological' | 'reverse-chronological' | 'authored';

export interface CarouselSlide {
  src: string;
  alt: string;
  /** Short step name, e.g. "Recovery key". */
  label?: string;
  caption?: string;
  /** Parsed from the filename stamp; `null` when the filename carries none. */
  capturedAt: Date | null;
  /** Position as written in the markdown, before any sort. Always preserved. */
  authoredIndex: number;
}

export interface CarouselData {
  variant: CarouselVariant;
  sort: CarouselSort;
  title?: string;
  numbered: boolean;
  maxHeight?: string;
  slides: CarouselSlide[];
}

/**
 * ISO 8601 **basic format**, UTC — the stamp appended to every filename by the
 * house image-prep convention:
 *
 *   Aside__Welcome-Screen_20260817T164659Z.jpg
 *                         └────────────────┘
 *
 * Basic format (no separators) exists precisely so timestamps survive being
 * embedded in filenames and URLs, where `:` is illegal or hostile.
 */
const FILENAME_STAMP = /_(\d{8})T(\d{6})Z(?=\.[A-Za-z0-9]+$|$)/;

/**
 * Extract the capture stamp from an image URL or filename.
 *
 * Returns `null` when the filename carries no stamp — which is not an error.
 * Unstamped slides keep their authored position (see `sortSlides`).
 */
export function parseImageStamp(src: string): Date | null {
  if (!src) return null;
  const base = src.split('/').pop() ?? src;
  const m = FILENAME_STAMP.exec(base);
  if (!m) return null;
  const [, d, t] = m;
  const iso =
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` +
    `T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Order slides.
 *
 * **The sort is stable, and that is load-bearing.** Slides whose stamps are
 * equal — or absent — fall back to the order the author wrote them in. That
 * single property is what makes chronological a safe default rather than a
 * footgun; see the caveat in the module docs of `image-carousel` in the README.
 */
export function sortSlides(slides: CarouselSlide[], sort: CarouselSort): CarouselSlide[] {
  if (sort === 'authored') return slides;

  const dir = sort === 'reverse-chronological' ? -1 : 1;
  return [...slides].sort((a, b) => {
    // Unstamped slides never jump the queue — they hold their authored slot
    // relative to each other and sort after nothing.
    if (a.capturedAt === null && b.capturedAt === null) return a.authoredIndex - b.authoredIndex;
    if (a.capturedAt === null) return a.authoredIndex - b.authoredIndex;
    if (b.capturedAt === null) return a.authoredIndex - b.authoredIndex;
    const delta = a.capturedAt.getTime() - b.capturedAt.getTime();
    // Equal stamps (the common case — one prep run stamps a whole batch
    // identically) resolve to authored order.
    return delta === 0 ? a.authoredIndex - b.authoredIndex : delta * dir;
  });
}

/**
 * Collect slides from a carousel's children.
 *
 * Accepts the LFM `::image{}` leaf directive and plain markdown `![alt](src)`,
 * and recurses through paragraphs — remark wraps loose inline content in a
 * paragraph, so directives usually arrive nested one level down.
 */
export function collectCarouselSlides(node: any, acc: CarouselSlide[] = []): CarouselSlide[] {
  for (const child of node?.children ?? []) {
    if (child.type === 'leafDirective' && child.name === 'image') {
      const a = child.attributes || {};
      const src = a.src || '';
      acc.push({
        src,
        alt: a.alt || '',
        label: a.label || undefined,
        caption: a.caption || undefined,
        capturedAt: parseImageStamp(src),
        authoredIndex: acc.length,
      });
    } else if (child.type === 'image') {
      const src = child.url || '';
      acc.push({
        src,
        alt: child.alt || '',
        caption: child.title || undefined,
        capturedAt: parseImageStamp(src),
        authoredIndex: acc.length,
      });
    } else if (child.children) {
      collectCarouselSlides(child, acc);
    }
  }
  return acc;
}

function resolveVariant(raw: unknown): CarouselVariant {
  const v = String(raw ?? DEFAULT_CAROUSEL_VARIANT) as CarouselVariant;
  // Unknown values degrade to the default rather than failing the build —
  // LFM's no-hard-validation posture.
  return CAROUSEL_VARIANTS.includes(v) ? v : DEFAULT_CAROUSEL_VARIANT;
}

function resolveSort(raw: unknown, variant: CarouselVariant): CarouselSort {
  const s = String(raw ?? '') as CarouselSort;
  if (s === 'chronological' || s === 'reverse-chronological' || s === 'authored') return s;
  // Sequence variants exist to convey order, so they read the stamp by default.
  return SEQUENCE_VARIANTS.includes(variant) ? 'chronological' : 'authored';
}

/**
 * Remark plugin that normalizes image-carousel directives.
 *
 * @example
 * ```ts
 * import { unified } from 'unified';
 * import remarkParse from 'remark-parse';
 * import remarkDirective from 'remark-directive';
 * import { lfmImageCarousel } from '@lossless-group/lfm';
 *
 * const processor = unified().use(remarkParse).use(remarkDirective).use(lfmImageCarousel);
 * ```
 */
export const lfmImageCarousel: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const visit = (node: any) => {
      for (const child of node?.children ?? []) {
        if (
          child.type === 'containerDirective' &&
          (child.name === 'image-carousel' || child.name === 'img-carousel')
        ) {
          // Collapse the alias so renderers match on one name.
          child.name = 'image-carousel';

          const attrs = child.attributes || {};
          const variant = resolveVariant(attrs.variant);
          const sort = resolveSort(attrs.sort, variant);
          const slides = sortSlides(collectCarouselSlides(child), sort);

          const data: CarouselData = {
            variant,
            sort,
            title: attrs.title || undefined,
            // Ordinals are the point of a sequence; allow opting out explicitly.
            numbered: attrs.numbered !== 'false',
            maxHeight: attrs['max-height'] || undefined,
            slides,
          };

          child.data = { ...(child.data || {}), carousel: data };
        }
        if (child.children) visit(child);
      }
    };
    visit(tree);
  };
};

export default lfmImageCarousel;
