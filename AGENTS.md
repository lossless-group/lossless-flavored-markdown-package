# Agent instructions for `@lossless-group/lfm`

> `CLAUDE.md` is a symlink to this file. Edit `AGENTS.md`.

## `docs-v/` = docs

`docs-v/` is this repo's documentation folder. When anyone says "the docs", they mean `docs-v/`. Don't create a separate `docs/` folder.

- **The README stays short.** It covers what LFM is, install, quick start, the feature table, options, and imports. Detail goes in `docs-v/`.
- **A new feature gets both:** a row in the README's "What you can write" table, and a section or file in `docs-v/`, listed in `docs-v/index.md`.
- **`docs-v/` isn't published to JSR or npm,** so the README links to it with full GitHub URLs. Links inside `docs-v/` can be relative.
- **`context-v/` is different.** It holds specs, plans, and reminders for building LFM. `docs-v/` is for people using LFM.
- **`changelog/` keeps its name for now.**
