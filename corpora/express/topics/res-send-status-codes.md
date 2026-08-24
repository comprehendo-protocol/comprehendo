---
topic: res-send-status-codes
status: ready
stub_fields: []
signatures:
  - "res.send(statusCode)"
  - "res.sendStatus(statusCode)"
see_also:
  - removed-methods
vocabularies_served:
  own_terms:
    - "res.send"
    - "res.sendStatus"
  translations:
    - known_tool: koa
      terms:
        - "ctx.status"
  task:
    - "send an HTTP status code from an Express route"
    - "fix a route that always returns 200"
---

In Express 4, calling `res.send()` with a bare NUMBER (`res.send(404)`) was
a deprecated alias for `res.sendStatus(404)`: it really set the response
status code, and printed a real deprecation warning naming the intended
replacement. In Express 5 that alias is gone, silently: the number is no
longer treated as a status code at all, it is sent as the literal response
BODY text instead, and the status stays 200. Nothing throws, nothing warns.

This is the quietest possible failure in this corpus: a route written to
"just send a 404" now returns a real HTTP 200 with the string `"404"` as
its body, which reads as success to a client, a test, or an agent checking
only the status code. There is no exception to catch here, because nothing
fails; the only way to catch this before it produces a wrong response is
recognizing the source pattern itself, a bare number literal passed to
`res.send()`, and using `res.sendStatus()` for a status code or
`res.send()` for an actual response body, never both meanings from the same
call.

## Examples

### EXPRESS_RES_SEND_NUMBER_NO_LONGER_SETS_STATUS, silently the wrong response now

```pattern
res.send(404)
```
