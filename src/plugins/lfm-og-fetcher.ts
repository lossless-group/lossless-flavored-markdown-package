/**
 * @module
 *
 * lfm-og-fetcher — build-time Open Graph enrichment for external links.
 *
 * Walks the MDAST tree, collects every external (http/https) `link` node's
 * URL, batches them through the dispatcher (cache + retries + concurrency
 * + rate-limit), and attaches the resulting `LinkPreviewData` to each
 * link's `node.data.linkPreview` field.
 *
 * Renderers and downstream plugins (e.g. the forthcoming `lfm-link-preview`
 * directive plugin and the popover system) read from `node.data.linkPreview`
 * — they never fetch on their own. This keeps the network surface of the
 * pipeline confined to one place and the cache to one file per site.
 *
 * Opt-out per link: set `node.data.skipOgFetch = true` from another plugin,
 * or author the link with `{.no-preview}` in markdown (handled by a separate
 * attribute-parsing plugin, not here).
 *
 * Disabled by default. Enable per-site via:
 *   remarkLfm({ ogFetch: { enabled: true, backend: 'opengraph-io', apiKey: ... } })
 */

import type { Root, Link } from 'mdast';
import type { Plugin } from 'unified';
import type { OGFetchOptions, LinkPreviewData } from '../types/index.js';
import { createOGDispatcher } from '../utils/og-dispatcher.js';

/**
 * MDAST `link` nodes get `linkPreview` and (optionally) `skipOgFetch`
 * attached to their `data` field by this plugin. We previously augmented
 * the upstream `mdast.LinkData` interface via `declare module 'mdast'`,
 * but JSR rejects ambient module declarations (slow-types check) — they
 * modify a third-party module's types from outside, which breaks the
 * automatic .d.ts generation JSR does for Node consumers.
 *
 * Renderers should cast `node.data.linkPreview` to `LinkPreviewData` at
 * read sites. Writes inside this file use a spread + cast.
 */
type LinkDataExtras = { linkPreview?: LinkPreviewData; skipOgFetch?: boolean };

/**
 * Collect every `link` node in the tree whose `url` is http(s) and that
 * hasn't been opted out via `data.skipOgFetch`.
 *
 * Hand-rolled walker (rather than `unist-util-visit`) keeps this plugin
 * dependency-free, matching the convention in `remark-lfm-callouts`.
 */
function collectExternalLinks(node: any, sink: Link[]): void {
  if (!node) return;
  if (node.type === 'link') {
    const url: string | undefined = node.url;
    const skipped = (node.data as LinkDataExtras | undefined)?.skipOgFetch === true;
    if (url && /^https?:\/\//i.test(url) && !skipped) {
      sink.push(node as Link);
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectExternalLinks(child, sink);
  }
}

export const lfmOgFetcher: Plugin<[OGFetchOptions?], Root> = function (options) {
  const opts: OGFetchOptions = { enabled: false, ...(options ?? {}) };

  // No-op fast path. Avoid loading the cache, opening the file, etc.
  if (!opts.enabled) {
    return async () => {};
  }

  return async (tree: Root) => {
    const links: Link[] = [];
    collectExternalLinks(tree, links);
    if (links.length === 0) return;

    const dispatcher = await createOGDispatcher(opts);

    // Deduplicate URLs — multiple links to the same target share one fetch.
    const byUrl = new Map<string, Link[]>();
    for (const link of links) {
      const list = byUrl.get(link.url) ?? [];
      list.push(link);
      byUrl.set(link.url, list);
    }

    const urls = [...byUrl.keys()];

    // The dispatcher's semaphore handles concurrency; we can fire them all.
    const results = await Promise.all(urls.map((url) => dispatcher.fetch(url)));

    for (let i = 0; i < urls.length; i += 1) {
      const url = urls[i];
      const result = results[i];
      const targets = byUrl.get(url) ?? [];
      for (const link of targets) {
        link.data = { ...(link.data ?? {}), linkPreview: result.data } as typeof link.data & LinkDataExtras;
      }
    }

    await dispatcher.flush();
  };
};

/**
 * @deprecated Renamed to `lfmOgFetcher` in 0.5.0. The `remark-*` prefix is reserved for
 * plugins authored outside LFM; everything in this package is ours. This alias
 * is permanent-until-a-major and costs nothing — keep using it if you like, or
 * switch at your leisure.
 */
export const remarkOgFetcher = lfmOgFetcher;
