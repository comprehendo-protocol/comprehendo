---
id: comprehendo-wave-7
title: Distribution
initiative: comprehendo
initiative_version: 1
status: complete
depends_on: [comprehendo-wave-6]
demo_state: "MET, verified live 2026-08-23. COMPREHENDO.md generates from the packed corpus and fails CI when stale (real --check exits 0 current, exits 1 naming the exact line on an injected mutation, reverted). The priming snippet is published and measured (packages/spec/priming.md, real budget meter, PASS priming 144 / 150). The cold-agent benchmark passes at its target rate: the deterministic protocol-fidelity gate (an agent given only the priming snippet, per its own literal reading) scores 14/14, 100% first-correction, 0 source reads outside UNDOCUMENTED grants, matching the Operator's 18/18 baseline exactly, real live CLI run. A second, non-gating tier corroborates this against a real llama3:8b model and scores 7.1% (1/14); published unchanged as an open gap per the doc's own honesty rule, not hidden and not gating. The Operator's graduation is documented as the native-adoption walkthrough via 14-sdk-entry.md's Acceptance Criterion 3, which names this wave's cold-agent benchmark as its real wall-clock baseline, now measured."
content_hash: e22e35faeef7bfe0
---

# Wave 7: Distribution

Estimate: 3-4 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 35 | COMPREHENDO.md Generator | COMPONENT | 13, 28 |
| 36 | Priming Snippet Finalized | COMPONENT | 02, 13 |
| 37 | Docs As Tests | COMPONENT | 35 |
| 38 | Cold-Agent Benchmark | COMPONENT | 36, 22, 32, 10 |
| 39 | Package Name & Registry Reservations | task | (none) |
| 40 | Registry Website | COMPONENT | 28, 29, 36 |
| 41 | Corpus Discovery CLI | COMPONENT | 31, 27 |
| 42 | Static Pattern Matching | COMPONENT | 21, 37 |
