---
topic: cjs-globals-in-esm
status: ready
stub_fields: []
signatures:
  - "__dirname"
  - "__filename"
  - "require(specifier)"
see_also:
  - require-of-esm
  - top-level-await
vocabularies_served:
  own_terms:
    - __dirname
    - __filename
    - require
    - import.meta
  translations:
    - known_tool: webpack
      terms:
        - CommonJS shims
    - known_tool: babel
      terms:
        - module interop
  task:
    - "fix __dirname is not defined in ES module scope"
    - "fix require is not defined in ES module scope"
    - "get the current file's directory in an ES module"
---

`__dirname`, `__filename`, `require`, `module`, and `exports` are not
JavaScript language features; they are variables the CommonJS module
wrapper injects into every `.cjs` file (or `.js` file with no
`"type": "module"`) before running it. An ES module has no such wrapper
(its scope is defined by the ECMAScript module spec, which Node did not
write and cannot add CJS-specific names to), so any of those five names
used inside a real `.mjs` file, or a `.js` file under `"type": "module"`,
throws a `ReferenceError` the instant it is read, not `undefined`, a
missing binding.

The two that come up constantly are `__dirname` (usually building a path
relative to the current file) and `require` (usually loading a dependency
the old way, muscle memory from years of CJS). Both have real, direct ESM
equivalents: `import.meta.dirname` (Node 20.11+/21.2+, verified live on
24.7.0 and 24.8.0) replaces `__dirname` directly; a real `import`
declaration, or dynamic `import()`, replaces `require` for anything that
has an ESM-compatible way to load. When a dependency genuinely has none,
`createRequire(import.meta.url)` (from `node:module`) builds a real,
working `require` function scoped to that one file, the sanctioned escape
hatch rather than a workaround.

## Examples

### NODE_DIRNAME_UNDEFINED_IN_ESM, __dirname does not exist in an ES module's scope

```javascript
console.log(__dirname);
```

### NODE_REQUIRE_UNDEFINED_IN_ESM, require does not exist in an ES module's scope

```javascript
const fs = require('node:fs');
console.log(fs);
```
