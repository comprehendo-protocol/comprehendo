# `@comprehendo/ffmpeg`

The flagship registry corpus: a sidecar corpus for the **ffmpeg command-line
program**, in Corpus Format [28]'s authoring shape (`corpus_authoring: 1`).

Five files, nothing else is read by `parse`:

| File | What it carries |
|---|---|
| `manifest.json` | provider and target identity, and the declared call schema |
| `index.json` | the topic menu, in menu order |
| `topics/<slug>.md` | one topic per file: YAML header plus the answer |
| `twins.json` | one record per cataloged failure, with its fingerprint |
| `fixes.json` | the fixes, keyed by twin id, most likely first |

## Every entry was induced, none was remembered

ffmpeg's wording varies by version and by build flags, so an error text nobody
watched a real binary produce is folklore (CC4 [26]). Every `message_pattern`
in `twins.json` was quoted from stderr that the really-installed binary really
wrote, and every fix carrying an `apply` was proved by applying it to the same
failing argument vector and watching the retry exit 0.

The induction is not a claim this corpus makes about itself. It is a suite:

- `packages/registry-tools/test/ffmpeg-induction.test.ts` spawns the real
  binary once per cataloged entry and routes its real stderr through the real
  fingerprint matcher;
- `packages/registry-tools/test/ffmpeg-corpus.test.ts` hands what those runs
  observed to Submission Gate [29]'s real `runSubmissionGate`, which is the
  same gate a community corpus passes, with no tier parameter to special-case
  on;
- `packages/registry-tools/test/helpers/ffmpeg-witnesses.ts` holds the inducing
  invocation for each entry, quoted alongside a literal fragment of the stderr
  the run produced. Every source is synthetic (`-f lavfi -i testsrc=...`), so a
  reproduction needs no external media and is deterministic.

Induced against `ffmpeg version 4.4.2-0ubuntu0.22.04.1` (libavcodec
58.134.100, libx264 enabled). A binary whose wording has moved makes the suite
red, which is the drift signal, not a nuisance.

## Fingerprints are stderr patterns, not error classes

A CLI target hands an agent text, not a thrown object. The matcher reads a bare
string as the message with no error class, so every entry here declares a
`message_pattern` and deliberately no `exception`: an entry declaring an error
class would reject every real match. Patterns are anchored literals with `*` as
the only metacharacter, never regular expressions, because corpus text is data.

## What an `apply` means on a command line

`declared_schema.surface` is `ffmpeg` and its `operations` are ffmpeg's own
option names, so an `apply` is literal call data shaped exactly like the call
surface it is for:

```json
{ "-vf": "scale=-2:720" }
{ "-map": ["0:v", "0:a?"] }
```

A string operand means the option occurs once carrying that operand; an array
operand means the option's occurrences are exactly those, in order (`-map` is
repeatable, so "replace the operand" would be ambiguous). CC7 [09]'s check is
that every top-level key is an operation the schema declares, which is what
stops a corpus naming an option the provider never shipped.

The operand itself is ordinary text, and that is safe for exactly one reason:
an applier passes operands as **argv elements and never through a shell**, so
a metacharacter in an operand is a character, not a command. An applier that
concatenates a command string would void that, which is why the corpus is not
the only half of this contract.

## Disposition: fence, heal, runbook

Fences and heals outrank runbooks, so each entry was asked, in order, whether
the mistake can be made unexpressible, then whether it can be corrected
silently and safely, and only then given a runbook. The answer is in the fix
title, because the format has no separate field for it.

- **Fence** (`FFMPEG_ODD_DIMENSION`): `scale=-2` derives the axis exactly as
  `-1` does and rounds to even, so no source dimension and no target size can
  produce an odd value. Proved over three different sources, including one the
  unfenced form already handled, where the fenced form produces the identical
  output.
- **Heal** (`FFMPEG_MAP_MATCHES_NO_STREAM`, `FFMPEG_FILTER_WITH_STREAMCOPY`):
  a correction that resolves the failure and changes nothing about a command
  that already worked. Both halves are run: the failing case is resolved, and
  the already-correct case is shown to come out identical.
- **Runbook**: the fallback, a twin whose fix is an inert docs pointer, used
  where no correction is safe without knowing the caller's intent. Overwriting
  an existing output is the clearest case: `-y` destroys data and `-n` keeps
  the refusal, and only the caller knows which is wanted.

## Not covered here

Fingerprint index tuning and collision behavior for this corpus belong to
ffmpeg Fingerprints [33], and watching upstream for wording drift belongs to
Upstream Watch [34].
