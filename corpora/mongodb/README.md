# `@comprehendo/mongodb`

A sidecar corpus for the **native `mongodb` npm driver** (never Mongoose), in
Corpus Format [28]'s authoring shape, the same five-file layout
`corpora/openai-python/`, `corpora/zod/`, and `corpora/mcp-oauth/` all use.

## Smoke test

The flagship finding, real and live: five documents inserted, four
`status: "archived"` and one `status: "active"`. A filter that reads like
"find the active one":

```
{ status: { $ne: "active" } }
```

really matches, and a real `deleteMany` with that filter really deletes, the
FOUR archived documents, not the one it looks like it targets:

```
CLAIM negated-delete: total docs = 5 , the negated filter matches 4
  real deleteMany(negated filter) deleted 4 of 5 docs
```

No error, no warning, exit 0. A filter shaped like a narrow, safe cleanup is
a 4-out-of-5 wipe.

## Every entry was induced, none was remembered

`packages/registry-tools/test/mongodb-corpus.test.ts` spawns a real, disposable
`mongo:7` server in Docker (`test/helpers/mongo-server.ts`, real start, real
teardown, no host install assumed) and runs the real, installed `mongodb`
driver against it. `runtime-error` twins are real errors, really thrown and
caught (`test/helpers/mongodb-witnesses.ts`); `static-pattern` twins have no
throw to catch by definition, their evidence is a real, live-verified claim
against the same real server instead, checked fresh every run, not asserted
from memory or from this project's own `.claude/rules/mongodb-rules.md` (the
real, hard-won production rules this corpus generalizes from, and the reason
every claim here is independently re-verified rather than merely trusted).

Induced against `mongodb@7.5.0`, `target.versions` declares `>=6 <8`: the
three sharpest claims (code 66, invalid `ObjectId` format, string `_id`
matching nothing) confirmed identical, same real error text, on both
`6.21.0` and `7.5.0` before this range was declared.

## Fingerprints are real text and real code shape, not error classes

`runtime-error` twins declare a `message_pattern` and no `exception`, the
same reasoning every prior corpus's README gives: an agent reading a thrown
error has text, not a live class reference. `static-pattern` twins (the
`MONGODB_NEGATED_DELETE_FILTER` twin here) match literal SOURCE TEXT, never
a caught error, because the underlying mistake never throws at all, it just
does something worse than the code intended, silently.

## Every fix here is a runbook, and that is not a shortcut

None of the four twins here have a schema-bound `apply`. Three (the `_id`
type mismatch, the invalid `ObjectId` format, the duplicate key) are real,
multi-step source edits (strip `_id` from a write body, validate before
constructing, catch and answer a real conflict) that a flat `{operation:
args}` call cannot express safely. The fourth, the negated delete filter, is
never a callable fix on principle: a corpus `apply` that could actually
perform a real deletion is exactly the class of danger this project's own
CC11 danger-lint gate exists to catch, so this fix is deliberately inert, a
docs pointer to naming what to delete and counting first, never anything
that could fire for real.

## Not covered here, on purpose

Two real, silent findings from live testing (a string `_id` matching nothing
against a stored `ObjectId`; `{field: null}` matching both an explicit
`null` AND an absent field) are documented in `objectid-identity` and
`null-missing-and-query-shape` as prose, without a fingerprint twin. Neither
has a textual signature precise enough to match without false-positiving on
ordinary, correct code (the mismatch is a runtime TYPE difference invisible
in source text, not a distinctive call shape the way `.deepPartial()` or a
negated delete filter are), so cataloging either as a twin would trade
fingerprint precision for coverage this project's own conventions refuse.
Fingerprint precision over recall: ambiguity here would mean UNSTRUCTURED,
never a wrong guess, so the honest choice is a documented topic with no
twin, not a twin that cannot tell real bad code from real good code apart.

An unanchored-regex-forces-a-full-scan finding was verified live (real
`explain('executionStats')` output, tight index bounds for `/^prefix/`
versus full-range bounds for `/prefix/`) and is documented in
`indexing-and-scan-performance`, same reasoning: no textual signature can
express "this regex has no leading `^`" as a positive glob match without
also matching every correctly-anchored regex right alongside it.
