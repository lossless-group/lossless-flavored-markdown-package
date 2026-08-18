---
title: graphviz
kind: fence
handler: graphviz
draws: "@viz-js/viz (WASM), client-side"
result_label: code node's data.fence
order: 51
note: >-
  Also recognition only, and claimed under both `graphviz` and `dot`. Layout is exactly the part a parser cannot do.
---

```dot
digraph filings {
  rankdir=LR;
  intake -> triage -> archive;
  triage -> reject [style=dashed];
}
```
