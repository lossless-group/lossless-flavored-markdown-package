---
title: yang
kind: fence
handler: yang
draws: "nobody — the tree is the output"
result_label: code node's data.fence
order: 54
note: >-
  Parsed all the way to an RFC 8340 tree diagram. The marker grammar is real: `mandatory` suppresses `?`, a leaf-list takes `*`, a presence container takes `!`, and `config false` propagates `ro` to its descendants.
---

```yang
module acme-system {
  namespace "urn:acme:system";
  prefix acme;
  revision 2026-08-17;

  container system {
    leaf hostname { type string; mandatory true; }
    leaf-list domain-search { type string; }
    container ntp {
      presence "enables ntp";
      leaf enabled { type boolean; }
    }
    list interface {
      key "name";
      leaf name { type string; }
      leaf speed { type uint32; config false; }
    }
  }
}
```
