# Contributing

## Tests

```bash
pnpm test        # builds, then runs the suite
pnpm test:only   # skip the build when dist/ is current
```

**Zero test dependencies** — `node:test` and `node:assert` are already in the runtime. They run against `dist/`, not `src/`, so each run exercises the barrel exports, the tsup entry map and the built output rather than only the TypeScript.

A few of the files guard things that would otherwise fail silently somewhere else:

| File | Guards |
|---|---|
| `naming-contract` | Every deprecated export alias still resolves. Drop one and it breaks in a consuming repo weeks later, not here. |
| `export-parity` | `package.json` and `deno.json` declare the same subpaths. They drifted once, and the entire fence registry was unimportable from JSR for two releases. |
| `heading-ids` | The slugifier's *quirks* — extension stripping, `--` collapse, underscore survival. Published anchors depend on them. |
| `demo-fixtures` | The splash's demo examples still demonstrate what they claim, parsed from the real markdown files on disk. |

## Plugin names

Three prefixes, one rule. `remark-*` is the ecosystem's — `remark-gfm` and `remark-directive` are dependencies, not ours. `remark-lfm-*` means the remark ecosystem has a formal plugin for this capability and we do it our own way. `lfm-*` means we invented it — our syntax trigger, our handling, no upstream equivalent. Full rule: `context-v/reminders/Naming-Plugins-Against-the-Remark-Ecosystem.md`.

## Docs

The README stays short. Detail goes in [`docs-v/`](./docs-v/), and a new feature gets a row in the README table plus a section or file there.
