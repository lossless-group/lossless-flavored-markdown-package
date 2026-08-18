---
title: jsoncanvas
kind: fence
handler: jsoncanvas
draws: "your canvas renderer"
result_label: code node's data.fence
order: 52
note: >-
  The source is JSON, so parsing is free. Missing `nodes` / `edges` are normalized to empty arrays so renderers can skip the guards.
---

```jsoncanvas
{
  "nodes": [
    { "id": "a", "type": "text", "text": "Intake", "x": 0, "y": 0, "width": 200, "height": 60 },
    { "id": "b", "type": "text", "text": "Archive", "x": 300, "y": 0, "width": 200, "height": 60 }
  ],
  "edges": [{ "id": "e1", "fromNode": "a", "toNode": "b", "label": "filed" }]
}
```
