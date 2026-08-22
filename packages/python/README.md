# comprehendo (Python)

The Python port of the Comprehendo reference implementation, layer for layer
with `packages/core/src`: marker, twins, docs, the provider SDK, manifest
wiring. Python 3.11+, zero runtime dependencies, and it passes the
conformance kit in `packages/spec/kit` with zero fixture changes (CC2 [01]).

## The one-line probe

The Python marker idiom is a dunder attribute, the counterpart of
JavaScript's `Symbol.for('comprehendo')`:

```python
try:
    thing.do()
except Exception as exc:
    if hasattr(exc, "__comprehendo__"):
        print(exc.twin["fixes"][0]["title"])
```

No import is needed to probe. The check is one attribute read: no I/O, no
mutation, and it costs nothing until an agent acts on the result.

## Building a provider

```python
from comprehendo import load_packed_corpus, make_provider

corpus = load_packed_corpus("comprehendo/packed.json")
provider = make_provider(
    corpus,
    {
        "catalog": catalog,          # cataloged failures + declared call schema
        "identity": IDENTITY,        # what the tool is, RFC 5.5
        "priming": PRIMING,          # the adoption snippet, under 150 tokens
        "twin_resolvers": [resolver],
        "validate": judge,           # optional: Level 2
        "explain": explainer,        # optional: Level 2
    },
)

provider.docs()                      # the index: names only
provider.docs("how to undo a write") # one topic-sized answer
provider.raise_(raw_failure)         # a twinned, marked error
```

## Field names are the wire's, never Python's

CC2 [01] freezes the shape field names across languages: `see_also`,
`source_permitted`, `would_execute`, `vocabularies_served` are spelled
exactly as the JSON Schemas in `packages/spec/kit/shapes/` spell them. There
is no translation layer, in either direction.

## Development

```bash
python3.13 -m venv .venv          # 3.11+ required
./.venv/bin/pip install -e '.[dev]'
./.venv/bin/pytest                # the suite, including the conformance kit
./.venv/bin/mypy                  # strict typing
```

The CC5 budget cross-check shells out to the kit's own Node harness
(`packages/spec/kit/budget/run.js`), so it needs `npm ci` in
`packages/spec` once; it reports its reason and skips when the harness is
not installed.
