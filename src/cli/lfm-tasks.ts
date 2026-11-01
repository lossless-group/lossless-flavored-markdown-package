#!/usr/bin/env node
/**
 * lfm-tasks: Aggregates the task list items of a git repo's tracked markdown
 * files into one Markdown file for reading on GitHub, with each task linking back
 * to the line it came from.
 *
 * Only tracked files are read, because that is what GitHub can link to. Submodules
 * are skipped for the same reason: their files live in another repo.
 *
 * GitHub shows `[[path/to/Page-Name.md]]` as literal text, so a page reference in
 * a task becomes a relative link here. Source documents keep the wikilink for
 * Obsidian. One that can't be settled to a single tracked file keeps its display
 * text and gets no link, because a wrong link is worse than none.
 *
 * The output carries no timestamp, so regenerating it changes nothing unless the
 * tasks changed, and it stays quiet in a commit or a CI diff.
 *
 * `--install-hook` sets up a local pre-commit hook that regenerates the file when
 * a commit touches context-v, so it travels with the commit and reaches GitHub on
 * push with nothing running there. The hook never blocks a commit: a stale task
 * list is a smaller problem than work that can't be saved.
 *
 * See context-v/specs/Maintain-Project-Task-Management-w-LFM.md.
 */

import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseMarkdown } from '../parse.js';
import { aggregateTasks, tasksToMarkdown } from '../utils/aggregate-tasks.js';
import { createPathResolver } from '../utils/resolve-path.js';
import type { LfmAggregatedTask, LfmTaskDocument, LfmTaskGroupBy } from '../types/index.js';

const USAGE = `Usage: lfm-tasks [paths...] [options]

Aggregates task list items from tracked markdown files. Reads the whole repo from
the current directory unless given paths, skipping changelog directories.

Options:
  -o, --out <file>           Write to a file instead of stdout
      --title <text>         The file's heading (default: Tasks)
      --group-by <field>     assignee, section, tag, or source (default: assignee)
      --collaborators <list> Comma-separated handles that count as assignees
      --exclude <path>       Skip a file or directory (repeatable)
      --include-changelog    Read changelog directories too
      --staged               Read what is staged rather than the working tree
      --install-hook         Regenerate TASKS.md on commits touching context-v
  -h, --help                 Show this help
`;

const GROUP_BY: readonly string[] = ['assignee', 'section', 'tag', 'source'];
const HOOK_MARKER = '# Managed by lfm-tasks --install-hook.';
const GIT_OUTPUT: ExecFileSyncOptionsWithStringEncoding = {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 256,
  stdio: ['ignore', 'pipe', 'pipe'],
};

function fail(message: string): never {
  process.stderr.write(`lfm-tasks: ${message}\n`);
  process.exit(1);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Write a pre-commit hook pointing at this exact script and node. Git never
 * shares `.git/hooks`, so absolute paths are safe, and each clone installs its own.
 */
function installHook(): void {
  let hooksDir: string;
  try {
    hooksDir = execFileSync('git', ['rev-parse', '--git-path', 'hooks'], GIT_OUTPUT).trim();
  } catch {
    fail('could not find the hooks directory. Run this inside a git repository.');
  }

  // With core.hooksPath set, the directory may be shared with every other repo.
  let hooksPath = '';
  try {
    hooksPath = execFileSync('git', ['config', 'core.hooksPath'], GIT_OUTPUT).trim();
  } catch {
    // Exits non-zero when unset, which is the normal case.
  }
  if (hooksPath) {
    fail(`core.hooksPath is set to ${hooksPath}, so this hook could affect other repos. Not installing.`);
  }

  const node = shellQuote(process.execPath);
  const script = shellQuote(fileURLToPath(import.meta.url));
  const hooks: Record<string, string> = {
    'pre-commit': `#!/bin/sh
${HOOK_MARKER}
# Regenerates TASKS.md when a commit touches context-v. Never blocks the commit.
# Delete this file and post-commit to turn it off.

git diff --cached --name-only -- 'context-v/*.md' '*/context-v/*.md' | grep -q . || exit 0

# Prefer the node on PATH: a versioned install path goes away on upgrade. The
# fallback covers git clients that run hooks with a minimal PATH.
node=$(command -v node || echo ${node})

if [ -f ${script} ] \\
  && "$node" ${script} --staged -o TASKS.md \\
  && git add TASKS.md; then
  exit 0
fi

echo "lfm-tasks: could not update TASKS.md, committing without it." >&2
exit 0
`,
    // `git commit <path>` builds the commit from a temporary index with the real
    // one locked, so pre-commit's `git add` can't reach it. Without this, TASKS.md
    // shows as staged for deletion and the next commit would remove it.
    'post-commit': `#!/bin/sh
${HOOK_MARKER}
# Keeps the index in step with the TASKS.md that pre-commit just committed.

git reset -q -- TASKS.md 2>/dev/null
exit 0
`,
  };

  for (const name of Object.keys(hooks)) {
    const hook = join(hooksDir, name);
    if (existsSync(hook) && !readFileSync(hook, 'utf8').includes(HOOK_MARKER)) {
      fail(`${hook} already exists and isn't ours. Not overwriting it.`);
    }
  }

  mkdirSync(hooksDir, { recursive: true });
  for (const [name, body] of Object.entries(hooks)) {
    const hook = join(hooksDir, name);
    writeFileSync(hook, body);
    chmodSync(hook, 0o755);
    process.stderr.write(`Installed ${hook}.\n`);
  }
}

function listMarkdownFiles(paths: string[]): string[] {
  const pathspecs = paths.length > 0
    ? paths.map((p) => (p.endsWith('.md') ? p : `${p.replace(/\/$/, '')}/*.md`))
    : ['*.md'];
  try {
    return execFileSync('git', ['ls-files', '-z', '--', ...pathspecs], GIT_OUTPUT)
      .split('\0').filter(Boolean);
  } catch {
    fail('could not list files. Run this inside a git repository.');
  }
}

/** Blank out frontmatter rather than cut it, so task line numbers stay true. */
function blankFrontmatter(raw: string): string {
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/, (block) =>
    block.replace(/[^\n]/g, ''),
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        out: { type: 'string', short: 'o' },
        title: { type: 'string', default: 'Tasks' },
        'group-by': { type: 'string', default: 'assignee' },
        collaborators: { type: 'string' },
        exclude: { type: 'string', multiple: true, default: [] },
        'include-changelog': { type: 'boolean' },
        staged: { type: 'boolean' },
        'install-hook': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    fail(`${(error as Error).message}\n\n${USAGE}`);
  }
  const { values, positionals } = parsed;

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }

  if (values['install-hook']) {
    installHook();
    return;
  }

  const groupBy = values['group-by']!;
  if (!GROUP_BY.includes(groupBy)) {
    fail(`--group-by must be one of ${GROUP_BY.join(', ')}.`);
  }

  const toRepoPath = (p: string) => relative(process.cwd(), resolve(p)).split(sep).join('/');
  // The output is full of checkboxes, so reading it back would duplicate every task.
  const excluded = [...values.exclude!, ...(values.out ? [values.out] : [])].map(toRepoPath);
  // Changelogs are history, so an old unticked item in one isn't open work.
  const isChangelog = (file: string) =>
    !values['include-changelog'] && file.split('/').slice(0, -1).includes('changelog');
  const isExcluded = (file: string) =>
    isChangelog(file) || excluded.some((path) => file === path || file.startsWith(`${path}/`));

  // A hook must describe the commit being made, not unstaged edits beside it.
  const read = (file: string) =>
    values.staged
      ? execFileSync('git', ['show', `:./${file}`], GIT_OUTPUT)
      : readFileSync(file, 'utf8');

  const collaborators = values.collaborators?.split(',').map((name) => name.trim()).filter(Boolean);

  // Relative links keep working on any branch or fork.
  const fromDir = values.out ? dirname(resolve(values.out)) : process.cwd();
  const hrefTo = (file: string) =>
    relative(fromDir, resolve(file)).split(sep).map(encodeURIComponent).join('/');

  // The whole repo is the index even when paths narrow what's aggregated, since a
  // task can reference a page outside them. The route only satisfies the
  // resolver; the tracked file it lands on is what gets linked.
  const pages = createPathResolver({
    index: listMarkdownFiles([]),
    routes: [{ match: '*', to: '/{path}' }],
  });

  const documents: LfmTaskDocument[] = [];
  for (const source of listMarkdownFiles(positionals)) {
    if (isExcluded(source)) continue;
    let raw: string;
    try {
      raw = read(source);
    } catch (error) {
      // A tracked file can be deleted locally, or be a symlink to a directory.
      process.stderr.write(`lfm-tasks: skipped ${source}: ${(error as Error).message}\n`);
      continue;
    }
    const tree = await parseMarkdown(blankFrontmatter(raw), {
      taskMetadata: collaborators ? { collaborators } : true,
      // Citation checks warn about things unrelated to tasks.
      citations: false,
      wikilinks: {
        resolver: (input) => {
          const page = pages.resolve(input.path, { from: source });
          if (!page?.file) return null;
          return {
            url: hrefTo(page.file),
            isLocal: true,
            display: input.display ?? page.display,
          };
        },
      },
    });
    documents.push({ source, tree });
  }

  const tasks = aggregateTasks(documents);
  const open = tasks.filter((task) => !task.checked);
  const openSources = new Set(open.map((task) => task.source));

  // `?plain=1` is what makes GitHub show a markdown file's source, where `#L12`
  // lands on the line.
  const sourceLink = (task: LfmAggregatedTask) => ({
    label: task.line ? `${task.source}:${task.line}` : task.source,
    href: `${hrefTo(task.source)}?plain=1${task.line ? `#L${task.line}` : ''}`,
  });

  const output = tasksToMarkdown(tasks, {
    title: values.title!,
    description:
      `${plural(open.length, 'open task')} across ${plural(openSources.size, 'document')}. ` +
      'Generated by `lfm-tasks`, so edit the linked documents rather than this file.',
    groupBy: groupBy as LfmTaskGroupBy,
    sourceLink,
  });

  if (values.out) {
    writeFileSync(values.out, output);
    process.stderr.write(`Wrote ${values.out}: ${plural(open.length, 'open task')}.\n`);
  } else {
    process.stdout.write(output);
  }
}

await main();
