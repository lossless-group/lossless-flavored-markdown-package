/**
 * Task aggregation: rolls the `tree.data.tasks` of many documents into one list,
 * groups it, and writes it out as Markdown for reading on GitHub.
 *
 * Pure, with no filesystem access, so a site can run it over whatever documents
 * it likes. `src/cli/lfm-tasks.ts` is the script that wires it to a git repo.
 * Strip frontmatter first, as with the rest of the pipeline: `parseMarkdown`
 * reads a raw file's closing `---` as a heading underline, and its last line
 * becomes the section of any task before the first real heading.
 *
 * @example
 * ```ts
 * const tree = await parseMarkdown(body, { taskMetadata: true });
 * const tasks = aggregateTasks([{ source: 'context-v/plans/Launch.md', tree }]);
 * const markdown = tasksToMarkdown(tasks, { title: 'Launch', groupBy: 'section' });
 * ```
 *
 * See context-v/specs/Maintain-Project-Task-Management-w-LFM.md.
 */

import type {
  LfmAggregatedTask,
  LfmTask,
  LfmTaskDocument,
  LfmTaskGroup,
  LfmTaskGroupBy,
  TasksToMarkdownOptions,
} from '../types/index.js';

/**
 * Combine the tasks of many parsed documents, in the order given, recording
 * where each came from.
 *
 * Throws on a tree with no `data.tasks`. That tree was parsed without
 * `taskMetadata`, and treating it as empty would report "no tasks" for a document
 * full of them.
 */
export function aggregateTasks(documents: LfmTaskDocument[]): LfmAggregatedTask[] {
  return documents.flatMap(({ source, tree }) => {
    const tasks = (tree as { data?: { tasks?: LfmTask[] } }).data?.tasks;
    if (!tasks) {
      throw new Error(`aggregateTasks: ${source} was parsed without the taskMetadata option`);
    }
    return tasks.map((task) => ({ ...task, source }));
  });
}

/**
 * Group tasks, in first-seen order. A task with two assignees or two tags appears
 * in both groups. Tasks with nothing to group on land in a final `null` group, so
 * nothing goes missing.
 */
export function groupTasks<T extends LfmTask & { source?: string }>(
  tasks: T[],
  by: LfmTaskGroupBy,
): LfmTaskGroup<T>[] {
  const keysOf = (task: T): (string | null)[] => {
    const keys =
      by === 'assignee' ? task.assignees :
      by === 'tag' ? task.tags :
      by === 'source' ? (task.source ? [task.source] : []) :
      task.section ? [task.section] : [];
    return keys.length > 0 ? keys : [null];
  };

  const groups = new Map<string | null, T[]>();
  for (const task of tasks) {
    for (const key of keysOf(task)) {
      const group = groups.get(key);
      if (group) group.push(task);
      else groups.set(key, [task]);
    }
  }

  const ungrouped = groups.get(null);
  groups.delete(null);
  const result: LfmTaskGroup<T>[] = [...groups].map(([key, members]) => ({ key, tasks: members }));
  if (ungrouped) result.push({ key: null, tasks: ungrouped });
  return result;
}

const GROUP_HEADING: Record<LfmTaskGroupBy, { prefix: string; none: string }> = {
  assignee: { prefix: '@', none: 'Unassigned' },
  section: { prefix: '', none: 'No Section' },
  tag: { prefix: '#', none: 'Untagged' },
  source: { prefix: '', none: 'No Source' },
};

/**
 * Write tasks as Markdown for GitHub: a `##` section per group for open tasks,
 * then finished ones in a collapsed `<details>` block. Lines keep the authored
 * form, so one can be pasted into an issue and its `@handle` will notify.
 */
export function tasksToMarkdown<T extends LfmTask>(
  tasks: T[],
  options: TasksToMarkdownOptions<T>,
): string {
  const { title, description, groupBy = 'assignee', sourceLink } = options;

  const line = (task: T): string => {
    const link = sourceLink?.(task);
    return [
      `- [${task.checked ? 'x' : ' '}]`,
      ...task.assignees.map((name) => `@${name}`),
      task.markdown,
      ...task.tags.map((tag) => `#${tag}`),
      task.estimate && `~${task.estimate}`,
      task.due,
      link && `([${link.label}](${link.href}))`,
    ].filter(Boolean).join(' ');
  };

  const blocks = [`# ${title}`];
  if (description) blocks.push(description);

  const { prefix, none } = GROUP_HEADING[groupBy];
  for (const { key, tasks: members } of groupTasks(tasks.filter((t) => !t.checked), groupBy)) {
    blocks.push(`## ${key === null ? none : `${prefix}${key}`}`, members.map(line).join('\n'));
  }

  const done = tasks.filter((t) => t.checked);
  if (done.length > 0) {
    blocks.push(
      `<details>\n<summary>Completed (${done.length})</summary>`,
      done.map(line).join('\n'),
      '</details>',
    );
  }

  return `${blocks.join('\n\n')}\n`;
}
