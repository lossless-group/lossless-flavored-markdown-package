---
title: mermaid
kind: fence
handler: mermaid
draws: "mermaid.js, client-side"
result_label: code node's data.fence
order: 50
note: >-
  Recognition only. The handler claims the language and stops — parsing a diagram whose whole value is its layout would be pretending. The renderer reads the format and hands the source to mermaid.
---

```mermaid
graph TD;
  Intake[Email arrives] --> Filed{Already filed?};
  Filed -- no --> Store[(Archive)];
  Filed -- yes --> Skip[Skip];
```
