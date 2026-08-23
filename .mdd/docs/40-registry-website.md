---
id: 40-registry-website
title: Registry Website
type: COMPONENT
path: Distribution / Registry Website
source_files: [site/build.ts, site/src/registry.ts, site/src/pages.ts, site/src/render.ts, site/src/read-only.ts, site/src/github.ts, site/src/most-wanted.ts]
status: planned
phase: idle
last_synced: 2026-08-23
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [28-corpus-format, 29-submission-gate, 36-priming-snippet]
tags: [comprehendo-dev, registry-browser, most-wanted-list, read-only, no-submission-portal]
test_files: [site/test/registry-listing.test.ts, site/test/most-wanted.test.ts, site/test/github-live.test.ts, site/test/read-only.test.ts, site/test/build-cli.test.ts, site/test/support.ts, packages/registry-tools/test/registry-website-trust.test.ts]
known_issues:
  - "[gap] `comprehendo-protocol/registry` does not exist as a repository, so the most-wanted list's real target answers 404 and the site renders the honest UNAVAILABLE state rather than an empty ranking. The MECHANISM is proven live against repositories that do exist: `comprehendo-protocol/comprehendo` (real 200, honestly empty) and `nodejs/node` (real ranking over real reaction counts, pull requests excluded). The day the registry repository is created, `github-live.test.ts`'s first case goes red, which is the correct signal that this entry is stale. Same boundary [29] and [31] already drew."
  - "[gap] The RFC this site serves (`MDs/comprehendo-spec.md`, which CLAUDE.md names as the normative companion) is NOT tracked in this repository: it exists only in a working checkout. A clean clone therefore cannot build the spec page, and the generator REFUSES with exit 2 naming the file rather than shipping a spec-less site. Proven live against the real 957-line RFC: `site/dist/spec.md` came back byte-identical to it. Committing the document is a repository-level decision outside this feature's files, and it carries 83 em dashes, which this project's own rule forbids in tracked source and docs; whoever commits it owns that conflict."
  - "[gap] No submission-gate ruling exists on disk for `corpora/ffmpeg/`, so a default build lists it at `community`, unpublished, naming the reason. That is what is true of it. `--rulings DIR` is the seam a real registry's CI ruling arrives through, and it is proven live with a REAL all-pass `runSubmissionGate` result (real ffmpeg induction, real CC5 budget meter): the site renders `data-published=\"true\"`, and the same ruling with `registryTruth` doctored to `not-run` renders unpublished naming `verifyAgainstUpstream`."
  - "[deferred] The generated site is never committed (`site/.gitignore`), so there is no drift gate of the shape COMPREHENDO.md Generator [35] ships. The most-wanted list is read live, so two builds of the same commit legitimately differ and a committed copy would be drift by design. The suites are the gate instead."
  - "[gap] `site/test/github-live.test.ts` needs outbound network to api.github.com and fails loudly without it, the same way `requireFfmpeg` fails loudly on a missing binary. Unauthenticated GitHub allows 60 requests an hour and one full run spends four; a job running it often should set `GITHUB_TOKEN`, which the client already reads and the site never requires."
  - "[gap] The rendered contrast gate (Playwright plus axe) is NOT run for this site. What is run instead is a WCAG ratio computed from `render.ts`'s own palette in both colour schemes, which is honest here for one specific reason: this site imports no third-party stylesheet, so every rendered colour really is in this repository's source. It is not a rendered check and it would not catch a vendor stylesheet, so the day one is added this becomes insufficient and the accessibility rule's gate is owed."
  - "[deferred] The most-wanted read is a single page of up to 100 open issues, unpaginated, so a backlog larger than that would be ranked over a prefix. Deliberate while the target repository has zero issues; pagination belongs with the first real backlog rather than with a repository that does not exist."
  - "[gap] The read-only audit's pattern table is a FLOOR, not a proof, in exactly the sense Submission Gate [29]'s danger and injection tables are. What makes it worth having is that this generator emits a fixed set of pages from pure functions, so anything the table matches is a change somebody made deliberately."
  - "[gap] Nothing here publishes the built directory. There is no Pages workflow, no CNAME and no hosting configuration for comprehendo.dev: Registry Reservations [39] holds the name, and where `site/dist/` gets served from is a deployment decision this repository has not made. Same split [29] drew for the CI job and [31] drew for the publish token."
  - "[gap] `site/` is typechecked against its own tsconfig but not linted: the repository's only eslint configuration lives in `packages/registry-tools`, and `scripts/` is in the same position. Whichever feature gives the repository a root lint configuration picks both up."
  - "[deferred] `site/package.json`, `site/tsconfig.json` and `site/.gitignore` are written by this feature and deliberately NOT listed in `source_files`, following the precedent COMPREHENDO.md Generator [35] set with `scripts/package.json` and `scripts/tsconfig.json`: the field records the code the feature owns, and the drift sentinel has nothing useful to say about a three-line ignore file."
satisfies_contracts:
  - from: 29-submission-gate
    function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    status: done
    verified_at: "packages/registry-tools/test/registry-website-trust.test.ts::refuses published and every rung above community when verifyAgainstUpstream never ran"
---

# Registry Website

## What to Build

`comprehendo.dev`: browses the registry, serves the spec and the priming
snippet, and renders the most-wanted list (demand ranking for missing
corpora, sourced from explicit registry issues with reactions, never from
collected miss logs, because telemetry does not exist, CC6 [27]). Submits
nothing. Must-not: this is explicitly not a submission portal, the
submission channel is pull requests against `comprehendo-protocol/registry`
(Submission Gate [29]), never a web form; the site never collects or
transmits anything from its visitors.

## Architecture

A static site generator, zero runtime dependencies, in `site/`. It reads
the registry corpora through Corpus Format [28]'s real `parse` and `pack`,
the two documents it serves off disk, and one public issue tracker over
HTTPS at BUILD time, and it writes six files. There is no server, no
script in any page, and no state anywhere.

| Module | Job |
|---|---|
| `build.ts` | the CLI: argv, disk, the one network read, the exit codes, and the refusal to write |
| `src/registry.ts` | what the site is ALLOWED to say about a corpus: the trust tier and the published badge, both gated on [29]'s ruling |
| `src/pages.ts` | the whole site as files, pure: a model in, exact bytes out |
| `src/render.ts` | the page shell, the escape function, and the one inline stylesheet (the only colours this site renders) |
| `src/read-only.ts` | the structural proof that nothing on the site accepts a write |
| `src/github.ts` | the real GitHub issues read, projected and never trusted |
| `src/most-wanted.ts` | reactions into a ranking, pure |

Beside them, and deliberately not in `source_files` (see Known Issues):
`site/package.json` (so node reads `site/*.ts` as ES modules and
`node --test` finds the suites), `site/tsconfig.json`, and
`site/.gitignore` (the built site is never committed).

The generator imports the BUILT modules of `packages/registry-tools`, not
its sources, for the reason COMPREHENDO.md Generator [35] recorded: node's
type stripping does not remap a `./foo.js` specifier onto `foo.ts`, so a
standalone script cannot load that `src/` tree at all. `requireFreshDist`
in the suites refuses to run against a `dist/` older than its `src/`.

Nothing in `packages/` imports anything in `site/`. That is what keeps the
one network module in this repository outside the reach of CC6 [27]'s
structural scan, which covers `packages/core/src` and
`packages/registry-tools/src` and must keep covering them.

## Implementation Notes

- The most-wanted list is sourced from GitHub issue reactions on
  `comprehendo-protocol/registry`, not from any telemetry or miss-log
  aggregation; CC6 [27]'s no-telemetry guarantee extends to this site by
  construction (it has nothing to collect from visitors, only public
  GitHub data to read). The distinction that makes this consistent: a
  generator on a build machine reading a public issue tracker is not a
  visitor being measured. The published pages carry no script, no cookie,
  no beacon and no remote subresource, which is checked structurally.
- "Submits nothing" is the load-bearing constraint distinguishing this
  from a submission portal: every corpus submission still goes through
  the PR channel (Submission Gate [29]), this site is read-only. The
  audit in `read-only.ts` runs INSIDE the generator over every byte it is
  about to write, so a site carrying a write surface is never written.
- A served document is emitted twice, and the two are different promises.
  The `.md` copy is the document byte for byte. The `.html` page is a view
  of it: the same text, escaped, inside one `pre` block, so a document can
  be read in a browser without ever being interpreted as markup. The audit
  checks the escaping rather than trusting it, and reports a raw `<` inside
  a `pre` as `unescaped-document`.
- Three outcomes for the most-wanted read, never two: a ranking, an
  honestly empty list, or `unavailable` carrying the reason. Collapsing
  the last two would let a 404 render as "nobody has asked for anything",
  which is the same mistake `not-run` exists to prevent in [29].

## Data Model

Rendered from: the registry listing (per corpus: package, provider, target
version, topic menu, cataloged failure and fix counts, trust tier,
published or not, and why), the spec document, the priming snippet text,
and the most-wanted list (issue number, title, url, thumbs-up count, total
reactions, rank).

The listing's ruling input is `{gate: GateResult, manifest?, approvers?}`,
one per corpus directory, which is what a real registry's CI produces and
what `--rulings DIR` reads as `<directory>.json`.

## API/Interface

Not an agent-callable primitive; this is a human-facing website. Its one
entry surface is the generator command:

```
node site/build.ts [--out DIR] [--corpora DIR] [--spec FILE] [--priming FILE]
                   [--rulings DIR] [--most-wanted-repo OWNER/NAME]
                   [--most-wanted-label LABEL] [--offline]
```

Exit codes are the contract, the vocabulary [17] and [35] already
established: `0` the site was written, `2` a precondition the caller can
fix (a document that is not there, a corpus that does not pack, a
repository name that is not `owner/name`), `3` the read-only audit found a
write surface so nothing was written, `70` a bug in this tool, with its
stack.

## Business Rules

- Read-only: no form on the site accepts a corpus submission or any other
  write. Structural, not a calling convention: the generator audits its
  own output and refuses to write.
- The most-wanted list ranks by registry-issue reactions, never by
  collected query or miss-log data. A pull request is a submission, not a
  request, and a closed issue is not open demand; both are dropped.
- The site never transmits visitor data anywhere. The published pages
  carry no script, no cookie, no beacon and no remote subresource.
- No trust tier is invented. A corpus with no gate ruling is listed at
  `community`, unpublished, with the reason stated. Where a verified
  corpus stands is Owner Endorsement [30]'s `computeEndorsement`'s answer,
  never this site's.
- Nothing is rendered as published, endorsed or native unless the gate
  ruling being rendered really carries `registryTruth` and `folklore` as
  `pass`, read off the check outcomes directly rather than off the
  `publishable` flag beside them. See the contract note below.

### The `verifyAgainstUpstream` contract, satisfied transitively

Submission Gate [29] declares `verifyAgainstUpstream` mandatory before a
corpus is marked publishable. A website induces nothing and publishes
nothing, so it never calls that function. What it does do is make a PUBLIC
TRUST CLAIM about a corpus somebody else's CI judged, and that is where
the contract bites: rendering "published, endorsed" beside a corpus nobody
ever ran against the real package would launder an unverified corpus into
a badge on comprehendo.dev, which is exactly the threat CC11 [25] names.

So the contract is satisfied the same way Owner Endorsement [30] satisfies
it: no rung above `community` and no published badge is reachable unless
the ruling really carries [31]'s two `UPSTREAM_CHECKS` as `pass`, read off
the checks rather than off the summary flag, using [31]'s own constant
rather than a second copy of the list. Both branches are tested against
REAL gate runs over the real ffmpeg corpus, and a ruling claiming
`pass: true, publishable: true` beside `registryTruth: not-run` buys
nothing, live and in the suite.

## Acceptance Criteria

- [x] The site renders the current registry contents (packages, corpus
      trust tier: community/endorsed/native). Live, through the real CLI
      over the real `corpora/ffmpeg/`: `ffmpeg`, `@comprehendo/ffmpeg`,
      target 4.4.2, 7 topics, 12 cataloged failures, 15 fixes, and
      `data-trust="community" data-published="false"` with the reason
      rendered beside it. With a REAL all-pass gate ruling supplied
      through `--rulings` (real ffmpeg induction plus the real CC5 meter),
      the same page renders `data-published="true"` and takes the tier
      from `computeEndorsement`.
- [x] The site serves the spec document and the priming snippet. Live:
      `cmp site/dist/spec.md MDs/comprehendo-spec.md` and
      `cmp site/dist/priming.md packages/spec/priming.md` both report no
      difference, over the real 957-line RFC and the real 144-token
      snippet. `build-cli.test.ts` re-proves byte identity every run, plus
      a document carrying CRLF, unicode and raw markup, and decodes the
      rendered `pre` back to the source exactly.
- [x] The most-wanted list renders from registry-issue reactions. Real
      HTTPS calls, nothing recorded or replayed: the real target
      (`comprehendo-protocol/registry`) answers 404 and renders as
      UNAVAILABLE naming the reason; `comprehendo-protocol/comprehendo`
      answers 200 with no corpus requests and renders as honestly empty;
      `nodejs/node` answers 200 with a real backlog and ranks by real
      reaction counts with pull requests excluded.
- [x] No form or endpoint on the site accepts a corpus submission.
      Structural: `auditReadOnly` runs inside the generator over every
      byte before anything is written, and the real built site reports
      `read-only audit: 6 files, 0 write surfaces`. Verified to have
      teeth: each of the ten rules is caught by name in a mutation case,
      and breaking the escape function turns the audit red at the CLI so
      the build writes nothing at all.

## Dependencies

- [28-corpus-format](28-corpus-format.md)
- [29-submission-gate](29-submission-gate.md)
- [36-priming-snippet](36-priming-snippet.md)

## Known Issues

Recorded in the frontmatter; every entry is a decision with its why, or a
gap nobody has decided anything about yet. The three worth reading first:
the registry repository does not exist, so the most-wanted list's real
target 404s and the mechanism is proven against repositories that do; the
RFC this site serves is not tracked in this repository, so a clean clone
cannot build the spec page and the generator refuses rather than shipping
without it; and nothing here publishes the built directory anywhere.
