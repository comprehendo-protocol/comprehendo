---
topic: optional-vs-nullable
status: ready
stub_fields: []
signatures:
  - "z.string().optional()"
  - "z.string().nullable()"
  - "z.string().nullish()"
see_also:
  - removed-v3-methods
vocabularies_served:
  own_terms:
    - optional
    - nullable
    - nullish
    - ZodError
  translations:
    - known_tool: typescript
      terms:
        - "string | undefined"
        - "string | null"
    - known_tool: json-schema
      terms:
        - "not required"
        - "type: [string, null]"
  task:
    - "accept a field that can be null"
    - "fix expected string, received null"
    - "make a schema field optional"
---

`.optional()` widens a schema to also accept `undefined`. It does not widen
it to accept `null`; those are two different absences and zod tracks them
separately. Data that is often `null` rather than absent, a JSON API field
that is always present but sometimes set to `null`, a database column with
no `NOT NULL` constraint, fails validation the instant it reaches a field
marked `.optional()` alone, and the failure reads like an ordinary type
mismatch: nothing in the message says "you probably meant nullish".

`.nullable()` is the mirror image: it accepts `null`, but then the key must
still be present in the object at all (an absent key still fails). Neither
one alone covers both cases. `.nullish()` is the schema that actually
accepts `undefined` OR `null` OR the key being absent, all three, in one
call.

## Examples

### ZOD_OPTIONAL_REJECTS_NULL, .optional() alone never covers null

```javascript
import { z } from 'zod';
z.string().optional().parse(null);
```
