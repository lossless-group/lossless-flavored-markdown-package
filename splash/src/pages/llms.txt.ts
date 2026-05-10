/**
 * /llms.txt — index of LFM splash content for LLM consumers.
 *
 * Spec: https://llmstxt.org/
 *
 * The human-editable prose template for this file lives at
 * `splash/src/llms/llms.md` (with token documentation in
 * `splash/src/llms/README.md`). This file is the dumb assembler: it loads
 * the template, computes dynamic values, and substitutes tokens. To tweak
 * the voice or framing of /llms.txt, edit the markdown — not this file.
 *
 * Conformance note: the spec assumes the file lives at the host root
 * (https://host/llms.txt). The splash deploys under a path on GitHub Pages
 * (/lossless-flavored-markdown-package/), so the file lives at
 * https://lossless-group.github.io/lossless-flavored-markdown-package/llms.txt.
 * Tools pointed explicitly at that URL still work; convention-based
 * discovery starts working once `astro.config.mjs` flips `base` to '/'.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { STATIC_SEO } from '@lib/seo';
import { toDate } from '@lib/date';
import template from '../llms/llms.md?raw';

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE ?? 'https://lossless-group.github.io';
  const base = import.meta.env.BASE_URL ?? '/';
  const root = new URL(base, site).toString().replace(/\/$/, '');

  // ─── Curated collections (live in splash/src/content/) ────────────────────

  const featureHighlights = await getCollection('feature-highlights');
  const stcExamples = await getCollection('stc-examples');

  // Sort: order ascending, then title alpha. Same ordering the home page uses.
  const byOrderThenTitle = (
    a: { data: any; id: string },
    b: { data: any; id: string },
  ): number => {
    const ao = (a.data.order ?? Number.MAX_SAFE_INTEGER) as number;
    const bo = (b.data.order ?? Number.MAX_SAFE_INTEGER) as number;
    if (ao !== bo) return ao - bo;
    const ta = (a.data.title ?? a.id).toString().toLowerCase();
    const tb = (b.data.title ?? b.id).toString().toLowerCase();
    return ta.localeCompare(tb);
  };

  featureHighlights.sort(byOrderThenTitle);
  stcExamples.sort(byOrderThenTitle);

  // Feature highlights and STC examples don't have per-entry routes — they
  // render inline on the home page. Point at the features anchor and at the
  // home page itself respectively.
  const featuresHomeUrl = `${root}/#features`;
  const homeUrl = `${root}/`;

  const featuresLines: string[] = [];
  for (const entry of featureHighlights) {
    const title = (entry.data as any).title ?? entry.id;
    const lede = (entry.data as any).lede;
    featuresLines.push(
      lede ? `- [${title}](${featuresHomeUrl}): ${lede}` : `- [${title}](${featuresHomeUrl})`,
    );
  }

  const examplesLines: string[] = [];
  for (const entry of stcExamples) {
    const data = entry.data as any;
    const title = data.title ?? entry.id;
    const lede = data.lede ?? data.syntax_label;
    examplesLines.push(
      lede ? `- [${title}](${homeUrl}): ${lede}` : `- [${title}](${homeUrl})`,
    );
  }

  // ─── Long-form collections (publish gate matches [...slug].astro) ────────

  const changelogAll = await getCollection('changelog');
  const changelog = changelogAll.filter((e) => (e.data as any).publish !== false);

  changelog.sort((a, b) => {
    const da = toDate(
      (a.data as any).date_modified ??
        (a.data as any).date_first_published ??
        (a.data as any).date_created ??
        (a.data as any).date,
    );
    const db = toDate(
      (b.data as any).date_modified ??
        (b.data as any).date_first_published ??
        (b.data as any).date_created ??
        (b.data as any).date,
    );
    const ta = da ? da.getTime() : 0;
    const tb = db ? db.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return a.id < b.id ? 1 : -1;
  });

  const changelogLines: string[] = [];
  for (const entry of changelog) {
    const data = entry.data as any;
    const title = data.title ?? entry.id;
    const url = `${root}/changelog/${entry.id}/`;
    const lede = data.lede ?? data.summary ?? data.description;
    changelogLines.push(lede ? `- [${title}](${url}): ${lede}` : `- [${title}](${url})`);
  }

  const contextVAll = await getCollection('context-v');
  const contextV = contextVAll.filter((e) => (e.data as any).publish !== false);

  contextV.sort((a, b) => {
    const ta = ((a.data as any).title ?? a.id).toString().toLowerCase();
    const tb = ((b.data as any).title ?? b.id).toString().toLowerCase();
    return ta.localeCompare(tb);
  });

  const contextVLines: string[] = [];
  for (const entry of contextV) {
    const data = entry.data as any;
    const title = data.title ?? entry.id;
    const url = `${root}/context-v/${entry.id}/`;
    const lede = data.lede ?? data.summary ?? data.description ?? data.purpose;
    contextVLines.push(lede ? `- [${title}](${url}): ${lede}` : `- [${title}](${url})`);
  }

  const tokens: Record<string, string> = {
    SITE_NAME: STATIC_SEO.siteName,
    FEATURE_COUNT: String(featureHighlights.length),
    EXAMPLE_COUNT: String(stcExamples.length),
    CHANGELOG_COUNT: String(changelog.length),
    CONTEXTV_COUNT: String(contextV.length),
    SEARCH_URL: `${root}/search/`,
    LLMS_FULL_URL: `${root}/llms-full.txt`,
    LLMS_INDEX_URL: `${root}/llms.txt`,
    FEATURES_INDEX: featuresLines.join('\n').trimEnd(),
    EXAMPLES_INDEX: examplesLines.join('\n').trimEnd(),
    CHANGELOG_INDEX: changelogLines.join('\n').trimEnd(),
    CONTEXTV_INDEX: contextVLines.join('\n').trimEnd(),
  };

  const body = template.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : match,
  );

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
