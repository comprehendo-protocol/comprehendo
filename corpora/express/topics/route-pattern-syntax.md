---
topic: route-pattern-syntax
status: ready
stub_fields: []
signatures:
  - "app.get('*', handler)"
  - "app.get('/foo/:bar?', handler)"
see_also:
  - removed-methods
vocabularies_served:
  own_terms:
    - path-to-regexp
    - "route pattern"
    - wildcard
  translations:
    - known_tool: koa-router
      terms:
        - "route matching"
  task:
    - "fix Missing parameter name at index"
    - "fix Unexpected ? at index"
    - "write a catch-all route in Express 5"
    - "write an optional route parameter in Express 5"
---

Express 5 bumped its underlying path-matching dependency from
`path-to-regexp` v6 to v8, a real, documented breaking change to route
STRING syntax made by that dependency, not by Express itself. Two shapes
common in Express 4 route tables are no longer valid syntax at all, and both
fail at route REGISTRATION time (when `app.get`/`app.use` is called), before
the server starts serving anything, not on the first matching request.

A bare `*` wildcard (`app.get('*', ...)` as a catch-all) needs a name now,
the same way every other route parameter always has: the real replacement
is `*splat` (or any other name), not the bare symbol. The `:name?` optional-
parameter suffix is gone the same way: `?` is simply not valid syntax at
that position in v8's grammar, and the real replacement is either two
separate route registrations or an explicit optional-segment group.

## Examples

### EXPRESS_BARE_WILDCARD_REMOVED, a bare wildcard needs a name now

```javascript
import express5 from 'express5';
const app = express5();
app.get('*', (req, res) => res.end());
```

### EXPRESS_OPTIONAL_PARAM_SYNTAX_REMOVED, the `?` suffix is no longer valid syntax

```javascript
import express5 from 'express5';
const app = express5();
app.get('/foo/:bar?', (req, res) => res.end());
```
