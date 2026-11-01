---
title: lfm-task-metadata
lede: Assign tasks with a plain checkbox line, then roll a whole repo's tasks into one file for GitHub.
order: 70
status: Beta
icon: ☑
tags: [Tasks, GitHub]
---

`- [ ] @mpstaton Task title #Docs 2026-11-15` reads correctly in Obsidian and on
GitHub with no plugin. Turn on `taskMetadata` and LFM also exposes the assignees,
tags, estimate and due date as data, leaving the text as written. The `lfm-tasks`
script then rolls a repo's tasks into one file, each linking to its source line.
