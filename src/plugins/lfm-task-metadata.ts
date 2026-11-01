/**
 * lfm-task-metadata: Reads assignees, tags, estimates and due dates out of GFM
 * task list items, without changing what the author wrote.
 *
 * Reads:
 *   - [ ] @mpstaton @tanujsk Task title #Docs ~3d 2026-11-15
 *
 * Stamps on each task `listItem`:
 *   data.task    { assignees, tags, estimate?, due? }
 *
 * Attaches to the tree:
 *   data.tasks   every task in document order, with its text, checked state,
 *                nearest preceding heading and source line
 *
 * Opt-in, because every existing document has checkboxes and most were not
 * written to this convention. The line reads correctly in Obsidian and on GitHub
 * without this plugin, so nothing here touches the node's children.
 *
 * Only direct text children of the item's first paragraph are read, so
 * `@page` in backticks and `#frag` in a link are never metadata. A bare `@page`
 * at the start of a task still reads as an assignee unless the site sets
 * `collaborators`.
 *
 * Deliberately dependency-free, matching the convention set in lfm-og-fetcher.ts
 * and remark-lfm-wikilinks.ts.
 *
 * See context-v/specs/Maintain-Project-Task-Management-w-LFM.md.
 */

import type { ListItem, Paragraph, PhrasingContent, Root } from 'mdast';
import type { Plugin } from 'unified';
import type { LfmTask, LfmTaskMetadata, LfmTaskMetadataOptions } from '../types/index.js';

const HANDLE = /^@([\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?)$/u;
const TAG = /^#([\p{L}\p{N}_/-]+)$/u;
// The wikilink alternative consumes `[[Page #Section]]` whole, so what's inside
// one can't read as a tag when the wikilinks plugin is off and it's still text.
const TAG_IN_TEXT = /\[\[[^\]]*\]\]|(^|\s)#([\p{L}\p{N}_/-]+)(?![\p{L}\p{N}_/-])/gu;
const ESTIMATE = /^~(\d+(?:\.\d+)?[a-z]+)$/;
const DUE_DATE = /\s(?:📅\s+)?(\d{4}-\d{2}-\d{2})$/u;

/** True for a real calendar date, so `2026-13-45` and `2026-02-30` are refused. */
function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasLetter(value: string): boolean {
  return /\p{L}/u.test(value);
}

/** Visible text of a node, markup stripped. Hand-rolled; see module note. */
function plainText(node: any): string {
  if (node.type === 'break') return ' ';
  if (typeof node.value === 'string') return node.value;
  return Array.isArray(node.children) ? node.children.map(plainText).join('') : '';
}

/**
 * Inline markup that survives re-serialization. The aggregator needs it: a title
 * of `` Add `@page` `` written back without its backticks would read as an
 * assignee the next time it was parsed.
 */
function inlineMarkdown(node: any): string {
  const inner = (): string => (node.children ?? []).map(inlineMarkdown).join('');
  switch (node.type) {
    case 'inlineCode':
      return `\`${node.value}\``;
    case 'link':
      return `[${inner()}](${node.url})`;
    case 'strong':
      return `**${inner()}**`;
    case 'emphasis':
      return `*${inner()}*`;
    case 'delete':
      return `~~${inner()}~~`;
    default:
      return plainText(node);
  }
}

function tidy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

interface ParsedLine extends LfmTaskMetadata {
  text: string;
  markdown: string;
}

function parseLine(paragraph: Paragraph, options: LfmTaskMetadataOptions): ParsedLine {
  // Spellings from the list win, so `@MPStaton` and `@mpstaton` group together.
  const roster = options.collaborators
    ? new Map(options.collaborators.map((name) => {
        const handle = name.replace(/^@/, '');
        return [handle.toLowerCase(), handle] as const;
      }))
    : undefined;
  const toAssignee = (token: string): string | undefined => {
    const handle = HANDLE.exec(token)?.[1];
    if (!handle) return undefined;
    return roster ? roster.get(handle.toLowerCase()) : handle;
  };

  const children = paragraph.children as PhrasingContent[];
  // Metadata comes out of these copies. Non-text children stay null and read
  // through from the node.
  const segments = children.map((c) => (c.type === 'text' ? c.value : null));
  const last = segments.length - 1;

  const authored: string[] = [];
  while (typeof segments[0] === 'string') {
    const match = /^(\S+)\s+/.exec(segments[0]);
    const assignee = match && toAssignee(match[1]!);
    if (!match || !assignee) break;
    authored.push(assignee);
    segments[0] = segments[0].slice(match[0].length);
  }

  let due: string | undefined;
  let estimate: string | undefined;
  const trailingTags: string[] = [];
  if (typeof segments[last] === 'string') {
    let tail = segments[last] as string;

    const date = DUE_DATE.exec(tail);
    if (date && isRealDate(date[1]!)) {
      due = date[1];
      tail = tail.slice(0, date.index);
    }

    // Walk back through the trailing run of `#tag` and `~3d`, stopping at the
    // first token that is title text. A token that starts the segment is never
    // metadata, so a title can't be consumed down to nothing.
    for (;;) {
      const match = /\s+(\S+)$/.exec(tail);
      if (!match) break;
      const token = match[1]!;
      const tag = TAG.exec(token)?.[1];
      const est = ESTIMATE.exec(token)?.[1];
      if (tag && hasLetter(tag)) trailingTags.unshift(tag);
      else if (est && !estimate) estimate = est;
      else break;
      tail = tail.slice(0, match.index);
    }
    segments[last] = tail;
  }

  const tags: string[] = [];
  segments.forEach((segment, i) => {
    if (segment === null) return;
    segments[i] = segment.replace(TAG_IN_TEXT, (whole, before: string | undefined, tag: string | undefined) => {
      if (before === undefined || tag === undefined) return whole;
      // A `#` hard against the node before it, as in `` `x`#Docs ``, is no tag.
      if ((before === '' && i > 0) || !hasLetter(tag)) return whole;
      tags.push(tag);
      return before;
    });
  });
  tags.push(...trailingTags);

  const seen = new Set<string>();
  const assignees = authored.filter((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const read = (fn: (node: any) => string) =>
    tidy(children.map((c, i) => segments[i] ?? fn(c)).join(''));

  const metadata: ParsedLine = {
    assignees,
    tags: [...new Set(tags)],
    text: read(plainText),
    markdown: read(inlineMarkdown),
  };
  if (estimate) metadata.estimate = estimate;
  if (due) metadata.due = due;
  return metadata;
}

/**
 * Stamp task metadata on every GFM task list item, and collect them in
 * `tree.data.tasks`.
 *
 * @example
 * ```ts
 * const tree = await parseMarkdown(content, {
 *   taskMetadata: { collaborators: ['mpstaton', 'tanujsk'] },
 * });
 * const tasks = (tree as any).data.tasks;
 * ```
 */
export const lfmTaskMetadata: Plugin<[LfmTaskMetadataOptions?], Root> = function (options = {}) {
  return (tree: Root) => {
    const tasks: LfmTask[] = [];
    let section: string | undefined;

    const walk = (node: any, inListItem: boolean): void => {
      if (!node || !Array.isArray(node.children)) return;
      for (const child of node.children) {
        // A heading inside a list item is an authoring accident, not a section.
        if (child.type === 'heading' && !inListItem) section = tidy(plainText(child));
        if (child.type === 'listItem' && typeof (child as ListItem).checked === 'boolean') {
          const first = child.children[0];
          if (first?.type === 'paragraph') {
            const { text, markdown, ...metadata } = parseLine(first, options);
            child.data = { ...child.data, task: metadata };
            const task: LfmTask = { text, markdown, checked: child.checked, ...metadata };
            if (section) task.section = section;
            const line = child.position?.start.line;
            if (line) task.line = line;
            tasks.push(task);
          }
        }
        walk(child, inListItem || child.type === 'listItem');
      }
    };
    walk(tree, false);

    (tree as any).data = { ...(tree as any).data, tasks };
  };
};
