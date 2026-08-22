# Budget harness (CC5 context budget)

Real tiktoken-class token counts, wired as a CI gate. A scope over budget is a
red build, never a warning.

## The numbers (set in Wave 1, ratchet down only)

| Scope | Budget | Wave-1 baseline | What was measured |
|---|---|---|---|
| `index` | 1200 | 914 | `fixtures/index.baseline.json`, 214 topic names, the reference corpus scale the source spec states |
| `topic` | 600 | 383 | `fixtures/topic.baseline.json`, one worked topic with summary, signatures, three examples, `see_also` |
| `priming` | 150 | 127 | `fixtures/priming.reference.md`, the RFC section 5.5 reference snippet |

`priming` is CC5's hard cap and is not derived from anything; the other two were
set here, from those measurements, and every later wave uses them as a fixed
ceiling. `assertRatchet` in `budgets.js` rejects any change that would raise a
budget, drop a scope, or push `priming` past 150.

The budgets are not free-hand: `budgets.test.js` asserts every limit sits
between its baseline and twice its baseline, and `measure.test.js` re-measures
the fixtures on every run and goes red if the recorded baselines drift.

## How it is measured

Counts come from `js-tiktoken` (a dev dependency; this package still ships zero
runtime dependencies). There is no word-count or character-count proxy anywhere
in the harness: on the index fixture a word count is off by 5x and `chars / 4`
by 15%, and a "150 tokens" claim has to mean what an agent's own context
accounting means.

Every payload is measured under **both** declared encodings (`o200k_base` and
`cl100k_base`) and the **larger** count is reported, so a budget holds in either
accounting. The record names the encoding that produced the number.

A response object is measured as its compact serialized payload, which is what
actually crosses into an agent's context. A text artifact is measured as its own
trimmed text.

## Running it

```
node kit/budget/run.js                                 # measure the kit baselines
node kit/budget/run.js --json                          # the same, as budget records
node kit/budget/run.js --scope topic --file topic.json # measure one real artifact
npm run budget                                         # the package script
comprehendo-budget                                     # the installed bin
```

Exit codes: `0` every scope under budget, `1` at least one scope over budget,
`2` a usage error (unknown scope, missing artifact). stdout carries the report,
stderr carries the reason a build failed, so `--json` output stays parseable in
every case.

A budget record is `{ scope, limit, measured, pass, encoding }`.

## Where the harness gets pointed next

Wave 1 measures this directory's own fixtures, which is what set the numbers.
`--scope <scope> --file <path>` is the seam every later wave uses:

- Wave 2 onward: Docs Engine [13] topic and index responses.
- Wave 5: Submission Gate [29] corpus topics, per corpus.
- Wave 7: the published Priming Snippet [36], as a release gate.
