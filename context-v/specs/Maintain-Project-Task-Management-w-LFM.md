---
site_uuid: fcf8d288-afd9-4a54-966b-e3d8b74ba2e2
hex_code: v6jlqz
title: "Maintain Project Task Management with LFM"
lede: "One checkbox line that reads correctly in Obsidian and on GitHub, and only becomes queryable data when LFM is asked."
publish: true
date_created: 2026-11-01
date_modified: 2026-11-01
date_authored_initial_draft: 2026-11-01
date_authored_current_draft: 2026-11-01
date_authored_final_draft:
authors:
  - Michael Staton
augmented_with:
  - Claude Code on Opus 5.5 (1M context)
at_semantic_version: 0.0.5.0
status: Implementing
tags:
  - Spec
  - Task-Management
  - Task-Lists
  - Obsidian
  - GitHub
  - Remark-Plugins
summary: "The signed-off authoring convention for assigning tasks in markdown, plus the design record for the opt-in lfm-task-metadata plugin and the task aggregator. Load before adding task, assignee, or due-date syntax to LFM, before changing how tasks roll up across documents, or when someone asks how to assign work in a context-v document."
type: Specs
---

# Maintain Project Task Management with LFM

## Why Care?

Plans and specs keep turning into to-do lists, and those lists need owners. Markdown has checkboxes, but it has no idea who a task belongs to or when it is due.

We write in Obsidian and collaborate on GitHub, and neither tool's task syntax works in the other. Picking one tool's syntax would leave half the team reading noise. This spec picks one plain line that means something in both, then lets LFM read that line as data for any site that wants to list or filter tasks.

## Goals

- One task-line format, written by hand, that needs no translation between Obsidian and GitHub.
- The source text stays untouched, so the same line can be pasted into a GitHub issue.
- An opt-in LFM plugin that exposes assignees, tags, estimates, and due dates as structured data.
- A script that rolls a repo's tasks into one Markdown file built for reading on GitHub.

## Non-goals

- **Replacing GitHub issues.** A line in a file has no real assignee and notifies nobody. Work that needs tracking or discussion still becomes an issue, per the `gh-cli-projects-tasks-conventions` skill.
- **Syncing.** Nothing writes between markdown files and GitHub or Obsidian in either direction.
- **Rendering.** LFM produces data. Each site's components decide how a task looks, as with every other LFM feature.
- **Changing how headings parse.** See [Tags can't become headings](#tags-cant-become-headings).

## The convention

```md
- [ ] @mpstaton @tanujsk Task title #Docs 2026-11-15
```

| Token | Obsidian | GitHub |
|---|---|---|
| `- [ ]` / `- [x]` | Checkbox | Checkbox |
| `@handle` | Plain text. Core search can find it with `task-todo:@mpstaton`.[^2j6bzo] | Notifies the person in an issue or PR body. Plain text in a committed file. |
| `#Train-Case` | Real tag, searchable with `tag:#Docs`[^gl6ix8][^2j6bzo] | Plain text |
| `YYYY-MM-DD` | Plain text | Plain text |

We use Obsidian without the Tasks plugin, so nothing in Obsidian treats the date as a due date. Only `lfm-task-metadata` reads it as one.

### Rules

1. **Assignees come first.** One or more `@handle` tokens directly after the checkbox.
2. **Handles are GitHub logins.** The line then works unchanged when pasted into an issue. Don't invent a handle for someone without a login: on GitHub it could notify a stranger who owns that name.
3. **The title comes next, then tags, then the date.** The date must be the last thing on the line.
4. **Every tag contains a letter.** Obsidian doesn't treat all-digit tags as tags,[^gl6ix8] and `#123` links to an issue in GitHub issues and PRs.
5. **Tags use Train-Case**, matching the rest of LFM.
6. **Pages are referenced Obsidian-style**, as `[[path/to/Page-Name.md]]`. GitHub shows that as literal text in the source document, and `lfm-tasks` turns it into a real link in its output.

### If this changes later

- **Adopting the Tasks plugin.** Tasks marks due dates with `📅`.[^vgapf6] The plugin accepts `📅 2026-11-15` as an alias for the bare date, in keeping with LFM's polyglot rule, so documents written either way keep working. Switching over would only mean adding the emoji to existing lines.
- **Collaborators without GitHub logins.** Every collaborator has one today, but that may stop being true if this spreads beyond development work. The plugin treats a handle as an opaque name and doesn't check it against GitHub, so the syntax survives that change. Each site's `collaborators` config is the natural place to record who a handle refers to. We'll design that when it's needed.

### Syntax we rejected

| Syntax | Why not |
|---|---|
| `[assignee:: mpstaton]` (Dataview inline field)[^2lfd69] | Queryable in Obsidian, but shows as literal text on GitHub |
| `[[@mpstaton]]` (person as a note) | Shows as literal text on GitHub |
| `:user[mpstaton]` (LFM text directive) | Parses cleanly in LFM, but shows as literal text in both other tools |
| `assignee:` in frontmatter (TaskNotes)[^tfuhpt] | Requires one file per task |
| Trailing `@name`, as in TODO.md[^nleaqq] | A leading handle is easier to scan, and accepting both made `Add @page` read as an assignee |

### Prior art

No shared standard exists for assigning tasks in markdown. TODO.md[^nleaqq] is the closest thing to a written spec. We took `~estimate` and the idea of grouping tasks by heading from it, without following its format. Joplin's Inline Todo plugin uses `@assignee` too.[^b974ua] todo.txt also uses `@`, but for a context rather than a person,[^ed1j4e] so don't assume every `@` means an owner.

## The plugin: `lfm-task-metadata`

**Name.** Tier 3 under [[Naming-Plugins-Against-the-Remark-Ecosystem]]. The [remark plugin list](https://github.com/remarkjs/remark/blob/main/doc/plugins.md) has `remark-mentions` (turns mentions into links) and `remark-ping` (new mention syntax and node type). `remark-gfm` covers checkboxes. Nothing listed reads assignees, tags, and dates from a task line, and this plugin doesn't replace any text with links. Exported as `lfmTaskMetadata`.

**Why it's opt-in.** Every existing document has checkboxes. Most of them were not written to this convention, so they shouldn't start producing task data on upgrade.

### Output

The text stays as written. The plugin only adds data, on the same pattern as `tree.data.headings` from `remark-lfm-heading-ids`:

```ts
// On each matching listItem. Completion is already in listItem.checked.
listItem.data.task = {
  assignees: ['mpstaton', 'tanujsk'],
  tags: ['Docs'],
  estimate: '3d',
  due: '2026-11-15',
};

// On the root, in document order, for lists and filters.
tree.data.tasks = [
  {
    text: 'Task title',       // markup stripped
    markdown: 'Task title',   // inline markup kept, so the aggregator can write it back
    checked: false,
    section: 'Phase 1',       // nearest preceding heading
    line: 12,
    assignees: ['mpstaton', 'tanujsk'],
    tags: ['Docs'],
    estimate: '3d',
    due: '2026-11-15',
  },
];
```

### Extraction rules

- **Scope.** Only list items where `checked` is a boolean. Each nested sub-task is its own task. Plain bullets and prose are ignored.
- **Text nodes only.** `` `@page` `` in backticks is an `inlineCode` node, so it is skipped automatically.
- **Assignees.** Only the leading run of `@handle` tokens, each followed by whitespace. `@augment-it/workspace` fails because of the `/`.
- **Estimate.** `~` then a number and a unit, such as `~3d` or `~2h`, at the end of the title, in either order with tags.
- **Page references.** A `#` inside `[[...]]` is never a tag, whether or not the wikilinks plugin is on.
- **Collaborator list.** Each site can set a `collaborators` list in its own config, which limits who counts, compared case-insensitively. An unlisted handle stays plain text.
- **Tags.** `#` at the start of the text or after whitespace, then letters, numbers, `_`, `-`, or `/`,[^q0ktii] with at least one letter.
- **Due date.** The last token on the line, if it's a real `YYYY-MM-DD` date, optionally preceded by `📅`. Anything else leaves `due` unset.

### The false positives to expect

- **Assignees.** The monorepo already has task items like `- [ ] Add @page size options` and `` - [ ] Does the WS/event ring buffer belong in `@augment-it/workspace` ``. Those are safe under the rules above, but an item that begins with a bare `@page` would read as an assignee unless a `collaborators` list is set. A site that displays assignees should set one.
- **Due dates.** `- [ ] Send the report for 2026-11-15` reads as due on that date, even if the author only meant to name it. Reordering the title or adding a real due date after it avoids this.

We ran the parser over the 996 tracked monorepo documents containing task items on 2026-11-01, excluding roll-up copies. Of 11,997 tasks, none produced an assignee, tag, estimate, or due date. A plain grep agreed, apart from one date-ending line that wasn't read as a due date. Existing documents don't use this syntax, so this shows turning the plugin on is quiet, not that the syntax works in practice.

## The script: `lfm-tasks`

We optimize the output for GitHub. `src/cli/lfm-tasks.ts` reads a repo's tracked markdown files and writes one Markdown file:

```md
# Tasks

2 open tasks across 2 documents. Generated by `lfm-tasks`, so edit the linked documents rather than this file.

## @mpstaton

- [ ] @mpstaton Review [Page Name](specs/Page-Name.md) #Docs 2026-11-15 ([plans/Launch.md:5](plans/Launch.md?plain=1#L5))

## Unassigned

- [ ] Unowned ([README.md:1](README.md?plain=1#L1))
```

- **Tracked files only.** That is what GitHub can link to. Submodules are skipped because their files live in another repo.
- **Changelogs skipped.** They are history, so an old unticked item in one isn't open work. `--include-changelog` reads them anyway.
- **Links back to the source line.** Relative links work on any branch or fork, and `?plain=1#L5` opens the source at that line.
- **Page references become links.** `[[path/to/Page-Name.md]]` is resolved against the repo's tracked files using `createPathResolver`, including bare and relative forms. One that doesn't settle on a single file keeps its display text and gets no link, because a wrong link is worse than none. Source documents keep the wikilink for Obsidian.
- **Collapsed completed tasks.** Finished work sits in a `<details>` block at the end.
- **No timestamp.** Regenerating only changes the file when the tasks changed, so it stays quiet in commits and CI diffs.
- **Skips its own output.** The file is full of checkboxes, so reading it back would duplicate every task.
- **Sub-tasks come out flat.** The aggregate list carries no parent links.

### Keeping `TASKS.md` current

Nothing generates tasks on GitHub. `lfm-tasks --install-hook` adds a local pre-commit hook: when a commit touches a `context-v/` Markdown file, the hook regenerates `TASKS.md` and adds it to that commit, so it goes up with the same push.

- **It reads the staged content.** `TASKS.md` describes the commit being made, so unstaged edits stay out of it.
- **It never blocks a commit.** If the script can't run, it warns and the commit goes ahead. A stale list is a smaller problem than work that can't be saved.
- **A post-commit hook syncs the index.** `git commit <path>` builds the commit from a temporary index with the real one locked, so the pre-commit `git add` can't reach it. Without the sync, `TASKS.md` shows as staged for deletion and the next commit would remove it. We found this in testing.
- **It's per clone.** Git doesn't share hooks, so each collaborator runs `--install-hook` once. The hook points at that clone's built script, so a stale build means stale behavior.
- **It won't overwrite other hooks.** It refuses if a `pre-commit` or `post-commit` hook already exists, or if `core.hooksPath` is set, since that directory may serve other repos.
- **Commits outside `context-v/` don't trigger it,** so a task added to a README waits for the next `context-v/` commit or a manual run.

### The functions underneath

`src/utils/aggregate-tasks.ts` has no filesystem access, so sites can use it directly. Callers strip frontmatter before parsing, as with the rest of the pipeline; otherwise `parseMarkdown` reads the closing `---` as a heading underline, and the last frontmatter line becomes the section of any task before the first real heading.

- **`aggregateTasks(documents)`** takes `{ source, tree }` pairs and returns one list, with each task's `source` recorded. It throws on a tree parsed without `taskMetadata`, because treating that as empty would report "no tasks" for a document full of them.
- **`groupTasks(tasks, by)`** groups by `section`, `assignee`, `tag`, or `source`, in first-seen order. A task with two assignees appears in both groups, and tasks with nothing to group on land in a final `null` group.
- **`tasksToMarkdown(tasks, options)`** writes the format above, with an optional `sourceLink`.

## Tags can't become headings

We worried that `#type` might parse as a heading, so we tested it. On 2026-11-01 we ran these through `parseMarkdown` from `src/` at version 0.6.0 with default options:

| Input | Result |
|---|---|
| `- [ ] @mpstaton Task 1 #Docs 2026-11-15` | Text |
| `- [ ] #Docs Task 1` | Text |
| `- [ ] # Docs Task 1` | Text |
| `- #Docs` | Text |
| `#Docs` on its own line | Text |
| `- [ ] Long task`, then an indented `#Docs` on the next line | Text |
| `- [ ] Task #123` | Text |
| `- # Docs` | **Heading** |
| `# Docs` on its own line | **Heading** |
| `- [ ] Long task`, then an indented `# Docs` on the next line | **Heading** |

A heading needs a space after the `#`, so a tag can't become one. The plugin can't fix the remaining cases, because block structure is settled before any remark plugin runs. They look like authoring mistakes, so the right tool would be a lint warning, if they ever come up in practice.

## Phases

Each phase is its own decision, and later ones may never be needed.

1. **Convention only.** Adopt the line format in `context-v/` documents. No code.
2. **Parser and script.** `src/plugins/lfm-task-metadata.ts`, `src/utils/aggregate-tasks.ts`, `src/cli/lfm-tasks.ts`, the preset option, types, and README and splash entries.
3. **Site rendering.** A site lists or filters tasks using `tree.data.tasks`.
4. **Lint.** Warn on the heading cases above, only if they occur.

### Phase 2 acceptance tests

Added under `test/` and run with `pnpm test`:

- The example line produces the output shown above, and its text is unchanged.
- `- [ ] Task #123` produces no tags.
- `- [ ] Add @page size options` produces no assignees.
- `` - [ ] `@page` rules `` produces no assignees.
- `- [ ] @page rules` is an assignee with no `collaborators` list, and plain text when `@page` isn't on the list.
- `- Task @mpstaton #Docs` (no checkbox) produces no task data.
- `- [ ] Task 2026-13-45` leaves `due` unset.
- `- [ ] Review 2026-11-15 notes` leaves `due` unset, because the date isn't last.
- `- [ ] Task 📅 2026-11-15` and `- [ ] Task 2026-11-15` produce the same `due`.
- With the plugin off, the AST is identical to today's.

These are in `test/task-metadata.test.mjs`, and `test/lfm-tasks-cli.test.mjs` runs the built script against throwaway git repos.

## What has and hasn't been verified

- **Run against LFM:** the heading table above, and that `@handle`, `#tag`, and `📅` stay in a single text node.
- **Read in the docs:** the cited Obsidian and Tasks behavior. Obsidian's docs show `task-todo:call`, not a query containing `@`.
- **Not tested in the real tools:** nothing here has been opened in Obsidian or rendered on GitHub, including the `task-todo:@mpstaton` search and the script's `?plain=1#L5` links. GitHub's mention, `#123`, and `?plain=1` behavior, and plain-text `@name` in Obsidian, come from general knowledge.

## Decisions

Made by Michael Staton on 2026-11-01:

- **Tasks plugin:** we use Obsidian, but not the Tasks plugin yet. The canonical date is therefore bare, and `📅` is accepted as an alias.
- **Date format:** a bare date, chosen over an explicit `due:2026-11-15`,[^ed1j4e] accepting the due-date false positive described above.
- **Collaborator list:** per-site config.
- **Handles:** every collaborator has a GitHub login today, so handles are GitHub logins. Collaborators without one are a plausible future case, not a current requirement.
- **Preset option:** `taskMetadata`, accepting `boolean` or `{ collaborators }`, as `headingIds` accepts a boolean or options.
- **Scope, added during implementation:** a parser plus a script that aggregates, with the output optimized for GitHub. TODO.md was inspiration, so the output doesn't follow its syntax.
- **Page references:** `[[path/to/Page-Name.md]]`, taken from Obsidian, is our syntax for referencing pages.
- **Changelogs:** skipped by default.
- **Trigger:** a local hook on commits touching `context-v/`, with `TASKS.md` committed in the same push. Automated generation on GitHub was declined.

## Open questions

Neither blocks Phase 1 or Phase 2.

- [ ] Should the plugin also write `hProperties`, so sites can style tasks without reading `tree.data`?
- [ ] Should we add a priority token? Tasks has its own, and this spec leaves it out until someone needs it.

## Related

- [[Naming-Plugins-Against-the-Remark-Ecosystem]]: picks the plugin prefix
- [[Maintain-Heading-Anchors-and-Share-Links]]: the `tree.data.headings` precedent
- [[Maintain-Lossless-Markdown-and-Extended-Markdown-Render-Pipeline]]: where this fits in the pipeline
- `gh-cli-projects-tasks-conventions` skill: real assignees on GitHub issues

[^nleaqq]: 2026-11-01. [TODO.md file format](https://github.com/todomd/todo.md). todomd.
[^b974ua]: 2026-11-01. [MD-syntax for due date & tag](https://discourse.joplinapp.org/t/md-syntax-for-due-date-tag/30020). Joplin Forum.
[^2lfd69]: 2026-11-01. [Categorise tasks by "assignee" (inline property) using dataview](https://forum.obsidian.md/t/categorise-tasks-by-assignee-inline-property-using-dataview/43345). Obsidian Forum.
[^tfuhpt]: 2026-11-01. [User Fields](https://tasknotes.dev/obsidian/features/user-fields/). TaskNotes documentation.
[^ed1j4e]: 2026-11-01. [todo.txt](https://github.com/todotxt/todo.txt). todotxt.
[^gl6ix8]: 2026-11-01. [Tags](https://obsidian.md/help/tags). Obsidian Help.
[^q0ktii]: 2026-11-01. [Tags](https://publish.obsidian.md/tasks/Getting+Started/Tags). Tasks User Guide.
[^vgapf6]: 2026-11-01. [Tasks Emoji Format](https://publish.obsidian.md/tasks/Reference/Task+Formats/Tasks+Emoji+Format). Tasks User Guide.
[^2j6bzo]: 2026-11-01. [Search](https://obsidian.md/help/plugins/search). Obsidian Help.
