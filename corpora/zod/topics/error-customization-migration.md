---
topic: error-customization-migration
status: ready
stub_fields: []
signatures:
  - "z.string({ required_error })"
  - "z.string({ error })"
see_also:
  - removed-v3-methods
vocabularies_served:
  own_terms:
    - required_error
    - invalid_type_error
    - error
  translations:
    - known_tool: yup
      terms:
        - "custom validation message"
  task:
    - "customize a zod validation error message"
    - "fix a custom error message that never appears"
    - "migrate required_error to v4"
---

zod v3's `required_error` and `invalid_type_error` params customized the
message for one specific failure kind. zod v4 replaced both with a single
`error` param (a string, or a function). This is not a case of the old
params quietly still working: a TypeScript build REJECTS `{ required_error:
"..." }` outright against v4's real, current types (a real `error TS2353`,
"Object literal may only specify known properties"), the same class of
protection `record-arity-change` describes for `z.record`.

The quieter trap is what happens when that protection is bypassed, plain
JavaScript with no build step, a stray `as any`, an `@ts-ignore` copied in
from somewhere else. There, the schema constructs without a single warning,
`required_error` is simply an unrecognized key nobody complained about, and
the custom message is silently dropped: a field that fails validation still
raises zod's own generic default text, never the caller's own. Confirmed
live, unchanged across every zod 4.x release checked (4.0.0 through 4.4.3).

## Examples

### ZOD_REQUIRED_ERROR_PARAM_IGNORED, the v3 param is silently dropped once past the type checker

```pattern
z.string({ required_error: "Name is required" })
```
