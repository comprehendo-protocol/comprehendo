---
id: comprehendo
title: Comprehendo Protocol and Reference Implementation
status: active
version: 1
content_hash: 11ed4ad0ca7d98cd
---

# Comprehendo Protocol and Reference Implementation

## Overview

Comprehendo is the protocol that makes software packages understandable to
AI, and this initiative builds its reference implementation: a monorepo of
four packages (`@comprehendo/spec`, the npm `comprehendo`, the PyPI
`comprehendo`, and `@comprehendo/registry-tools`) plus community registry
corpora, starting with the flagship `@comprehendo/ffmpeg`. A package that
speaks Comprehendo answers the agent holding it: every error arrives as a
structured twin carrying its own executable fix, the complete reference
lives in-process and answers questions in the asker's own vocabulary,
invocations can be judged before they execute, and the whole system is
taught to any agent by a priming snippet of roughly one hundred tokens. MCP
standardized calling tools; Comprehendo standardizes understanding them.

The philosophy is that models are structurally frozen, so comprehension
must ship with the code, not arrive with the next training run. The marker
rides on values and thrown errors because failure is the only discovery
moment that reliably happens; the probe is free until used, costing zero
context tokens unless an agent actually asks. Context economy is treated as
the product itself, not a nicety: the index is a menu, a query returns one
topic-sized answer, and the measured whole-session cost of stranger-to-fluent
is on the order of 800 tokens. Fix quality is mined, tested, and bounded:
every cataloged pitfall becomes a fence, a heal, or a runbook, in that
preference order, and every twin code and every fix is provoked by a real
test in CI or it does not ship (the folklore rule, CC4). The distribution
model deliberately follows DefinitelyTyped: `comprehendo` plus
`@comprehendo/<pkg>` corpora require zero package-owner buy-in on day one,
and native support (a package that ships its own corpus) always wins
precedence over the sidecar, with only the consumer able to override that
per package.

The system is built in seven dependency-ordered waves, each with its own
demo-state. Wave 1 freezes the protocol shapes into an executable
conformance kit before any implementation code exists. Wave 2 builds the
core JavaScript provider SDK (marker, twin builder, docs engine, corpus
generator) and proves it against a toy package. Wave 3 ports the identical
kit to Python with zero fixture changes, the gate for any further
ecosystem. Wave 4 builds the sidecar router that gives un-adopted packages
twins and docs with no cooperation required, plus the five consumer config
knobs. Wave 5 builds the registry and its submission gate (the folklore
rule, budget gates, fingerprint lint, the danger and injection lints) and
the owner-endorsement middle trust tier. Wave 6 is the flagship: an
ffmpeg corpus mined from real pitfall threads, demoed end-to-end on
camera. Wave 7 is distribution: the generated `COMPREHENDO.md`, the
finalized priming snippet, docs-as-tests, and the cold-agent benchmark that
is the number the whole project claims.

Eleven cross-cutting contracts (CC1 through CC11) run underneath every
wave, each enforced by a scan, test, or CI gate rather than by convention:
probe purity, shape identity across languages, no raw primary errors, the
folklore gate, the context budget, no telemetry, schema-bound fixes, native
precedence, marker freeze, honest miss (never a wrong guess), and registry
truth (the gate verifies every corpus claim against the real upstream
package). Security is treated as a fence with a gate, fixed before scale
rather than bolted on later: corpus text is data, never instructions, and
the completeness contract's own escape hatch (UNDOCUMENTED, with an
explicit permitted source read) keeps honesty about coverage a checked
shape instead of an aspiration.

This initiative is done when: the conformance kit passes 100% in
TypeScript and the Python port passes it with zero fixture changes and
byte-identical shapes; a toy package built with the provider SDK reaches
Level 2 conformance in under one working day; the sidecar router returns a
correct twin for every cataloged ffmpeg failure and an honest UNSTRUCTURED
for novel ones, with precedence flipping automatically on native adoption;
the submission gate rejects folklore, oversized topics, schema-escaping
fixes, and network-touching corpora by name; the ffmpeg demo runs
end-to-end on camera with no hand-wiring; the cold-agent benchmark
publishes a first-correction rate at or above the Operator's measured
baseline (18 of 18) within the token budget; the full surface passes under
a network-denying sandbox; and the Operator adopts the shipped SDK as
native reference implementation number one, its corpus passing the same
gate as community submissions.

## Waves

| Wave | Title | Status | Demo-state |
|---|---|---|---|
| comprehendo-wave-1 | Spec Freeze and the Conformance Kit | complete | Every RFC shape exists as a JSON Schema and fixture; every MUST traces to a kit fixture or negative fixture; budget gates run and report. |
| comprehendo-wave-2 | Core Provider SDK (JavaScript) | complete | A toy package built with the SDK passes the full kit: marker, twins, UNSTRUCTURED passthrough, three-vocabulary docs, UNDOCUMENTED with a working miss log, Level 2 validate/explain, priming under budget. |
| comprehendo-wave-3 | Python Port | planned | The identical kit passes with zero fixture changes; a Python-serialized twin is byte-identical to its Node fixture. |
| comprehendo-wave-4 | The Sidecar Router | planned | `comprehend(raw)` on an un-adopted toy returns the right twin or an honest UNSTRUCTURED; each config knob demonstrably changes routing; native adoption flips precedence automatically. |
| comprehendo-wave-5 | Registry and the Submission Gate | planned | An untestable-fix submission is rejected naming the folklore rule; a passing submission publishes as `@comprehendo/<pkg>` with its fingerprint index built. |
| comprehendo-wave-6 | The Flagship: ffmpeg | planned | On camera: priming snippet in, wrong flag, `comprehend(stderr)` returns a twin whose `fixes[0]` works, session lands within budget. |
| comprehendo-wave-7 | Distribution | planned | `COMPREHENDO.md` generates and drift-gates; the priming snippet is measured; the cold-agent benchmark passes at the target rate. |

## Open Questions

- Future ecosystem bindings (.NET/Go as the third, static-language binding;
  Ruby as a cheap dynamic port; Rust and JVM bindings) are explicitly
  deferred by the spec until the Python port passes the conformance kit
  with zero fixture changes (the Wave 3 exit gate); no feature docs exist
  for them yet, see `MDs/mdd-comprehendo-spec.md` lines 675-698.
- Bun joins the CI matrix when the runtime layer lands (a Bun-only kit
  failure becomes a release blocker); Deno enters when the kit passes on
  it. Not scheduled to a wave (lines 699-702).
- The remote refresh layer (`comprehendo.json`) stays reserved and
  unbuilt; registry versioning through npm/PyPI is expected to obsolete
  it. Revisit only on evidence that release cadence is too slow for
  corpus fixes (lines 665-668).
- Wave 1 open design questions the spec itself defers to the kit-freeze
  work: the packed-corpus binary format and its versioning; the
  fingerprint index format and cross-registry collision policy; whether
  `wrap()` ships in the first release or waits for evidence;
  submission-gate policy for packages with hostile or rapidly-moving
  error surfaces; the `apply` grammar (literal code vs. a `template`
  form with fingerprint-capture-group placeholders); and who runs
  `static-pattern` fingerprint matching (`wrap()`, a lint integration, or
  both). See lines 712-724. **Closed by Wave 1:** the exact topic/index
  token budgets (index 1200, topic 600, priming 150, measured and
  ratcheted by [06-budget-harness](../docs/06-budget-harness.md)).
- Trademark: a small Austrian firm (Comprehendo e.U.) exists in an
  unrelated class. A proper trademark search is needed before public
  announcement, not before building (line 709-711).

## Scope decisions

- Package name and registry reservations (npm, PyPI, RubyGems, NuGet
  stubs, the `comprehendo-protocol` GitHub org, comprehendo.dev) are
  tracked as a task doc (`39-registry-reservations`) outside the wave 1-7
  build chain, reflecting that this work already landed ad hoc (see git
  history) ahead of the formal wave build.
- Of the three worked corpus samples the spec names as seeds for "the
  corpus file format and the registry's first entries" (openai-python,
  zod, ffmpeg), only ffmpeg is built into a published registry corpus by
  this wave plan (Wave 6, docs 32-34), because the spec's own Build
  Order section commits Wave 6 solely to the ffmpeg flagship. openai
  -python and zod remain corpus-format and fingerprint-design seed
  material only; see the Scope decision on `32-ffmpeg-corpus`.
- `comprehendo.dev`'s registry-browsing website (spec lines 423-427) is
  tracked as its own doc, `40-registry-website`, in Wave 7.
- Wave 1's Negative Fixtures [05] ships all six must-fail fixtures as
  data, but only the one gate that exists in Wave 1 (CC5 [02] /
  [06-budget-harness](../docs/06-budget-harness.md)) actually rejects
  its fixture today. The other three demo-state-named fixtures
  (raw-error-leak/CC3, schema-escaping-fix/CC7, telemetry-attempt/CC6)
  are proven genuinely non-conforming at the content level but wait on
  their owning gate: CC3 [08] and CC7 [09] land in Wave 2 (Twin Builder
  [12]), CC6 [27] lands in Wave 5 (Submission Gate [29]). When each gate
  lands, re-running its negative fixture through the real gate is part
  of that feature's own build, not new scope.
