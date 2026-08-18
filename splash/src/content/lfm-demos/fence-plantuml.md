---
title: plantuml
kind: fence
handler: plantuml
draws: "a PlantUML server, via <img>"
result_label: code node's data.fence
order: 56
note: >-
  Deflated and encoded into a server URL — no Java, no local renderer. The `@startuml` wrapper is added when the author omits it. The default server is the public plantuml.com instance, which means your diagram source travels in the URL; `createPlantUml({ server })` points it at a self-hosted one.
---

```plantuml
Alice -> Bob: Filing request
Bob --> Alice: Ack
Bob -> Archive: store(pdf)
```
