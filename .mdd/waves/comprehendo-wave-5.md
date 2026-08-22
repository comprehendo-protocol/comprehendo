---
id: comprehendo-wave-5
title: Registry and the Submission Gate
initiative: comprehendo
initiative_version: 1
status: planned
depends_on: [comprehendo-wave-4]
demo_state: A corpus submission with an untestable fix is rejected by CI naming the folklore rule; a passing submission publishes as @comprehendo/<pkg> with its fingerprint index built; the gate's checks run identically on the Operator's native corpus, proving one discipline for both tiers.
content_hash: f523d873e0f84e4f
---

# Wave 5: Registry and the Submission Gate

Estimate: 3-4 days. The submission channel is pull requests against
`comprehendo-protocol/registry`, one directory per package, never a web
portal (the DefinitelyTyped shape): CODEOWNERS per corpus directory, a
merge bot lands owner-approved green-CI PRs, and publishing happens only
from CI on merged main with provenance attestations, no human publish
tokens. Owner endorsement is the middle trust tier, additive, never a veto.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 25 | CC11 Registry Truth | SPEC | (none) |
| 26 | CC4 Folklore Gate | SPEC | (none) |
| 27 | CC6 No Telemetry | SPEC | (none) |
| 28 | Corpus Format | COMPONENT | 03 |
| 29 | Submission Gate | COMPONENT | 25, 26, 27, 28, 21 |
| 30 | Owner Endorsement | COMPONENT | 29 |
| 31 | Scoped Publisher | COMPONENT | 28, 29 |
