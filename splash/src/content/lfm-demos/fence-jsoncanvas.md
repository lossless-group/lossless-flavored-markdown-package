---
title: jsoncanvas
kind: fence
handler: jsoncanvas
draws: "your canvas renderer"
result_label: code node's data.fence
order: 52
note: >-
  A real Obsidian canvas — a host shell fanning out to six microfrontends, with
  grouped implementations and shared services beneath it. The source is JSON, so
  parsing is free: nodes, edges and groups come back normalized, and missing
  `nodes` / `edges` become empty arrays so renderers can skip the guards. Every
  node here was a `file` node pointing at an internal document; those references
  are replaced with plain labels, which is what a `text` node is for.
---

```jsoncanvas
{
  "nodes": [
    {
      "id": "7fac4e97ed672ff8",
      "x": -360,
      "y": -120,
      "width": 2400,
      "height": 1320,
      "type": "group",
      "label": "Microfrontends",
      "color": "1"
    },
    {
      "id": "5224f4b69bfd60ee",
      "x": -360,
      "y": 1340,
      "width": 1540,
      "height": 440,
      "type": "group",
      "label": "Shared services",
      "color": "3"
    },
    {
      "id": "d4f248b6d654789a",
      "x": -270,
      "y": 460,
      "width": 730,
      "height": 660,
      "type": "group",
      "label": "Implementations",
      "color": "2"
    },
    {
      "id": "0c61d3b228ab02b1",
      "x": 560,
      "y": -680,
      "width": 600,
      "height": 275,
      "type": "text",
      "text": "Host shell",
      "color": "5"
    },
    {
      "id": "500d137c307ae72d",
      "x": -250,
      "y": 520,
      "width": 320,
      "height": 560,
      "type": "text",
      "text": "Record Collector \u2014 implementation"
    },
    {
      "id": "13b24c973c83e305",
      "x": -860,
      "y": 1360,
      "width": 400,
      "height": 400,
      "type": "text",
      "text": "Module federation with Docker"
    },
    {
      "id": "d01e76d0c7be9a26",
      "x": -340,
      "y": 1360,
      "width": 400,
      "height": 400,
      "type": "text",
      "text": "API services"
    },
    {
      "id": "5f82a67835e2e084",
      "x": 220,
      "y": 1360,
      "width": 400,
      "height": 400,
      "type": "text",
      "text": "Shared UX factory"
    },
    {
      "id": "510b3229a46ed2de",
      "x": 760,
      "y": 1360,
      "width": 400,
      "height": 400,
      "type": "text",
      "text": "DevOps suite"
    },
    {
      "id": "a210c313263cda0b",
      "x": -1000,
      "y": -40,
      "width": 400,
      "height": 1000,
      "type": "text",
      "text": "Data augmentation workflow",
      "color": "4"
    },
    {
      "id": "ac2afdf05e87ca89",
      "x": 860,
      "y": -40,
      "width": 340,
      "height": 400,
      "type": "text",
      "text": "Response Reviewer"
    },
    {
      "id": "1a9c649e46a79f26",
      "x": -240,
      "y": -40,
      "width": 300,
      "height": 400,
      "type": "text",
      "text": "Record Collector"
    },
    {
      "id": "fee2304cdc0ca011",
      "x": 1260,
      "y": -40,
      "width": 340,
      "height": 400,
      "type": "text",
      "text": "Highlight Collector"
    },
    {
      "id": "b8baf610263acd9c",
      "x": 120,
      "y": 520,
      "width": 320,
      "height": 560,
      "type": "text",
      "text": "Prompt Manager \u2014 implementation"
    },
    {
      "id": "78e62b795b9121a8",
      "x": 480,
      "y": -40,
      "width": 340,
      "height": 400,
      "type": "text",
      "text": "Request Reviewer"
    },
    {
      "id": "f40ce181ffbb721e",
      "x": 1660,
      "y": -40,
      "width": 320,
      "height": 400,
      "type": "text",
      "text": "Insight Assembler"
    },
    {
      "id": "e57b4c5d510757d2",
      "x": 120,
      "y": -40,
      "width": 320,
      "height": 400,
      "type": "text",
      "text": "Prompt Template Manager"
    },
    {
      "id": "5b136670aca97362",
      "x": -390,
      "y": -711,
      "width": 670,
      "height": 337,
      "type": "text",
      "text": "Micro-federation explainer",
      "color": "6"
    }
  ],
  "edges": [
    {
      "id": "a574669ce253b12d",
      "fromNode": "0c61d3b228ab02b1",
      "fromSide": "bottom",
      "toNode": "1a9c649e46a79f26",
      "toSide": "top",
      "label": "mounts"
    },
    {
      "id": "ff2d50862a42ec2b",
      "fromNode": "0c61d3b228ab02b1",
      "fromSide": "bottom",
      "toNode": "e57b4c5d510757d2",
      "toSide": "top",
      "label": "mounts"
    },
    {
      "id": "ec128acfd52ef1e5",
      "fromNode": "0c61d3b228ab02b1",
      "fromSide": "bottom",
      "toNode": "78e62b795b9121a8",
      "toSide": "top",
      "label": "mounts"
    },
    {
      "id": "6a2a0a513b447537",
      "fromNode": "0c61d3b228ab02b1",
      "fromSide": "bottom",
      "toNode": "ac2afdf05e87ca89",
      "toSide": "top",
      "label": "mounts"
    },
    {
      "id": "4aecd4257005ade8",
      "fromNode": "0c61d3b228ab02b1",
      "fromSide": "bottom",
      "toNode": "fee2304cdc0ca011",
      "toSide": "top",
      "label": "mounts"
    },
    {
      "id": "4998a6dcb70dee0f",
      "fromNode": "0c61d3b228ab02b1",
      "fromSide": "bottom",
      "toNode": "f40ce181ffbb721e",
      "toSide": "top",
      "label": "mounts"
    },
    {
      "id": "9322a96dc3838473",
      "fromNode": "1a9c649e46a79f26",
      "fromSide": "right",
      "toNode": "e57b4c5d510757d2",
      "toSide": "left"
    },
    {
      "id": "c6884aa0cf24564f",
      "fromNode": "e57b4c5d510757d2",
      "fromSide": "right",
      "toNode": "78e62b795b9121a8",
      "toSide": "left"
    },
    {
      "id": "0a6e74ad751847ec",
      "fromNode": "78e62b795b9121a8",
      "fromSide": "right",
      "toNode": "ac2afdf05e87ca89",
      "toSide": "left"
    },
    {
      "id": "12d2da5b9569f8c9",
      "fromNode": "fee2304cdc0ca011",
      "fromSide": "right",
      "toNode": "f40ce181ffbb721e",
      "toSide": "left"
    },
    {
      "id": "b18446de33f7cf69",
      "fromNode": "ac2afdf05e87ca89",
      "fromSide": "right",
      "toNode": "fee2304cdc0ca011",
      "toSide": "left"
    },
    {
      "id": "78a79d215125d427",
      "fromNode": "1a9c649e46a79f26",
      "fromSide": "bottom",
      "toNode": "500d137c307ae72d",
      "toSide": "top"
    },
    {
      "id": "f8d191800876d03d",
      "fromNode": "e57b4c5d510757d2",
      "fromSide": "bottom",
      "toNode": "b8baf610263acd9c",
      "toSide": "top"
    },
    {
      "id": "37a360be2fa09daf",
      "fromNode": "a210c313263cda0b",
      "fromSide": "right",
      "toNode": "7fac4e97ed672ff8",
      "toSide": "left"
    },
    {
      "id": "ba5559652517e25c",
      "fromNode": "5b136670aca97362",
      "fromSide": "right",
      "toNode": "0c61d3b228ab02b1",
      "toSide": "left"
    }
  ]
}
```
