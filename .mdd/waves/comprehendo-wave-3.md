---
id: comprehendo-wave-3
title: Python Port
initiative: comprehendo
initiative_version: 1
status: complete
depends_on: [comprehendo-wave-2]
demo_state: The identical kit passes with zero fixture changes; a twin serialized from Python is byte-identical to its Node fixture; hasattr(exc, "__comprehendo__") is the working one-line probe in a REPL demo. A fixture-change request from the port is a spec bug, fix the spec first.
content_hash: 42dc96a3a4f23c3d
---

# Wave 3: Python Port

Estimate: 3-5 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 18 | Python Core | COMPONENT | 01, 03, 04, 11, 12, 13, 14, 15 |

## Demo-state Result (unattended run, 2026-08-22)

Executed against the real runtime, not asked for confirmation
(unattended mode). Result: **MET IN FULL**.

- **The identical kit passes with zero fixture changes: MET.**
  `git status --short packages/spec` is empty after the full Python
  suite runs; every positive (9) and negative (6) kit fixture is read
  in place from `packages/spec/kit/`, unmodified.
- **A twin serialized from Python is byte-identical to its Node
  fixture: MET, proven three independent ways.** Every kit fixture
  re-serialized by Python's `canonical()` equals its own file's bytes
  exactly; every twin built in Python from a kit fixture serializes
  identically to the fixture; and `test_cross_language_parity.py`
  runs the ACTUAL TypeScript source cross-language (Node's native type
  -stripping, an ESM resolve hook, nothing under `packages/core`
  copied or patched) and asserts byte-identical twins and identical
  matcher output on live queries, not only on the fixtures.
- **`hasattr(exc, "__comprehendo__")` works as the one-line probe:
  MET.** Verified live in this run: a cataloged failure raised through
  a from-scratch toy provider, caught, `hasattr(exc,
  "__comprehendo__")` returns `True`, `exc.twin['code']` and
  `exc.twin['fixes'][0]['title']` both correct.
- **"A fixture-change request from the port is a spec bug": held.**
  Three findings that looked like they might need a fixture change
  were investigated and NONE required one: the CC3 catalog-time
  substring check tripping on the kit's own `STAGE_UNKNOWN` twin is a
  shared TS/Python heuristic (identical in both, not a fixture
  problem); two `nearest` ranking lists the Python engine doesn't
  reproduce exactly were proven to match the TypeScript reference
  exactly by RUNNING both implementations side by side (a property of
  the ranking against the corpus, not a bug in either port); and the
  one genuine fixture problem found (`packages/core`'s own TEST
  fixture, not a kit fixture, drifting from the kit's own transcript)
  was fixed in the TEST fixture, the kit itself was never touched.

Wave-3 exit gate confirmed: 345/345 Python tests green, `mypy --strict`
clean over 37 files, zero runtime dependencies (scanned), 386/386 core
and 418/418 spec unaffected. No further language binding may begin
before this gate, per the spec's own Wave-3 precondition, and it is
now closed.
