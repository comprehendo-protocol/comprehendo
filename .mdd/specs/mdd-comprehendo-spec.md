# Comprehendo - Specification

## What You Are Building

Comprehendo is the protocol that makes software packages understandable to
AI, and this project is its reference implementation. A package that speaks
Comprehendo answers the agent holding it: every error arrives as a
structured twin carrying its own executable fix, the complete reference
lives in-process and answers questions in the asker's own vocabulary,
invocations can be judged before they execute, and the whole system is
taught to any agent by a priming snippet of roughly one hundred tokens. MCP
standardized calling tools; Comprehendo standardizes understanding them.
The exported package is `comprehendo` (npm and PyPI, both held), the
JavaScript marker is `Symbol.for('comprehendo')`, the Python marker is
`__comprehendo__`, the GitHub org is `comprehendo-protocol`, and the domain
is comprehendo.dev.

Three promises, one per constituency. To the developer: your agent stops
guessing at post-cutoff APIs, because knowledge arrives with `npm install`,
not with the next model generation. To the package maintainer: your library
works with AI the day you ship it, not the year the models catch up, and
the community may have already written your corpus for you. To the AI: one
reflex covers the entire software ecosystem, probe any handle or caught
error, and if it answers, ask instead of guess; fluency by turn two,
measured, not hoped (18 of 18 structured error cycles resolved on the very
next attempt across the Operator's instrumented builds).

The system is a monorepo of four packages plus registry corpora:

- `@comprehendo/spec`: the normative protocol document plus the conformance
  kit, language-neutral JSON fixtures for every shape (twins, fixes, docs
  topics, UNDOCUMENTED, UNVALIDATABLE, entries) and probe-behavior
  fixtures. The single source of behavioral truth; implementations are
  things that pass it.
- `comprehendo` (npm): the core, three layers in one install. Agent
  surfaces (`comprehend(raw)`, `docs(pkg, query?)`, the fingerprint
  router); the provider SDK (twin builder, docs engine, marker attachment,
  manifest wiring, so native adoption is a dependency plus a corpus, never
  an implementation project); the consumer config loader (the `comprehendo`
  key in package.json: prefer, pin, disable, require, local).
- `comprehendo` (PyPI): the same three layers in Python, passing the
  identical conformance kit with zero fixture changes.
- `@comprehendo/registry-tools`: the corpus file format, the submission
  gate CI (the folklore rule as an executable check), the fingerprint index
  builder, and the scoped-package publisher for `@comprehendo/<pkg>`
  corpora.
- Registry corpora, `@comprehendo/<pkg>`: community-authored sidecar
  corpora for packages whose owners have not adopted, installed on demand,
  starting with the flagship `@comprehendo/ffmpeg`.

The load-bearing rule:

**Every error is twinned or honestly marked UNSTRUCTURED, never raw; every
docs answer is topic-sized in the asker's vocabulary, never a dump; every
fix is expressible in the provider's own shipped call schema or is an inert
docs pointer, and every fix is provoked by a real test or deleted as
folklore; the probe is side-effect free and costs zero tokens until used;
and nothing, ever, is transmitted anywhere.** Conformance is proven by the
kit, never claimed.

**What this project is NOT:**

- Not an MCP server. MCP is the out-of-process conversation; Comprehendo is
  the in-process one, present inside a caught exception, free until used,
  infrastructure-free. An MCP server can wrap a Comprehendo-speaking tool
  for remote callers; they are layers, never rivals.
- Not an error-message prettifier for humans. The twin is the interface and
  the agent is the reader; human renderings are derived, optional, and
  never the canonical form.
- Not a docs site or docs generator. The corpus ships inside packages and
  answers queries in-process; no site, no search index, no web.
- Not a runtime monkey-patcher. The sidecar tier translates after the
  catch; `wrap()` is explicit opt-in; nothing global is ever mutated by
  import.
- Not telemetry. No queries, miss logs, usage counts, or fingerprints ever
  leave the machine. The miss log is a local file for the maintainer.
- Not an LLM feature. The core makes zero model calls; corpora are authored
  and tested content, deterministic at runtime.
- Not the remote refresh layer. `comprehendo.json` stays reserved; registry
  versioning through npm and PyPI is the update channel and will likely
  obsolete it.
- Not started on wish-list ecosystems. No Rust, Go, Ruby, or JVM binding
  begins until the Python port passes the conformance kit with zero fixture
  changes. One port teaches spec lessons cheaply; four teach them
  expensively.

---

## Why This Shape

**Models are structurally frozen, so comprehension must ship with the
code.** Whatever a model knows about a package it learned from training
data that is months stale on its best day. Every post-cutoff release turns
fluency into confident wrongness, and a package released today has no
training presence at all, which quietly punishes new tools and entrenches
incumbents. Comprehendo moves the distribution of comprehension from
training runs to package managers: the corpus is versioned in lockstep with
the code it describes, current by construction.

**The marker rides on values because failure is the only discovery moment
that matters.** Nobody consults a manual to learn whether an object is
iterable; they check for the well-known marker. The same reflex, one level
up: any handle the agent is holding, the client, a cursor, the caught error
itself, answers the probe in one line with no I/O and no side effects. An
agent that merely catches an error learns mid-flight that the fluent path
exists, because the twin self-identifies. And the probe is free until used:
an MCP tool costs schema tokens in every request whether called or not; the
prototype marker costs zero until probed.

**Context economy is the product, not a nicety.** The index is a menu,
never the meal. A query returns one topic-sized answer; the reference
implementation ships roughly 200 one-topic files. The agent's scarce
resource is context-window tokens, and a docs surface that dumps the manual
un-solves the exact problem the contract exists to solve. The measured
whole-session cost of going from stranger to fluent is on the order of 800
tokens: one entry, one index, one topic, one twin.

**Three vocabularies because the model arrives knowing something else.**
The model's first instinct is always its trained vocabulary, so `docs`
answers in the tool's own terms, in the terms of tools the model already
knows (the ffmpeg flag for X, the yup equivalent of Y), and in task
language (how to crop, how to undo). Translation lookup is the on-ramp; the
docs meet the model where it is and walk it across. Unknown queries answer
with did-you-mean across all three tiers, never a bare miss.

**Fix quality is the product, so fixes are mined, tested, and bounded.**
The failures worth structuring are the ones that actually happen: support
threads, issue trackers, unanswered forum posts, dispositioned entry by
entry. Every cataloged pitfall becomes a fence (the mistake cannot be
expressed), a heal (fixed silently and safely), or a runbook (the twin with
steps), and fences and heals outrank runbooks because the best twin is the
one that never fires. A fix no real test can provoke is folklore and is
deleted. A wrong fix teaches models wrong at scale; this discipline is the
moat.

**The distribution model is DefinitelyTyped, because that model already
won.** TypeScript did not convince every maintainer to ship types; the
community shipped types about packages until native support became table
stakes. The `comprehendo` package plus `@comprehendo/<pkg>` corpora repeat
the move for comprehension: zero package-owner buy-in required on day one,
the agent installs one thing, and the graduation path hands a maintainer a
tested corpus as the starter kit for going native. Wrapper number one pays
for itself with zero network effect, because twins and docs help human
developers and cut the tool's own support load; the standard is just what
the pattern is called once ten of them exist.

**Native beats sidecar, and only the consumer can override.** A package
that speaks natively gets twins at the throw site, the marker on its own
values, validate and explain inside the call path, and its corpus versioned
in its own artifact. The router defers to it, exactly as bundled types
supersede `@types/*`. A consumer may prefer the sidecar corpus per package
when a native corpus ships broken; a provider gets no veto in the other
direction, because the corpus about a package is the ecosystem's judgment,
not the package's.

**Security is a fence with a gate, fixed before scale.** Corpus text is
data, never instructions; a conforming `apply` can only be an invocation of
the provider itself, so a compromised corpus cannot smuggle a command. The
completeness contract ("if it is not documented here it does not exist")
carries its own escape hatch: an unanswerable query returns UNDOCUMENTED,
logs the miss locally, and explicitly permits source consultation for that
one question, because even the best instrumented build did two source
reads, exactly at coverage holes. Honesty about coverage is enforced shape,
not aspiration.

---

## Principles

1. **The fluent path is discoverable at the moment of failure.** The marker
   rides on values and exceptions, not only entry points; twins
   self-identify; an agent that never probed still learns from the error it
   just caught.
2. **Free until used.** Probing is side-effect free, requires no I/O, and
   costs zero context tokens until the agent asks. Nothing is advertised,
   loaded, or listed ahead of time.
3. **Corpus text is data, never instructions.** Fixes are schema-bound to
   the provider's own shipped call surface or are inert docs pointers;
   nothing a corpus says can widen what a provider can do.
4. **Honesty about coverage.** Unstructured errors pass through marked
   UNSTRUCTURED with the raw preserved; unanswerable queries return
   UNDOCUMENTED with did-you-mean and an explicit source pass. The fence
   has a gate, never a gap.
5. **No telemetry, ever.** The miss log is a local file. Nothing crosses
   the wire in either tier, and the core contains no network code at all.
6. **Topic-sized answers, held by a gate.** Index responses carry names
   only; topic responses carry one answer; the priming snippet fits 150
   tokens; all three are CI-measured.
7. **The folklore rule.** Every twin code and every fix is provoked by a
   real test in CI or it does not ship. Applies identically to native
   corpora and registry submissions.
8. **Native beats sidecar; overrides are consumer-side only.** The router's
   precedence is fixed; the five config knobs (prefer, pin, disable, require, local)
   belong to the consuming project; providers cannot veto community
   corpora.
9. **Fences and heals outrank runbooks.** Corpus authoring triages every
   known failure toward unexpressible or self-healed before settling for a
   twin with steps.
10. **Generated, never hand-rotted.** Corpora, translation tables, and
    COMPREHENDO.md are generated from tested truth with drift gates;
    hand-written docs left to rot are the disease this project treats, and
    it does not reintroduce them behind a nicer interface.
11. **One reflex, every ecosystem.** Field names and shapes are identical
    across languages; a twin serialized from Python and one from Node are
    indistinguishable; the conformance kit is language-neutral and ports
    pass it with zero fixture changes.
12. **The spec is the test suite.** Nothing is "supported" that the kit
    does not exercise; nothing is "designed" until it exists as a fixture
    that fails.
13. **No em dashes anywhere in the source or docs.** Comma or single
    hyphen.

---

## Tech Stack

**Reference implementation:** TypeScript, strict mode, no `any`. Node.js
LTS, ESM. The core has zero runtime dependencies; the absence of network
libraries is itself a CI scan (Principle 5).
**Python port (the spec validator):** Python 3.11+, `typing.Protocol` and
`TypedDict` for the shapes, zero runtime dependencies, same kit.
**Markers:** `Symbol.for('comprehendo')` and `__comprehendo__`, frozen
literals, never computed, scanned for exactness.
**Manifests:** the `comprehendo` key in package.json; `[tool.comprehendo]`
in pyproject.toml; provider-side declares `{version, level}`, consumer-side
carries the four knobs.
**Corpus format:** one topic per file, markdown body with a small YAML
header (topic, vocabularies served, see_also); twins and fixes as JSON
beside them; the whole corpus compiled to a single packed artifact at
publish so runtime never walks directories.
**Testing:** Vitest per package; pytest for the port; the conformance kit
as the shared fixture set; tiktoken-class tokenizers for the budget gates
(index size, topic size, priming size).
**Fingerprinting:** error-class names, message patterns, stack shapes,
compiled to a static index at registry build time; no runtime learning, no
heuristic drift.

**Code organisation:** one responsibility per file, max 400 lines, one
file per corpus topic. No secrets exist in this system at all; there is
nothing to configure and nothing to leak.

---

## Project Structure

```
comprehendo/                    monorepo root ("workspaces": ["packages/*"])
  MDs/                          this spec + comprehendo-spec.md (the RFC) + naming trail
  packages/
    spec/                       @comprehendo/spec
      protocol.md               the normative RFC-style document
      kit/
        shapes/                 JSON Schema per shape (twin, fix, topic, entry, ...)
        fixtures/               conformance fixtures (valid twins, probe transcripts)
        negative/               must-fail fixtures (raw error leaks, oversized topics,
                                schema-escaping fixes, telemetry attempts)
    core/                       comprehendo, the published npm package
      src/marker.ts             the symbol, attachment helpers, probe
      src/twin.ts               twin builder + UNSTRUCTURED wrapper
      src/docs.ts               docs engine: index, three-vocabulary lookup,
                                did-you-mean, UNDOCUMENTED
      src/router.ts             sidecar router: fingerprint match, precedence,
                                comprehend(raw), docs(pkg, query)
      src/config.ts             consumer config loader (prefer/pin/disable/local)
      src/sdk.ts                provider SDK entry: makeProvider(corpus, hooks)
      src/wrap.ts               opt-in proxy wrapper for un-adopted packages
      test/
    python/                     comprehendo, the published PyPI package
      comprehendo/              same layers, same names, __comprehendo__ idiom
      tests/
    registry-tools/             @comprehendo/registry-tools
      src/corpus-format.ts      parse, validate, pack
      src/gate.ts               the submission gate: folklore rule, budget gates,
                                fingerprint lint
      src/fingerprint.ts        static index builder
      src/publish.ts            @comprehendo/<pkg> scoped publisher
      test/
  corpora/                      registry corpora, one directory per package
    ffmpeg/                     the flagship: pitfall catalog, topics, fixtures
  COMPREHENDO.md                generated one-file summary, drift-gated
  scripts/                      one-off scripts, never imported by packages
```

Dependency direction is one-way: registry-tools -> (spec, core); core ->
spec; python -> spec (fixtures only, no code dependency); spec -> nothing
(it is data); corpora -> registry-tools at build time only. No package
imports from corpora. Existing starting material: `comprehendo-spec.md`
(the ratified RFC draft, v0.1), the Operator's fixes-and-docs design record
(`operatorfixesdocshowto.md`), the Operator itself as native reference
implementation number one, whose measured numbers (18/18 first-correction,
zero source reads outside coverage holes, 21 docs-interview lookups across
three blind builds) are the founding evidence, and `corpus-samples/`
(three worked corpora: openai-python for training-lag, zod for
fresh-migration, ffmpeg for cryptic-CLI), which seed the corpus file
format and the registry's first entries. Wave 1 converts the RFC's
shapes into executable kit fixtures and never restates them by hand.

---

## Build Order

Waves in build-dependency order. Each wave has a demo-state and is not done
until it is demonstrable. Features are tagged COMPONENT (C, code you
write) or SPEC (S, a behavior contract a COMPONENT satisfies). Estimates
assume one owner plus coding agents working spec-first against this
document; they are working days, not calendar promises.

**Wave 1, Spec freeze and the conformance kit (no implementation code).**
Demo-state: every shape in the RFC exists as a JSON Schema and at least one
fixture; every MUST in the RFC traces to a kit fixture or negative fixture;
the negative kit contains a raw-error leak, an oversized topic, a
schema-escaping fix, and a telemetry attempt, each failing for its stated
reason; the budget gates run and report (index, topic, priming). Estimate:
3-4 days.
- (C) shape-schemas: twin, fix, topic, index, entry, UNDOCUMENTED,
  UNVALIDATABLE, manifest keys, config knobs.
- (C) conformance-fixtures: probe transcripts (hit, miss, mid-failure
  discovery), twin round-trips, three-vocabulary docs lookups,
  did-you-mean, the UNDOCUMENTED source pass, the forward-compat
  fixture (a twin carrying unknown fields must be accepted, because
  fields are only ever added within a major), and the disagreement
  fixture (manifest says one thing, marker says another, marker wins).
- (C) negative-fixtures: every load-bearing-rule violation as a must-fail.
- (C) budget-harness: tokenizer counts wired as CI gates.
- (S) CC2 shape-identity; (S) CC5 context-budget (gates defined here,
  enforced from Wave 2 on).

**Wave 2, Core provider SDK (JavaScript).** Demo-state: a toy package
built with the SDK passes the full kit: marker on export, errors, and
handles; twins at the throw site; UNSTRUCTURED passthrough on an
un-cataloged error; docs answering all three vocabularies from a packed
corpus; UNDOCUMENTED with a working local miss log; validate and explain on
the toy's Level 2 surface; priming and identity under budget. Estimate:
4-6 days.
- (C) marker + probe; (C) twin-builder with fix validation (apply parses
  against the provider's declared call schema or the build fails);
  (C) docs-engine with packed-corpus loading, did-you-mean, and the
  local usage log (every lookup, hit or miss: hits show which topics
  earn their keep, misses are the next release's raw material, nothing
  is ever transmitted); (C) sdk-entry (`makeProvider`); (C) manifest
  wiring; (C) recorder (optional maintainer black box: every call, both
  directions, timestamps, local only).
- (C) corpus-generator: `comprehendo init` scaffolds the five-file
  corpus shape; `comprehendo scan` walks the target code and pre-fills
  everything a machine can know (exports and signatures from types,
  docstrings as DRAFT summaries, throw/raise sites as twin skeletons
  with exception types pre-filled in fingerprints, the topic index);
  `comprehendo diff` re-scans against a new version and reports drift,
  which IS the upstream-watch input. The dts-gen precedent: a blank
  directory is where contributions die. Constraints: machine-owned
  fields (signatures, inventories) regenerate freely; human-owned
  fields (reason, fixes, summaries, aliases) are never touched by a
  re-scan; every unfilled field is marked `status: stub` and the
  submission gate rejects corpora containing stubs, with the folklore
  rule as the backstop (a knowledge-free twin has no inducing test).
  The same tool serves `local` corpora for internal packages.
- (S) CC1 probe-purity; (S) CC3 no-raw-errors; (S) CC7 schema-bound-fixes.

**Wave 3, Python port.** Demo-state: the identical kit passes with zero
fixture changes; a twin serialized from Python is byte-identical to its
Node fixture; `hasattr(exc, "__comprehendo__")` is the working one-line
probe in a REPL demo. A fixture-change request from the port is a spec
bug: fix the spec first. Estimate: 3-5 days.
- (C) python-core: marker, twin, docs, SDK, manifest, same file layout.
- (S) CC2 shape-identity proven cross-language.

**Wave 4, The sidecar router.** Demo-state: with `@comprehendo/<toy>`
installed and the toy package NOT adopted, a caught raw error handed to
`comprehend(raw)` fingerprints to the right corpus and returns its twin;
an unknown error returns UNSTRUCTURED, never a wrong match;
`docs('<toy>', query)` answers; installing the native toy flips precedence
automatically; each config knob (prefer, pin, disable, require, local) demonstrably
changes routing, and `local` mounts a private corpus for an internal
package. Estimate: 4-6 days.
- (C) fingerprint-index + matcher (static, built at registry build time,
  precision-first: a wrong twin is worse than no twin, so ambiguous
  matches return UNSTRUCTURED with candidates named).
- (C) router + precedence; (C) config-loader; (C) wrap() opt-in proxy.
- (S) CC8 native-precedence; (S) CC10 honest-miss (ambiguity never
  guesses).

**Wave 5, Registry and the submission gate.** Demo-state: a corpus
submission with an untestable fix is rejected by CI naming the folklore
rule; a passing submission publishes as `@comprehendo/<pkg>` with its
fingerprint index built; the gate's checks run identically on the
Operator's native corpus, proving one discipline for both tiers.
Estimate: 3-4 days.

The submission channel is pull requests against
`comprehendo-protocol/registry`, one directory per package, never a web
portal: a PR supplies identity, review, per-fix history, and revert for
free, and the gate runs on the PR itself (the DefinitelyTyped shape).
CODEOWNERS per corpus directory, first author becomes owner and reviews
their package's PRs, a merge bot lands owner-approved green-CI PRs so
the core team is not the bottleneck, and merge triggers the scoped
publish. The trust ladder guards the human layer: a first-time corpus
for a high-adoption package requires core review, never bot-merge;
CODEOWNERS changes always require core approval; diffs touching
`fixes[].apply` get elevated review while docs-wording diffs may
bot-merge; and publishing happens only from CI on merged main with
provenance attestations, no human publish tokens, so a compromised
maintainer account cannot ship a corpus that never passed the gate
(CC11 holds the content layer; this ladder holds the people layer).

**Owner endorsement, the middle trust tier.** A package owner who will
not (yet) go native can bless the community corpus through the one
channel only the true owner controls, their own package manifest.
Two forms, owner's choice: `comprehendo: { corpus: "<sha256>" }` pins
exact corpus content (the strongest claim; release-coupled, since
changing it requires publishing the package) and
`comprehendo: { owners: ["github:name"] }` delegates identity, so the
named people's approvals count as owner review on that corpus with no
republish per update. The gate reads the manifest from the live
registry copy of the package on every corpus PR: matching content or an
authorized approver marks the corpus release ENDORSED. Endorsement is
additive trust, never a veto: a mismatch means the new corpus version
is simply unendorsed, the community tier keeps evolving (the §10.4
no-veto rule holds), and the consumer chooses what to demand via the
config knob `"require": { "<pkg>": "endorsed" }`. The full ladder:
community, endorsed, native. Nobody can claim to speak officially for
a package they cannot publish to; that is the attack this tier
deletes. Graduation is a PR replacing the directory with a deprecation
stub pointing at the now-native package. Demand ranking for missing
corpora comes from explicit registry issues with reactions, never from
collected miss logs, because telemetry does not exist (Principle 5);
the website (comprehendo.dev) browses the registry, serves the spec and
priming snippet, and renders the most-wanted list, and submits nothing.
- (C) corpus-format (parse, validate, pack); (C) submission-gate CI
  (folklore rule, budget gates, fingerprint lint, schema-bound fix
  check, docs-pointer integrity, and the loop lint: a topic whose
  operation has cataloged twins should show one in its examples, so
  errors point at docs and docs point back at errors); (C) scoped
  publisher.
- (S) CC11 registry-truth (the gate verifies every corpus claim against
  the real upstream package); (S) CC4 folklore-gate; (S) CC6
  no-telemetry (scan extended to corpora:
  a corpus containing network code is rejected).

**Wave 6, The flagship: ffmpeg.** Demo-state: the headline demo runs
end-to-end on camera: an agent given only the priming snippet is asked to
crop and transcode a video; its first wrong flag comes back through
`comprehend(stderr)` as a twin whose `fixes[0]` works; its vocabulary
questions ("the ImageMagick equivalent of X") answer through `docs`; the
measured session lands within the token budget; first-correction rate on
the scripted failure suite is published. Estimate: 5-7 days (corpus
authoring from the ffmpeg pitfall mine is the bulk).
- (C) ffmpeg-corpus: pitfall catalog mined from unanswered-thread corpora,
  triaged fence/heal/runbook, every fix induced against real ffmpeg in CI.
- (C) ffmpeg-fingerprints: stderr patterns for the cataloged failures.
- (C) upstream-watch: a lock file over the wrapped surface (the flags,
  behaviors, and stderr strings the corpus depends on), so an ffmpeg
  release that changes them fails the watch loudly instead of being
  silently absorbed; the generalized pattern every wrapper over a tool
  it does not own inherits.
- (S) CC4 proven on a real corpus at scale.

**Wave 7, Distribution.** Demo-state: `COMPREHENDO.md` generates from the
packed corpus and fails CI when stale; the priming snippet is published
and measured; the cold-agent benchmark passes at its target rate (an agent
given only the priming snippet completes the scripted task suite, zero
source reads outside UNDOCUMENTED grants, first-correction rate at or
above the Operator baseline); the Operator's graduation is documented as
the native-adoption walkthrough. Estimate: 3-4 days.
- (C) comprehendo-md-generator; (C) priming-finalized; (C) docs-as-tests
  (every code block in the docs executes in CI); (C) cold-agent-benchmark.
- (S) CC5 enforced as a release gate; (S) CC9 marker-freeze re-verified.

**Total estimate: 25-36 working days of focused build, roughly 5-7
calendar weeks single-threaded, compressible by parallelizing Waves 3-5
once Wave 2's kit pass is green.** The demo cut, enough to show a caught
error becoming a fix on the next attempt with the real SDK underneath
(Wave 1 partial, Wave 2 core, one toy corpus), is 6-8 working days. The
ffmpeg flagship is deliberately staged after the registry so the headline
demo exercises the whole pipeline, not a hand-wired special case.

---

## The Cross-Cutting Contracts

Eleven contracts, each enforced by a scan, test, or CI gate.

**CC1 Probe purity.** Probing the marker performs no I/O, mutates nothing,
and allocates only the entry. Scan greps marker modules for imports of fs,
net, http, dns, and child_process (there must be none in core at all);
test probes a provider ten thousand times and asserts identical results
and no observable side effects.

**CC2 Shape identity.** Every shape fixture round-trips byte-identically
through both implementations; field names are identical everywhere; a
port requesting a fixture change is a spec bug by definition. Test: the
kit runs in both CI matrices from the same fixture files.

**CC3 No raw primary errors.** A conforming provider never surfaces a raw
error as the primary message: kit fixtures assert twins on cataloged
failures and UNSTRUCTURED wrapping (raw preserved in `received`) on
induced novel failures. The negative kit's raw-leak fixture must fail.

**CC4 The folklore gate.** Every twin code and every fix in every corpus,
native or registry, is provoked by a real test in CI; the gate diffs the
catalog against induced coverage and rejects unprovoked entries by name.
A fix that stops being inducible after an upstream change is surfaced as
a drift failure, never silently retained.

**CC5 Context budget.** Index responses, topic responses, and the priming
snippet are tokenizer-measured in CI against fixed budgets (priming: 150
tokens; topic and index budgets set in Wave 1 and only ratcheted down).
A corpus with an oversized topic does not publish.

**CC6 No telemetry.** The core packages contain no network code (scan);
corpora containing network code are rejected at the gate; an integration
test runs the full surface under a network-denying sandbox and everything
passes, because nothing ever needed the network.

**CC7 Schema-bound fixes.** Every `apply` in every corpus parses against
the provider's declared call schema at gate time; a fix that would
express an operation the provider does not define is rejected. `docs`
pointers are checked against the corpus index so a fix can never point at
a topic that does not exist.

**CC8 Native precedence.** With both a native implementation and a
registry corpus present for the same package, the router provably defers
to native; the consumer `prefer` knob provably reverses it per package;
no provider-side mechanism can suppress a registry corpus (scan: the
provider manifest schema contains no such field).

**CC9 Marker freeze.** `Symbol.for('comprehendo')` and `__comprehendo__`
appear as frozen literals exactly once per implementation, never
computed, never aliased; the manifest keys likewise. Scan plus a
grep-level lint in both repos.

**CC10 Honest miss.** Ambiguous fingerprint matches return UNSTRUCTURED
with candidates named, never a best guess; unknown docs queries return
UNDOCUMENTED with did-you-mean, never an empty result or a wrong topic.
Property test: mutated error messages must degrade to honest misses, not
wrong twins.

**CC11 Registry truth.** A corpus is a set of falsifiable claims about a
real package, and the gate verifies them against reality: CI installs
the actual target package from its actual registry, induces every
cataloged failure, and asserts the twin matches and the fix resolves it;
a fingerprint the real package cannot be induced to produce is rejected,
so routing cannot be hijacked by claiming another package's error
patterns; a corpus directory must exact-match a package that exists on
the target registry, so typosquat directories cannot land. On top of
truth, two lints: the danger lint (an `apply` payload invoking
destructive operations for its tool class requires explicit
justification and elevated review) and the injection lint
(instruction-shaped content in `reason`, summaries, or docs prose is
rejected; corpus text is about the tool, never addressed to the agent).

---

## The Protocol Surface (normative shapes live in the RFC; this is the map)

| Surface | Form | Tier |
|---|---|---|
| twinned errors | thrown/raised, `err.twin`, marker on the error | native, unconditional |
| `comprehend(raw)` | error object or stderr text in, twin or UNSTRUCTURED out, side-effect free | sidecar workhorse; native optional |
| `docs(query?)` | no arg: index (names only); query: one topic, three vocabularies, did-you-mean, UNDOCUMENTED gate | both tiers |
| `validate(input)` | judge without executing; `{valid: true}`, twin, or UNVALIDATABLE | native Level 2 |
| `explain(input)` | the literal would-execute form plus notes | native Level 2 |
| identity + priming | what the tool is, the completeness contract, the pointer; priming under 150 tokens | both tiers |

The twin: `{ comprehendo, code, reason, path?, namespace?, declared?,
received?, accepts?, fixes[] }`. The fix: `{ title, apply? (schema-bound),
docs? (corpus topic), confidence? }`, at least one of apply or docs,
ordered most-likely-first. Conformance levels: Level 1 is twins plus docs
plus identity; Level 2 adds validate and explain; a provider that cannot
judge without executing MUST omit validate rather than fake it. Discovery:
the marker on the root export, every raised error, and controlled handles;
the manifest declaration for static discovery; `COMPREHENDO.md` at the
package root for file-browsing discovery; and the twin's own `comprehendo`
field for mid-failure discovery. Full field semantics, requirement
language, and ecosystem bindings live in `comprehendo-spec.md` (the RFC);
that document is normative and this one never restates it in conflict.

---

## Testing Strategy

**The conformance kit (the frozen contract).** Language-neutral fixtures,
snapshot-locked; any fixture change is a breaking change and is rejected.
The kit doubles as the golden example set for docs and for
COMPREHENDO.md: tests, docs, and agent context are one artifact.

**The negative kit.** Every load-bearing-rule violation as a must-fail:
raw error leaks, oversized topics, schema-escaping fixes, telemetry
attempts, provider-side corpus vetoes, computed markers. CI fails if any
negative fixture passes its gate.

**Cross-language parity.** Both implementations run the identical kit
from the identical files; byte-identical serialized shapes (CC2); the
Python port's pass with zero fixture changes is the Wave 3 exit gate and
the precondition for any further ecosystem.

**Fix efficacy.** Every corpus fix induced and replayed in CI (CC4):
break the input, catch the twin, apply `fixes[0]`, assert success on the
retry. The ffmpeg corpus runs this against real ffmpeg in a container.

**Fingerprint precision.** Property tests mutate cataloged error messages
and assert honest degradation (CC10); a corpus update that would create a
cross-package fingerprint collision fails the registry build.

**Budget gates.** Tokenizer-measured index, topic, and priming sizes per
corpus per release (CC5).

**The cold-agent benchmark.** An agent given only the priming snippet
completes the scripted task suite against wrapped tools: measured
first-correction rate (target: the Operator's 100% baseline on structured
cycles), zero source reads outside UNDOCUMENTED grants, session token
cost published. This is the number the whole project claims; it is
measured continuously, never asserted.

---

## Success Criteria

1. Root test run: all packages green, all CC scans pass, the negative kit
   fully failing, both budget gates holding.
2. The conformance kit passes 100% in TypeScript on Node, and the Python
   port passes it with zero fixture changes and byte-identical shapes.
3. A toy package built with the provider SDK reaches Level 2 conformance
   in under one working day, documented as the native-adoption
   walkthrough.
4. The sidecar router, with no cooperation from the target package,
   returns a correct twin for every cataloged ffmpeg failure and an
   honest UNSTRUCTURED for novel ones; precedence flips automatically
   when a native implementation appears.
5. The submission gate rejects folklore, oversized topics, schema-escaping
   fixes, and network-touching corpora, each with the violation named.
6. The ffmpeg demo runs end-to-end: priming snippet in, wrong flag,
   `comprehend(stderr)`, `fixes[0]`, success on the retry, on camera, no
   hand-wiring.
7. The cold-agent benchmark publishes first-correction rate at or above
   the Operator baseline with session token cost within budget.
8. Nothing in the system can transmit: the full surface passes under a
   network-denying sandbox.
9. `COMPREHENDO.md` generates from the corpus, drift-gated, and every doc
   code block executes in CI.
10. The Operator adopts the shipped SDK as native reference
    implementation number one with its corpus passing the same gate as
    community submissions.

---

## Notes and Constraints

- Names are held: `comprehendo` and the `@comprehendo` org on npm,
  `comprehendo` on PyPI, `comprehendo` on RubyGems (placeholder 0.0.1,
  2026-08-21), comprehendo.dev, and the `comprehendo-protocol` GitHub
  org. Go needs no reservation: `comprehendo.dev/go` is the module path
  and the domain covers it. Outstanding: the crates.io stub
  (publish-to-hold), a NuGet stub if .NET is targeted, and
  comprehendo.org as a defensive redirect. comprehendo.com was taken.
- The naming record: "askable" was the property-word candidate, dropped as
  a brand because Askable is a funded user-research company; "explico"
  dropped for the Xplico collision; "instructo" for an existing AI product
  and weak Latin. The pronunciation asset is real (the comprende joke
  pre-installs saying and spelling) and the name is first-person Latin for
  "I understand," which is the product in one word.
- The surface formerly called `interpret` is `comprehend`; twinned errors
  are not a listed surface but the meaning of conformance itself. The RFC
  (comprehendo-spec.md v0.1 draft) is the normative companion; where this
  document and the RFC disagree, the RFC wins and this document has a bug.
- The remote refresh layer (`comprehendo.json`, security fence: off by
  default, opt-in, signed, text-only, no new fix shapes) stays reserved
  and unbuilt; registry versioning is expected to obsolete it. Revisit
  only on evidence that release cadence is too slow for corpus fixes.
- The Operator relationship: native reference implementation number one;
  its measured numbers are the founding evidence and its corpus passes the
  same submission gate as community corpora (one discipline, two tiers).
  Strategy note: the standard makes the Operator more valuable, not less;
  the driver that invented the contract and implements it deepest is the
  flagship.
- Ecosystem markers are reserved by convention for future bindings: an
  interface in Go and C#/.NET, a trait in Rust, an annotation in Java.
  None begins before the Wave 3 zero-fixture-change gate, and each new
  binding's first deliverable is passing the kit, not new features.
- The third binding MUST be a static language (.NET or Go), by design,
  not popularity: Python validates shape portability but, being dynamic
  like JS, never stresses the static-language questions. In .NET the
  marker becomes `obj is IComprehendo` (the IDisposable reflex), the
  interface ships in a zero-dependency `Comprehendo.Abstractions`
  package (the Logging.Abstractions precedent), static discovery becomes
  an embedded well-known resource because .nuspec takes no custom
  fields, and shapes serialize through explicit JSON property names so
  fixture identity is enforced. In Go the marker probe is
  `errors.As(err, &c)`, never a bare type assertion, because Go wraps
  errors and a bare assertion would miss a twinned error inside a
  wrapper; the corpus rides `go:embed`. Whichever goes third forces
  the spec's per-ecosystem binding pattern to generalize while changes
  are cheap; the other follows it using the pattern it produced.
- Ruby is the cheapest dynamic port and may precede the static third:
  the probe is `err.respond_to?(:__comprehendo__)` (the `respond_to?`
  reflex, no shared dependency), shapes are string-keyed hashes matching
  the fixtures, the corpus ships in the gem, and the manifest
  declaration rides the gemspec's built-in free-form `metadata` hash,
  the best manifest story of any ecosystem.
- Bun and Deno are runtimes, not bindings: the JS implementation runs
  unchanged. Bun joins the CI matrix when the runtime layer lands and a
  Bun-only kit failure is a release blocker; Deno enters the matrix when
  the kit passes on it and is documented as supported only after that.
- Versioning discipline (from the RFC's §11, restated because it binds
  the build): the spec is semver'd; within a major, fields are only ever
  added, never removed or re-typed; agents and implementations MUST
  ignore fields they do not recognize (the Wave 1 forward-compat fixture
  enforces this); twin `code` vocabularies belong to providers, and a
  published code never changes meaning.
- Trademark: a small Austrian firm (Comprehendo e.U.) exists in an
  unrelated class; run a proper trademark search before the public
  announcement, not before building.
- Open questions to close in Wave 1: the packed-corpus binary format and
  its versioning; fingerprint index format and collision policy across
  registry corpora; whether `wrap()` ships in the first release or waits
  for evidence; the exact topic and index token budgets; the
  submission-gate policy for corpora targeting packages with hostile or
  rapidly-moving error surfaces (the upstream-watch lockfile from the
  Operator generalizes, but its cadence is unproven outside a driver);
  the `apply` grammar (the samples surfaced two forms: literal code and
  `template` with placeholders bound from fingerprint capture groups;
  Wave 1 rules on the slot-binding syntax and its safety constraints);
  and the `static-pattern` fingerprint kind (matching source rather
  than runtime errors, surfaced by the zod sample; Wave 1 rules on who
  runs static matching and when: wrap(), a lint integration, or both).
