---
topic: top-level-await
status: ready
stub_fields: []
signatures:
  - "await <expr>  // at a module's top level"
see_also:
  - require-of-esm
  - cjs-globals-in-esm
vocabularies_served:
  own_terms:
    - top-level await
    - async IIFE
  translations:
    - known_tool: python
      terms:
        - asyncio.run entrypoint
    - known_tool: rust
      terms:
        - "#[tokio::main]"
  task:
    - "fix await is only valid in async functions"
    - "use await at the top of a script without wrapping it in an async function"
---

Top-level `await` works by suspending the CURRENT MODULE's own evaluation
until the awaited value settles, which only ES modules' loading model
supports (the module graph loader already resolves modules as promises
internally; a top-level `await` is a real suspension point in that graph).
A CommonJS file's top level is an ordinary, synchronous function body, the
same CJS wrapper `cjs-globals-in-esm` describes, and `await` outside an
`async function` there is a parse error, caught before a single line of the
file executes, not a runtime one.

Two fixes exist and they answer different questions. If the file's job is
inherently synchronous startup with one async step, wrap that step in an
async IIFE, `(async () => { ... })()`, and handle its rejection explicitly
(an unhandled one becomes an `unhandledRejection`, not a crash the caller
necessarily sees). If the file can legitimately become an ES module (no
other CJS-only dependency forces it to stay `.cjs`), converting it removes
the restriction entirely, top-level `await` needs no wrapper there.

## Examples

### NODE_TOP_LEVEL_AWAIT_IN_CJS, await outside an async function in a CommonJS file

```cjs
await Promise.resolve();
console.log('done');
```
