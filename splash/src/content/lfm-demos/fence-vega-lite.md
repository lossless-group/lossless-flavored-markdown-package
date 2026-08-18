---
title: vega-lite
kind: fence
handler: vega-lite
draws: "vega-embed, client-side"
result_label: code node's data.fence
order: 53
note: >-
  Parsed to a summary as well as the spec — mark, channels, data source, title. A chart that renders as nothing with JS off should at least be able to say what it was going to draw.
---

```vega-lite
{
  "title": "Filings per quarter",
  "data": { "values": [
    { "quarter": "Q1", "filings": 12 },
    { "quarter": "Q2", "filings": 31 },
    { "quarter": "Q3", "filings": 24 }
  ]},
  "mark": "bar",
  "encoding": {
    "x": { "field": "quarter", "type": "ordinal" },
    "y": { "field": "filings", "type": "quantitative" }
  }
}
```
