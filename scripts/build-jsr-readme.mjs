#!/usr/bin/env node
/**
 * build-jsr-readme.mjs — assemble the README that JSR shows.
 *
 * A JSR package page renders README.md and nothing else, and docs-v/ isn't
 * published. The repo's README stays short and links out to docs-v/, so on its
 * own it would leave JSR readers with a table of links off the page. This puts
 * every guide listed in docs-v/index.md into the README, ahead of "## More",
 * and points the links at the headings they now land on.
 *
 *   node scripts/build-jsr-readme.mjs            # print to stdout
 *   node scripts/build-jsr-readme.mjs <outPath>  # write to a file
 *
 * scripts/publish-jsr.sh runs this. Don't commit the output.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'https://github.com/lossless-group/lossless-flavored-markdown-package';
const DOCS_URL = new RegExp(`^${REPO}/blob/master/docs-v/([\\w-]+\\.md)(?:#(.*))?$`);
const LINK = /\]\(([^)\s]+)\)/g;

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const stripFrontmatter = (text) => text.replace(/^---\n[\s\S]*?\n---\n+/, '');

export const slugify = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');

/** Call fn on each line outside a code fence, passing whatever it returns through. */
function mapProseLines(text, fn) {
  let fence = null;
  return text
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
      if (marker && !fence) fence = marker;
      else if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      else if (!fence) return fn(line);
      return line;
    })
    .join('\n');
}

/** Rewrite link targets on a line, leaving inline code alone. */
const mapLinks = (line, fn) =>
  line
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(LINK, (_, target) => `](${fn(target)})`)))
    .join('');

export function buildJsrReadme() {
  const guides = [...stripFrontmatter(read('docs-v/index.md')).matchAll(/^\* \[[^\]]+\]\(([\w-]+\.md)\)/gm)].map(
    (match) => match[1]
  );
  const readme = read('README.md');
  const split = readme.indexOf('\n## More\n');
  if (split === -1) throw new Error('README.md has no "## More" section to insert the guides before');

  // Headings repeat across guides ("Quick start"), and a renderer numbers the
  // repeats, so track the anchor each heading actually ends up with.
  const seen = new Map();
  const anchors = new Map();
  const claim = (file, heading) => {
    const slug = slugify(heading);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    const anchor = count ? `${slug}-${count}` : slug;
    if (file && !anchors.has(`${file}#${slug}`)) anchors.set(`${file}#${slug}`, anchor);
    return anchor;
  };

  const head = readme.slice(0, split);
  const tail = readme.slice(split);
  mapProseLines(head, (line) => {
    const match = line.match(/^#{1,6} (.+)$/);
    if (match) claim(null, match[1]);
    return line;
  });

  const bodies = guides.map((file) => {
    let top = true;
    return mapProseLines(stripFrontmatter(read(`docs-v/${file}`)).trim(), (line) => {
      const match = line.match(/^(#{1,5}) (.+)$/);
      if (!match) return line;
      const anchor = claim(file, match[2]);
      if (top) anchors.set(file, anchor);
      top = false;
      return `#${line}`;
    });
  });

  const toAnchor = (file, fragment) => {
    const anchor = anchors.get(fragment ? `${file}#${fragment}` : file);
    if (!anchor) throw new Error(`No heading for ${file}${fragment ? `#${fragment}` : ''}`);
    return `#${anchor}`;
  };
  const fromReadme = (target) => {
    const match = target.match(DOCS_URL);
    return match ? toAnchor(match[1], match[2]) : target;
  };
  const fromGuide = (file) => (target) => {
    if (/^([a-z]+:|#)/.test(target)) return target.startsWith('#') ? toAnchor(file, target.slice(1)) : fromReadme(target);
    const [path, fragment] = target.split('#');
    if (/^[\w-]+\.md$/.test(path)) return toAnchor(path, fragment);
    const kind = path.endsWith('/') ? 'tree' : 'blob';
    return `${REPO}/${kind}/master/${normalize(join('docs-v', path))}${fragment ? `#${fragment}` : ''}`;
  };

  return [
    mapProseLines(head, (line) => mapLinks(line, fromReadme)),
    ...bodies.map((body, i) => mapProseLines(body, (line) => mapLinks(line, fromGuide(guides[i])))),
    mapProseLines(tail.trimStart(), (line) => mapLinks(line, fromReadme)),
  ].join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = buildJsrReadme();
  const outPath = process.argv[2];
  if (outPath) writeFileSync(outPath, output);
  else process.stdout.write(output);
}
