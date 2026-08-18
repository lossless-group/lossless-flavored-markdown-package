---
title: json-schema
kind: fence
handler: json-schema
draws: "nobody — the tree is the output"
result_label: code node's data.fence
order: 55
note: >-
  Also parsed to a tree. `$ref` targets are expanded inline rather than left dangling, enums render inline, and unions render as unions.
---

```json-schema
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Portco Filing",
  "type": "object",
  "required": ["id", "status"],
  "properties": {
    "id": { "type": "string", "description": "Stable identifier" },
    "status": { "enum": ["pending", "filed", "failed"] },
    "attachments": { "type": "array", "items": { "$ref": "#/$defs/attachment" } },
    "reviewer": { "type": ["string", "null"] }
  },
  "$defs": {
    "attachment": {
      "type": "object",
      "properties": { "filename": { "type": "string" }, "bytes": { "type": "integer" } }
    }
  }
}
```
