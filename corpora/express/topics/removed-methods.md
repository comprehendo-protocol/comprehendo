---
topic: removed-methods
status: ready
stub_fields: []
signatures:
  - "app.del(path, handler)"
  - "req.param(name)"
see_also:
  - route-pattern-syntax
vocabularies_served:
  own_terms:
    - "app.del"
    - "req.param"
    - "v4 to v5 migration"
  translations:
    - known_tool: koa
      terms:
        - "ctx.params"
  task:
    - "migrate an Express 4 app to Express 5"
    - "fix app.del is not a function"
    - "fix req.param is not a function"
---

Express 5's own migration guide lists a real "Removed" section, distinct
from methods that are merely deprecated (still work, print a warning).
`app.del()` (an alias for `app.delete()`, kept historically because
`delete` was once a reserved word in some engines) and `req.param(name)`
(singular, a method that checked route params, then body, then query, in
that order) are both gone entirely, not renamed.

`app.del()` fails at route REGISTRATION time, before the server ever starts
serving requests: the call throws the instant it runs, which is a loud,
early failure. `req.param()` fails at REQUEST time instead, inside the
handler, because it is only ever called once a matching request actually
arrives: the route registers fine, requests match fine, and only the
specific line calling the removed method crashes.

## Examples

### EXPRESS_APP_DEL_REMOVED, gone at registration time

```javascript
import express5 from 'express5';
const app = express5();
app.del('/x', () => undefined);
```

### EXPRESS_REQ_PARAM_REMOVED, gone at request time

```javascript
import express5 from 'express5';
const req = express5.request;
req.param('id');
```
