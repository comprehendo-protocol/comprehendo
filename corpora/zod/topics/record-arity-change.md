---
topic: record-arity-change
status: ready
stub_fields: []
signatures:
  - "z.record(valueType)"
  - "z.record(keyType, valueType)"
see_also:
  - error-customization-migration
vocabularies_served:
  own_terms:
    - z.record
    - keyType
    - valueType
  translations:
    - known_tool: typescript
      terms:
        - "Record<K, V>"
  task:
    - "fix z.record expected 2-3 arguments, got 1"
    - "migrate z.record to v4"
    - "declare a schema for an object with arbitrary keys"
---

zod v3's `z.record(valueSchema)` took one argument, an implicit
`z.string()` key. zod v4's real, current type signature requires two,
`z.record(keyType, valueType, params?)`, confirmed against the package's
own real `.d.ts`. The one-argument v3 shape is a genuine, current
TypeScript compile error against v4's types, `error TS2554: Expected 2-3
arguments, but got 1`, confirmed live with a real `tsc` run. It is a
build-time failure, not something a caught runtime exception could
fingerprint: a build using this shape never reaches a point where anything
could be thrown and caught the normal way.

Code that only ever runs under plain, unchecked JavaScript, no build step,
no `tsc`, does not hit this at all: the runtime is more permissive than
the v4 types are, and `z.record(z.string())` still validates correctly
there. That gap, a TypeScript build catching this and a bare Node script
not, is its own thing worth knowing, not a reason to skip fixing the
call shape.

## Examples

### ZOD_RECORD_SINGLE_ARG_REJECTED, v3's one-argument form is a real v4 compile error

```pattern
z.record(z.string())
```
