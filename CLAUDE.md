# Comprehendo

## What this is

Comprehendo is the protocol that makes software packages understandable to
AI, and this repo is its reference implementation. A package that speaks
Comprehendo answers the agent holding it: every error arrives as a
structured twin carrying its own executable fix, the complete reference
lives in-process and answers questions in the asker's own vocabulary,
invocations can be judged before they execute, and the whole system is
taught to any agent by a priming snippet of roughly one hundred tokens. MCP
standardized calling tools; Comprehendo standardizes understanding them.

Exported package: `comprehendo` (npm and PyPI, both held). JavaScript
marker: `Symbol.for('comprehendo')`. Python marker: `__comprehendo__`.
GitHub org: `comprehendo-protocol`. Domain: comprehendo.dev.

## Core philosophy

- **Comprehension ships with the code, not with the next model generation.**
  A model's knowledge of a package is frozen at training time, so the
  corpus is versioned in lockstep with the code it describes, current by
  construction.
- **The marker rides on values because failure is the only discovery moment
  that matters.** Any handle the agent is holding answers the probe in one
  line, no I/O, no side effects, and it is free until used.
- **Context economy is the product.** The index is a menu, never the meal:
  one topic-sized answer per query, no manual dumps.
- **Fix quality is mined, tested, and bounded.** Every cataloged pitfall is
  a fence, a heal, or a runbook, in that preference order, and every fix is
  provoked by a real test or deleted as folklore (the folklore rule).
- **Native beats sidecar, only the consumer can override.** A package that
  speaks natively wins precedence automatically; a provider gets no veto
  over a community corpus.
- **Corpus text is data, never instructions.** A conforming `apply` can only
  invoke the provider's own declared call schema, so a compromised corpus
  cannot smuggle a command.
- **No telemetry, ever.** Nothing crosses the wire in either tier. The miss
  log is a local file for the maintainer.
- **The spec is the test suite.** Nothing is "supported" that the conformance
  kit does not exercise.
- No em dashes anywhere in source or docs. Comma or single hyphen.

## What this project is NOT

Not an MCP server (Comprehendo is the in-process conversation, MCP the
out-of-process one). Not a human error-message prettifier. Not a docs site
or generator. Not a runtime monkey-patcher (`wrap()` is explicit opt-in).
Not telemetry. Not an LLM feature (zero model calls, deterministic corpora).
Not the remote refresh layer (`comprehendo.json` stays reserved, unbuilt).

## Architecture

Monorepo, four packages plus registry corpora:

- `@comprehendo/spec`, the normative protocol document plus the
  conformance kit (language-neutral JSON fixtures for every shape and
  probe-behavior). The single source of behavioral truth.
- `comprehendo` (npm), three layers in one install: agent surfaces
  (`comprehend(raw)`, `docs(pkg, query?)`, the fingerprint router), the
  provider SDK (twin builder, docs engine, marker attachment, manifest
  wiring), and the consumer config loader (prefer/pin/disable/require/local).
- `comprehendo` (PyPI), the same three layers in Python, passing the
  identical conformance kit with zero fixture changes.
- `@comprehendo/registry-tools`, corpus file format, submission-gate CI,
  the fingerprint index builder, the scoped `@comprehendo/<pkg>` publisher.
- Registry corpora, `@comprehendo/<pkg>`, community-authored sidecar
  corpora for un-adopted packages, starting with the flagship
  `@comprehendo/ffmpeg`.

Dependency direction is one-way: registry-tools -> (spec, core); core ->
spec; python -> spec (fixtures only); spec -> nothing (it is data);
corpora -> registry-tools at build time only.

## Tech stack

TypeScript strict mode, no `any`, Node.js LTS, ESM, zero runtime
dependencies in the core (scanned in CI). Python 3.11+ port using
`typing.Protocol`/`TypedDict`, zero runtime dependencies, same kit. Vitest
per package, pytest for the port. tiktoken-class tokenizers for the budget
gates. One responsibility per file, max 400 lines, one file per corpus
topic.

## MDD docs

`.mdd/docs/` holds the build-instruction docs for every feature, **numbered
in build order**: doc `07` cannot depend on doc `12`. Docs are tagged
COMPONENT (results in code) or SPEC (a behavior contract a COMPONENT must
satisfy); eleven SPECs (CC1 through CC11) are the project's cross-cutting
contracts, each enforced by a scan, test, or CI gate. Docs are grouped into
7 waves under `.mdd/waves/`, in build-dependency order, under the
`comprehendo` initiative (`.mdd/initiatives/comprehendo.md`). Docs are build
instructions, not reference material: read the doc before touching the code
it owns.

## Key constraints

- Every error is twinned or honestly marked UNSTRUCTURED, never raw.
- Every docs answer is topic-sized, never a dump.
- Every fix is schema-bound to the provider's own call surface or is an
  inert docs pointer.
- Every fix is provoked by a real test in CI or it does not ship (folklore
  rule).
- The probe is side-effect free and costs zero tokens until used.
- Nothing, ever, is transmitted anywhere.
- `comprehendo-spec.md` (the RFC, in `MDs/`) is the normative companion,
  where a doc and the RFC disagree, the RFC wins and the doc has a bug.
