# `@comprehendo/openai-python`

## Smoke test

The flagship twin, firing against the real, installed `openai==3.3.1`. The
traceback (real, unedited, `python3 example.py`):

```
Traceback (most recent call last):
  File "example.py", line 2, in <module>
    openai.ChatCompletion.create(model="gpt-4", messages=[])
  File ".../openai/lib/_old_api.py", line 39, in __call__
    raise APIRemovedInV1(symbol=self._symbol)
openai.lib._old_api.APIRemovedInV1:

You tried to access openai.ChatCompletion, but this is no longer supported
in openai>=1.0.0 - see the README at https://github.com/openai/openai-python
for the API.
```

routes, through this corpus's own fingerprint index, to `OPENAI_API_REMOVED_V0`
(`node scripts/run-docs-code-blocks.ts corpora/openai-python`, real output):

```
ok     corpora/openai-python/COMPREHENDO.md block 0 (python)
3 blocks, 3 passed, 0 failed
```

No guess, no network call, no telemetry: a training-lag failure two years
old, diagnosed the instant the traceback exists.

A sidecar corpus for the **`openai` PyPI package**, in Corpus Format [28]'s
authoring shape (`corpus_authoring: 1`), the same five-file layout
`corpora/ffmpeg/` uses.

## The training-lag failure this corpus exists for

`openai`'s 1.0.0 release (August 2023) replaced the entire module-level API
(`openai.ChatCompletion.create(...)`) with an instantiated client
(`client.chat.completions.create(...)`). Every model trained on code written
before that release has seen thousands of examples of the old shape and
close to none of the new one, so an agent reaching for "the way this always
worked" reaches for exactly the call that has raised `APIRemovedInV1` on
every `openai` release for two years.

## Every entry was induced against the real package, none was remembered

`packages/registry-tools/test/openai-python-corpus.test.ts` spawns a real
Python interpreter with the really-installed `openai` package, once per
cataloged entry, and routes the real traceback text through the real
fingerprint matcher; `packages/registry-tools/test/helpers/
openai-python-witnesses.ts` holds the inducing script for each entry.
Induced against `openai==3.3.1`, `target.versions` declares `>=2.35 <4`.
One entry (`OPENAI_INVALID_API_KEY`) makes a real network round trip to
`api.openai.com` and depends on that service answering, not only on the
package being installed.

**Real drift, found by bisection, not assumed.** `OPENAI_MISSING_API_KEY`'s
message text is not stable across the whole `openai>=1.0.0` line: every
release from 1.0.0 through 2.33.0 raises the same client-side check with
*"The api_key client option must be set either by passing api_key to the
client or by setting the OPENAI_API_KEY environment variable"*; 2.35.0
onward raises the same check with *"Missing credentials. Please pass an
`api_key`..."* instead (confirmed live against 1.0.0, 1.55.0, 2.0.0, 2.20.0,
2.30.0, 2.33.0, 2.35.0, 2.37.0, 2.40.0, 2.54.0, 3.0.0, 3.3.1; the
`OPENAI_API_REMOVED_V0` and `OPENAI_INVALID_API_KEY` texts stayed stable
across the same span). Rather than widen `messagePattern` to a glob loose
enough to match both wordings (which would also be loose enough to collide
with unrelated messages, the opposite of fingerprint precision over
recall), `target.versions` is narrowed to the range this corpus actually
verified with one exact wording.

## Fingerprints are traceback text, not error classes

Like `corpora/ffmpeg`, an agent reading a Python traceback has text, not a
live exception object (a JS/TS-based agent is not running inside the same
Python process). Every entry here declares a `message_pattern` and no
`exception`, the same reasoning ffmpeg's own README gives.

## Every fix here is a runbook, and that is not a shortcut

The `apply` grammar (Corpus Format [28]) is literal call data, `{operation:
operand}`, shaped for a flat call against a declared surface. The real fix
for every twin in this corpus is "construct a client object, then call a
method on an attribute of it" (`client.chat.completions.create(...)`), a
multi-step, object-oriented shape the grammar does not yet express. Rather
than force a fit or invent an unsafe correction, every fix here is an inert
docs pointer (a runbook), the format's own honest answer when no correction
is expressible or safe without the caller's own context (a credential, a
migration decision).

## Worked examples run as real scripts, not argv transcripts

Docs As Tests [37]'s executor originally knew only ffmpeg's shape, a
transcript of real CLI command lines. This corpus is the second real corpus
it runs against, and the shape it needed was different: `openai` is a
Python package, not a spawnable CLI, and its own real failure is provoked
by a multi-step snippet (construct a client, then call a method on it), not
one command line. Rather than force a shell-transcript fit or ship this
corpus with no worked examples, [37] gained a second, genuinely reusable
execution shape alongside it: a `python`-language fence under `## Examples`
is executed as a real script (the fence's own text, written to disk and run
against a real interpreter, `COMPREHENDO_PYTHON` or `python3` on `PATH`),
matched through the same fingerprint index as every `sh` transcript. Every
worked example in this corpus's generated `COMPREHENDO.md` is one of these,
and every one really runs in CI (`.github/workflows/docs-as-tests.yml`
installs a real `openai>=2.35,<4` for exactly this).
