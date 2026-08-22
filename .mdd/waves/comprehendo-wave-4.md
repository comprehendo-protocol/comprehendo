---
id: comprehendo-wave-4
title: The Sidecar Router
initiative: comprehendo
initiative_version: 1
status: planned
depends_on: [comprehendo-wave-2]
demo_state: With @comprehendo/<toy> installed and the toy package NOT adopted, a caught raw error handed to comprehend(raw) fingerprints to the right corpus and returns its twin; an unknown error returns UNSTRUCTURED, never a wrong match; docs('<toy>', query) answers; installing the native toy flips precedence automatically; each config knob (prefer, pin, disable, require, local) demonstrably changes routing, and local mounts a private corpus for an internal package.
content_hash: 9aae8b2d90fa6ec1
---

# Wave 4: The Sidecar Router

Estimate: 4-6 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 19 | CC8 Native Precedence | SPEC | (none) |
| 20 | CC10 Honest Miss | SPEC | (none) |
| 21 | Fingerprint Index & Matcher | COMPONENT | 20 |
| 22 | Router & Precedence | COMPONENT | 19, 21, 12 |
| 23 | Config Loader | COMPONENT | 22 |
| 24 | Wrap Opt-In Proxy | COMPONENT | 22, 12 |
