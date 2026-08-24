---
topic: require-of-esm
status: ready
stub_fields: []
signatures:
  - "require(esmSpecifier)"
see_also:
  - cjs-globals-in-esm
vocabularies_served:
  own_terms:
    - ERR_REQUIRE_ASYNC_MODULE
    - require(esm)
    - synchronous ESM graph
  translations:
    - known_tool: webpack
      terms:
        - interop default
    - known_tool: ts-node
      terms:
        - esModuleInterop
  task:
    - "fix ERR_REQUIRE_ASYNC_MODULE"
    - "why does require() of an ES module work sometimes and not others"
    - "require an ESM-only package from CommonJS"
---

Two assumptions about `require()` and ESM that were both true for years and
are both now wrong on current Node deserve stating plainly, because
training data written before either changed still teaches the old
behavior. First: `require()` of a real ES module is no longer a hard wall.
Node resolves the target module graph, and if it can finish resolving
SYNCHRONOUSLY, `require()` returns its exports directly, no
`ERR_REQUIRE_ESM`, no separate `import()` needed. Second, unrelated:
`import`/`export` syntax written into a plain `.js` file with no
`"type": "module"` no longer throws `SyntaxError: Cannot use import
statement outside a module` either; Node detects the ESM syntax and
reparses the file as a module (with a `MODULE_TYPELESS_PACKAGE_JSON`
performance-cost warning naming the fix, adding the `type` field).

The one case `require()` still refuses, and the one this corpus catalogs,
is exactly the case where synchronous resolution is structurally
impossible: a target module (or anything it imports) uses top-level
`await`. There is no synchronous point at which that module's exports
exist yet, so `require()` cannot return them, and Node says so by name
(`ERR_REQUIRE_ASYNC_MODULE`) rather than hanging or returning a partial
value.

## Examples

### NODE_REQUIRE_ASYNC_MODULE, requiring an ES module that awaits at its top level

```cjs
// A minimal stand-in for a real ESM-only dependency that awaits something
// before it can export anything (a database client connecting, for
// instance). Written to disk here only so this example is self-contained;
// in a real project the .mjs file already exists on disk, installed by npm.
require('node:fs').writeFileSync(
  __dirname + '/dep.mjs',
  'await Promise.resolve();\nexport const value = 1;\n',
);
require('./dep.mjs');
```
