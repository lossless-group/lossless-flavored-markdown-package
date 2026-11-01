/**
 * Task metadata and aggregation.
 *
 * The first half is the acceptance list from
 * context-v/specs/Maintain-Project-Task-Management-w-LFM.md. Most of it is about
 * what should *not* be read as metadata, because the failure mode is a person
 * being assigned a CSS at-rule.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTasks, groupTasks, tasksToMarkdown } from '../dist/index.js';
import { parseMarkdown, ofType, text, md } from './helpers.mjs';

const tasksOf = async (source, taskMetadata = true) =>
  (await parseMarkdown(source, { taskMetadata })).data.tasks;

const taskOf = async (source, taskMetadata) => (await tasksOf(source, taskMetadata))[0];

test('the canonical line', async () => {
  const task = await taskOf('- [ ] @mpstaton @tanujsk Task title #Docs 2026-11-15\n');
  assert.deepEqual(task.assignees, ['mpstaton', 'tanujsk']);
  assert.deepEqual(task.tags, ['Docs']);
  assert.equal(task.due, '2026-11-15');
  assert.equal(task.text, 'Task title');
  assert.equal(task.checked, false);
  assert.equal(task.line, 1);
});

test('the source text is left alone, and the list item carries the data', async () => {
  const source = '- [ ] @mpstaton Task title #Docs 2026-11-15\n';
  const tree = await parseMarkdown(source, { taskMetadata: true });
  const [item] = ofType(tree, 'listItem');
  assert.equal(text(item), '@mpstaton Task title #Docs 2026-11-15');
  assert.deepEqual(item.data.task, {
    assignees: ['mpstaton'],
    tags: ['Docs'],
    due: '2026-11-15',
  });
});

test('an estimate is read from the end of the title, in either order with tags', async () => {
  for (const line of ['Task #Docs ~3d 2026-11-15', 'Task ~3d #Docs 2026-11-15']) {
    const task = await taskOf(`- [ ] ${line}\n`);
    assert.equal(task.estimate, '3d', line);
    assert.deepEqual(task.tags, ['Docs'], line);
    assert.equal(task.text, 'Task', line);
  }
});

test('a trailing handle is title text, not an assignee', async () => {
  const task = await taskOf('- [ ] Add @page\n');
  assert.deepEqual(task.assignees, []);
  assert.equal(task.text, 'Add @page');
});

test('an all-digit tag is not a tag', async () => {
  const task = await taskOf('- [ ] Task #123\n');
  assert.deepEqual(task.tags, []);
  assert.equal(task.text, 'Task #123');
});

test('a handle mid-title is not an assignee', async () => {
  const task = await taskOf('- [ ] Add @page size options\n');
  assert.deepEqual(task.assignees, []);
  assert.equal(task.text, 'Add @page size options');
});

test('a package name is not an assignee', async () => {
  const task = await taskOf('- [ ] @augment-it/workspace needs a bump\n');
  assert.deepEqual(task.assignees, []);
});

test('a handle in backticks is not an assignee', async () => {
  const task = await taskOf('- [ ] `@page` rules\n');
  assert.deepEqual(task.assignees, []);
  const end = await taskOf('- [ ] Fix `x` for `@page`\n');
  assert.deepEqual(end.assignees, []);
});

test('collaborators decide whether a bare handle counts', async () => {
  const bare = await taskOf('- [ ] @page rules\n');
  assert.deepEqual(bare.assignees, ['page']);

  const listed = await taskOf('- [ ] @page rules\n', { collaborators: ['mpstaton'] });
  assert.deepEqual(listed.assignees, []);
  assert.equal(listed.text, '@page rules');
});

test('collaborators match case-insensitively and normalize the spelling', async () => {
  const task = await taskOf('- [ ] @MPStaton @mpstaton Task\n', { collaborators: ['@mpstaton'] });
  assert.deepEqual(task.assignees, ['mpstaton']);
});

test('a plain bullet is not a task', async () => {
  const tree = await parseMarkdown('- Task @mpstaton #Docs\n', { taskMetadata: true });
  assert.deepEqual(tree.data.tasks, []);
  assert.equal(ofType(tree, 'listItem')[0].data?.task, undefined);
});

test('an impossible date leaves due unset', async () => {
  for (const date of ['2026-13-45', '2026-02-30']) {
    const task = await taskOf(`- [ ] Task ${date}\n`);
    assert.equal(task.due, undefined, date);
    assert.equal(task.text, `Task ${date}`);
  }
});

test('a date must be last', async () => {
  const task = await taskOf('- [ ] Review 2026-11-15 notes\n');
  assert.equal(task.due, undefined);
});

test('a line that is only a date keeps it as the title', async () => {
  const task = await taskOf('- [ ] 2026-11-15\n');
  assert.equal(task.due, undefined);
  assert.equal(task.text, '2026-11-15');
});

test('the emoji date is an alias', async () => {
  const emoji = await taskOf('- [ ] Task 📅 2026-11-15\n');
  const bare = await taskOf('- [ ] Task 2026-11-15\n');
  assert.equal(emoji.due, bare.due);
  assert.equal(emoji.text, 'Task');
});

test('prose around a tag survives, and punctuation ends it', async () => {
  const task = await taskOf('- [ ] Fix #Docs, then ship\n');
  assert.deepEqual(task.tags, ['Docs']);
  assert.equal(task.text, 'Fix , then ship');
});

test('tags keep authored order without repeats, across middle and end', async () => {
  const task = await taskOf('- [ ] #A Task #B #A #C\n');
  assert.deepEqual(task.tags, ['A', 'B', 'C']);
});

test('a # inside a link or hard against code is not a tag', async () => {
  const link = await taskOf('- [ ] Read https://example.com/#frag\n');
  assert.deepEqual(link.tags, []);
  const code = await taskOf('- [ ] `x`#Docs\n');
  assert.deepEqual(code.tags, []);
});

test('metadata is read around inline markup', async () => {
  const task = await taskOf('- [ ] @mpstaton Fix **the** `parser` #Docs ~2h 2026-11-15\n');
  assert.deepEqual(task.assignees, ['mpstaton']);
  assert.deepEqual(task.tags, ['Docs']);
  assert.equal(task.estimate, '2h');
  assert.equal(task.due, '2026-11-15');
  assert.equal(task.text, 'Fix the parser');
  assert.equal(task.markdown, 'Fix **the** `parser`');
});

test('section is the nearest preceding heading, and sub-tasks are tasks too', async () => {
  const tasks = await tasksOf(md`
    - [ ] Before any heading

    ## Phase 1

    - [ ] Parent
      - [x] Child

    ### Phase 2

    - [ ] Later
  `);
  assert.deepEqual(
    tasks.map((t) => [t.text, t.section, t.checked]),
    [
      ['Before any heading', undefined, false],
      ['Parent', 'Phase 1', false],
      ['Child', 'Phase 1', true],
      ['Later', 'Phase 2', false],
    ],
  );
});

test('a heading inside a list item does not start a section', async () => {
  const tasks = await tasksOf(md`
    ## Real

    - [ ] One
      # Accident
    - [ ] Two
  `);
  assert.equal(tasks[1].section, 'Real');
});

test('tasks inside a callout are found', async () => {
  const tasks = await tasksOf('> [!note] Heads up\n> - [ ] @mpstaton Task\n');
  assert.deepEqual(tasks[0].assignees, ['mpstaton']);
});

test('with the plugin off the tree is untouched', async () => {
  const source = '- [ ] @mpstaton Task #Docs 2026-11-15\n';
  const off = await parseMarkdown(source);
  assert.equal(off.data?.tasks, undefined);
  assert.equal(ofType(off, 'listItem')[0].data?.task, undefined);
  assert.equal(ofType(off, 'listItem')[0].checked, false);
  const on = await parseMarkdown(source, { taskMetadata: true });
  assert.equal(text(off), text(on));
});

const parsed = async (source, body) => ({
  source,
  tree: await parseMarkdown(body, { taskMetadata: true }),
});

test('aggregateTasks combines documents and records the source', async () => {
  const tasks = aggregateTasks([
    await parsed('a.md', '- [ ] One\n'),
    await parsed('b.md', '- [ ] Two\n- [ ] Three\n'),
  ]);
  assert.deepEqual(tasks.map((t) => [t.text, t.source]), [
    ['One', 'a.md'],
    ['Two', 'b.md'],
    ['Three', 'b.md'],
  ]);
});

test('aggregateTasks refuses a tree parsed without the option', async () => {
  const tree = await parseMarkdown('- [ ] One\n');
  assert.throws(() => aggregateTasks([{ source: 'a.md', tree }]), /a\.md.*taskMetadata/);
});

test('aggregateTasks keeps a document with no tasks as empty', async () => {
  assert.deepEqual(aggregateTasks([await parsed('a.md', 'Just prose.\n')]), []);
});

test('groupTasks puts a shared task in each group and the unassigned last', async () => {
  const tasks = aggregateTasks([
    await parsed('a.md', '- [ ] Nobody\n- [ ] @a @b Both\n- [ ] @a Solo\n'),
  ]);
  const groups = groupTasks(tasks, 'assignee');
  assert.deepEqual(
    groups.map((g) => [g.key, g.tasks.map((t) => t.text)]),
    [
      ['a', ['Both', 'Solo']],
      ['b', ['Both']],
      [null, ['Nobody']],
    ],
  );
});

test('tasksToMarkdown writes open tasks by assignee and collapses finished ones', async () => {
  const tasks = aggregateTasks([
    await parsed('a.md', md`
      - [ ] @mpstaton Write \`parser\` #Docs ~3d 2026-11-15
      - [x] Finished
      - [ ] Announce
    `),
  ]);
  assert.equal(
    tasksToMarkdown(tasks, {
      title: 'Launch',
      description: 'What is left.',
      sourceLink: (task) => ({ label: `${task.source}:${task.line}`, href: `${task.source}#L${task.line}` }),
    }),
    [
      '# Launch',
      '',
      'What is left.',
      '',
      '## @mpstaton',
      '',
      '- [ ] @mpstaton Write `parser` #Docs ~3d 2026-11-15 ([a.md:1](a.md#L1))',
      '',
      '## Unassigned',
      '',
      '- [ ] Announce ([a.md:3](a.md#L3))',
      '',
      '<details>',
      '<summary>Completed (1)</summary>',
      '',
      '- [x] Finished ([a.md:2](a.md#L2))',
      '',
      '</details>',
      '',
    ].join('\n'),
  );
});

test('tasksToMarkdown can group on sections', async () => {
  const tasks = aggregateTasks([await parsed('a.md', '## Build\n\n- [ ] One\n')]);
  assert.match(tasksToMarkdown(tasks, { title: 'T', groupBy: 'section' }), /## Build\n\n- \[ \] One/);
});

test('output without source links parses back to the same tasks', async () => {
  const tasks = aggregateTasks([
    await parsed('a.md', md`
      ## Build

      - [ ] @mpstaton @tanujsk Fix \`@page\` rules #Docs #Spec ~3d 2026-11-15
      - [ ] Add **bold** thing
    `),
  ]);
  const back = await tasksOf(tasksToMarkdown(tasks, { title: 'T', groupBy: 'section' }));
  for (const [i, task] of tasks.entries()) {
    for (const field of ['text', 'markdown', 'assignees', 'tags', 'estimate', 'due', 'checked', 'section']) {
      assert.deepEqual(back[i][field], task[field], `${task.text}: ${field}`);
    }
  }
});

test('frontmatter must be stripped first: the pipeline reads it as a heading', async () => {
  // Pinned so the contract documented in aggregate-tasks.ts stays true. If the
  // pipeline ever learns to skip frontmatter, this test and that note go together.
  const task = await taskOf('---\ntitle: x\n---\n\n- [ ] One\n');
  assert.equal(task.section, 'title: x');
});

test('a # inside a wikilink is not a tag, and the wikilink stays in the title', async () => {
  const task = await taskOf('- [ ] Review [[path/to/Page-Name.md#Some Section]] and [[Page #Sec|Label #x]] #Docs\n');
  assert.deepEqual(task.tags, ['Docs']);
  assert.equal(task.markdown, 'Review [[path/to/Page-Name.md#Some Section]] and [[Page #Sec|Label #x]]');
});

test('with wikilinks resolved, the task keeps a real link', async () => {
  const tree = await parseMarkdown('- [ ] Review [[Page]] #Docs\n', {
    taskMetadata: true,
    wikilinks: { resolver: () => ({ url: 'page.md', isLocal: true, display: 'Page' }) },
  });
  const [task] = tree.data.tasks;
  assert.equal(task.text, 'Review Page');
  assert.equal(task.markdown, 'Review [Page](page.md)');
  assert.deepEqual(task.tags, ['Docs']);
});
