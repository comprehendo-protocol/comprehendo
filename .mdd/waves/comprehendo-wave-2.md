---
id: comprehendo-wave-2
title: Core Provider SDK (JavaScript)
initiative: comprehendo
initiative_version: 1
status: planned
depends_on: [comprehendo-wave-1]
demo_state: A toy package built with the SDK passes the full kit -- marker on export, errors, and handles; twins at the throw site; UNSTRUCTURED passthrough on an un-cataloged error; docs answering all three vocabularies from a packed corpus; UNDOCUMENTED with a working local miss log; validate and explain on the toy's Level 2 surface; priming and identity under budget.
content_hash: 4cd8f868a4c17649
---

# Wave 2: Core Provider SDK (JavaScript)

Estimate: 4-6 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 07 | CC1 Probe Purity | SPEC | (none) |
| 08 | CC3 No Raw Errors | SPEC | (none) |
| 09 | CC7 Schema-Bound Fixes | SPEC | (none) |
| 10 | CC9 Marker Freeze | SPEC | (none) |
| 11 | Marker & Probe | COMPONENT | 07, 10 |
| 12 | Twin Builder | COMPONENT | 03, 04, 08, 09 |
| 13 | Docs Engine | COMPONENT | 03, 04 |
| 14 | SDK Entry (makeProvider) | COMPONENT | 11, 12, 13 |
| 15 | Manifest Wiring | COMPONENT | 14 |
| 16 | Recorder | COMPONENT | 14 |
| 17 | Corpus Generator | COMPONENT | 03, 13 |
