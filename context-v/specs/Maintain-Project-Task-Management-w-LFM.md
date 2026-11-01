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
at_semantic_version: 0.0.2.0
status: Signed-Off
tags:
  - Spec
  - Task-Management
  - Task-Lists
  - Obsidian
  - GitHub
  - Remark-Plugins
summary: "The signed-off authoring convention for assigning tasks in markdown, plus the design for an opt-in lfm-task-metadata plugin. Load before adding task, assignee, or due-date syntax to LFM, or when someone asks how to assign work in a context-v document. The convention can be used today; no plugin code exists yet."
type: Specs
---

# Maintain Project Task Management with LFM

## Why Care?

Plans and specs keep turning into to-do lists, and those lists need owners. Markdown has checkboxes, but it has no idea who a task belongs to or when it is due.

We write in Obsidian and collaborate on GitHub, and neither tool's task syntax works in the other. Picking one tool's syntax would leave half the team reading noise. This spec picks one plain line that means something in both, then lets LFM read that line as data for any site that wants to list or filter tasks.

## Goals

- One task-line format, written by hand, that needs no translation between Obsidian and GitHub.
- The source text stays untouched, so the same line can be pasted into a GitHub issue.
- An opt-in LFM plugin that exposes assignees, tags, and due dates as structured data.

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
| Trailing `@name`, as in TODO.md[^nleaqq] | A leading handle is easier to scan and to parse. TODO.md tools may not read our form, which we accept. |

### Prior art

No shared standard exists for assigning tasks in markdown. TODO.md[^nleaqq] is the closest thing to a written spec, and Joplin's Inline Todo plugin uses `@assignee` too.[^b974ua] todo.txt also uses `@`, but for a context rather than a person,[^ed1j4e] so don't assume every `@` means an owner.

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
  due: '2026-11-15',
};

// On the root, in document order, for lists and filters.
tree.data.tasks = [
  { text: 'Task title', checked: false, line: 12, assignees: ['mpstaton', 'tanujsk'], tags: ['Docs'], due: '2026-11-15' },
];
```

### Extraction rules

- **Scope.** Only list items where `checked` is a boolean. Each nested sub-task is its own task. Plain bullets and prose are ignored.
- **Text nodes only.** `` `@page` `` in backticks is an `inlineCode` node, so it is skipped automatically.
- **Assignees.** Only the leading run of `@handle` tokens, each followed by whitespace. `@augment-it/workspace` fails that test because of the `/`.
- **Collaborator list.** Each site can set a `collaborators` list in its own config, which limits who counts, compared case-insensitively. An unlisted handle stays plain text.
- **Tags.** `#` at the start of the text or after whitespace, then letters, numbers, `_`, `-`, or `/`,[^q0ktii] with at least one letter.
- **Due date.** The last token on the line, if it's a real `YYYY-MM-DD` date, optionally preceded by `📅`. Anything else leaves `due` unset.

### The false positives to expect

- **Assignees.** The monorepo already has task items like `- [ ] Add @page size options` and `` - [ ] Does the WS/event ring buffer belong in `@augment-it/workspace` ``. Those are safe under the rules above, but an item that begins with a bare `@page` would read as an assignee unless a `collaborators` list is set. A site that displays assignees should set one.
- **Due dates.** `- [ ] Send the report for 2026-11-15` reads as due on that date, even if the author only meant to name it. Reordering the title or adding a real due date after it avoids this.

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
2. **Plugin.** Add `src/plugins/lfm-task-metadata.ts`, the preset option, types, and README and splash entries.
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

## What has and hasn't been verified

- **Run against LFM:** the heading table above, and that `@handle`, `#tag`, and `📅` stay in a single text node.
- **Read in the docs:** the cited Obsidian and Tasks behavior. Obsidian's docs show `task-todo:call`, not a query containing `@`.
- **Not tested in the real tools:** nothing here has been opened in Obsidian or rendered on GitHub, including the `task-todo:@mpstaton` search. GitHub's mention and `#123` behavior, and plain-text `@name` in Obsidian, come from general knowledge.

## Decisions

Made by Michael Staton on 2026-11-01:

- **Tasks plugin:** we use Obsidian, but not the Tasks plugin yet. The canonical date is therefore bare, and `📅` is accepted as an alias.
- **Date format:** a bare date, chosen over an explicit `due:2026-11-15`,[^ed1j4e] accepting the due-date false positive described above.
- **Collaborator list:** per-site config.
- **Handles:** every collaborator has a GitHub login today, so handles are GitHub logins. Collaborators without one are a plausible future case, not a current requirement.
- **Preset option:** `taskMetadata`, accepting `boolean` or `{ collaborators }`, as `headingIds` accepts a boolean or options.

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
