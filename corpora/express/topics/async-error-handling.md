---
topic: async-error-handling
status: ready
stub_fields: []
signatures:
  - "app.get(path, async (req, res) => { ... })"
see_also: []
vocabularies_served:
  own_terms:
    - "async handler"
    - "error-handling middleware"
  translations:
    - known_tool: koa
      terms:
        - "async middleware"
    - known_tool: fastify
      terms:
        - "async handler"
  task:
    - "handle a rejected promise in an Express route"
    - "avoid express-async-handler"
    - "fix an unhandled promise rejection in a route handler"
---

In Express 4, a promise rejected inside an async route handler was NOT
automatically caught. It became an unhandled rejection, the request hung
with no response and no error page, and the conventional fix was manual
`try`/`catch` plus a call to `next(err)`, or a wrapper package
(`express-async-handler` and similar) that did the same thing for every
route. That workaround is genuinely common in code written against Express
4 (essentially all training data), and it is genuinely no longer necessary.

Express 5 automatically catches a rejected promise returned from an async
route handler and forwards it to error-handling middleware, the same
`(err, req, res, next)` middleware that always existed for synchronous
throws. Confirmed live: an async handler that throws, with NO manual
`try`/`catch` and NO wrapper, reaches a real `(err, req, res, next)`
middleware for real, with the real thrown error, on a real request.

This is not a twin: nothing here fails, nothing throws in a way an agent
would catch. It is included because the natural instinct, reaching for the
Express 4-era wrapper out of habit, is not wrong exactly, it is just
unnecessary weight against a version that already does the job; and because
code relying on the OLD (silent-hang) behavior on purpose, however unlikely,
would behave differently after an upgrade with nothing in a stack trace to
explain why.
