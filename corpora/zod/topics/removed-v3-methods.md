---
topic: removed-v3-methods
status: ready
stub_fields: []
signatures:
  - "z.object(...).deepPartial()"
see_also:
  - optional-vs-nullable
vocabularies_served:
  own_terms:
    - deepPartial
    - "v3 to v4 migration"
  translations:
    - known_tool: yup
      terms:
        - "recursive partial shape"
  task:
    - "migrate a zod v3 schema to v4"
    - "fix deepPartial is not a function"
    - "make every nested field optional recursively"
---

zod v4 removed some v3 methods outright rather than deprecating them; the
package's own migration guide is explicit about the distinction, `.merge()`,
`.strict()`, and `.passthrough()` are listed as deprecated (they still work,
a v4 caller gets a working schema and a nudge toward the replacement).
`.deepPartial()` is listed under Removed, with no v4 equivalent at all: the
method does not exist on a v4 schema object, calling it throws immediately,
before any input is even looked at.

Training data written against zod 3 (most of what exists) uses
`.deepPartial()` freely to recursively mark every field of a nested schema
optional in one call. That call now crashes at schema-CONSTRUCTION time, not
at validation time, which is a useful tell: if the stack trace shows nothing
about the actual data being validated, the schema itself never finished
building. There is no direct replacement; the real fix restructures the
schema, marking each field optional explicitly, one level at a time.

## Examples

### ZOD_DEEP_PARTIAL_REMOVED, the method does not exist in v4 at all

```javascript
import { z } from 'zod';
z.object({ a: z.object({ b: z.string() }) }).deepPartial();
```
