---
id: comprehendo-wave-1
title: Spec Freeze and the Conformance Kit
initiative: comprehendo
initiative_version: 1
status: planned
depends_on: []
demo_state: Every shape in the RFC exists as a JSON Schema and at least one fixture; every MUST in the RFC traces to a kit fixture or negative fixture; the negative kit contains a raw-error leak, an oversized topic, a schema-escaping fix, and a telemetry attempt, each failing for its stated reason; the budget gates run and report (index, topic, priming).
content_hash: 23b54f96de97a100
---

# Wave 1: Spec Freeze and the Conformance Kit

No implementation code. This wave turns the RFC's shapes into executable
kit fixtures and never restates them by hand. Estimate: 3-4 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 01 | CC2 Shape Identity | SPEC | (none) |
| 02 | CC5 Context Budget | SPEC | (none) |
| 03 | Shape Schemas | COMPONENT | 01 |
| 04 | Conformance Fixtures | COMPONENT | 01, 03 |
| 05 | Negative Fixtures | COMPONENT | 01, 03, 04 |
| 06 | Budget Harness | COMPONENT | 02 |
