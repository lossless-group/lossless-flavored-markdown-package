/**
 * /llms-full.txt — concatenated raw markdown of every published changelog
 * and context-v entry from the LFM splash.
 *
 * Spec: https://llmstxt.org/
 *
 * The human-editable prose template for this file lives at
 * `splash/src/llms/llms-full.md` (with token documentation in
 * `splash/src/llms/README.md`). This file is the dumb assembler: it loads
 * the template, gathers the bodies, and substitutes tokens. To tweak voice
 * or framing, edit the markdown — not this file.
 *
 * Publish gate matches `src/pages/changelog/[...slug].astro` and
 * `src/pages/context-v/[...slug].astro` exactly: `entry.data.publish !== false`.
 * Drafts excluded from the rendered HTML must not leak into the full corpus.
 */

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { STATIC_SEO } from '@lib/seo';
import { toDate } from '@lib/date';
import template from '../llms/llms-full.md?raw';

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE ?? 'https://lossless-group.github.io';
  const base = import.meta.env.BASE_URL ?? '/';
  const root = new URL(base, site).toString().replace(/\/$/, '');

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

  const contextVAll = await getCollection('context-v');
  const contextV = contextVAll.filter((e) => (e.data as any).publish !== false);
  contextV.sort((a, b) => {
    const ta = ((a.data as any).title ?? a.id).toString().toLowerCase();
    const tb = ((b.data as any).title ?? b.id).toString().toLowerCase();
    return ta.localeCompare(tb);
  });

  const bodyParts: string[] = [];

  function appendEntry(
    entry: { id: string; data: any; body?: string },
    collectionLabel: 'changelog' | 'context-v',
    canonicalUrl: string,
  ): void {
    const data = entry.data;
    const title = data.title ?? entry.id;
    const sourcePath = data.from_path ?? `${collectionLabel}/${entry.id}.md`;

    bodyParts.push('---');
    bodyParts.push('');
    bodyParts.push(`## ${title}`);
    bodyParts.push('');
    bodyParts.push(`- Collection: \`${collectionLabel}\``);
    bodyParts.push(`- Source path: \`${sourcePath}\``);
    bodyParts.push(`- Canonical URL: ${canonicalUrl}`);

    const dm =
      data.date_modified ??
      data.date_updated ??
      data.date_first_published ??
      data.date_created ??
      data.date ?? data.date_authored_current_draft ?? data.date_authored_initial_draft;
    if (dm) {
      const d = dm instanceof Date ? dm : new Date(dm);
      if (!Number.isNaN(d.getTime())) bodyParts.push(`- Last modified: ${d.toISOString().slice(0, 10)}`);
    }
    bodyParts.push('');
    bodyParts.push(entry.body ?? '');
    bodyParts.push('');
  }

  for (const entry of changelog) {
    appendEntry(entry as any, 'changelog', `${root}/changelog/${entry.id}/`);
  }
  for (const entry of contextV) {
    appendEntry(entry as any, 'context-v', `${root}/context-v/${entry.id}/`);
  }

  const tokens: Record<string, string> = {
    SITE_NAME: STATIC_SEO.siteName,
    CHANGELOG_COUNT: String(changelog.length),
    CONTEXTV_COUNT: String(contextV.length),
    LLMS_INDEX_URL: `${root}/llms.txt`,
    CORPUS_BODIES: bodyParts.join('\n').trimEnd(),
  };

  const body = template.replace(/\{\{(\w+)\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : match,
  );

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
