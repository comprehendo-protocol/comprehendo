# `@comprehendo/express`

## Smoke test

The flagship twin, firing against the real, installed `express@5.2.1`, no
socket opened (`express.request` is the real, shared prototype object every
real request inherits from, aliased to a local `req` so the real error's own
message names the same expression a real handler's crash would):

```
TypeError: req.param is not a function
```

routes, through this corpus's own fingerprint index, to
`EXPRESS_REQ_PARAM_REMOVED` (`node scripts/run-docs-code-blocks.ts
corpora/express`, real output):

```
ok     corpora/express/COMPREHENDO.md block 1 (javascript)
5 blocks, 5 passed, 0 failed
```

No guess: `req.param()` (singular) does not exist on Express 5 at all,
`req.params` (plural, an object) is the real, unchanged replacement it is
easy to mistype as.

## Real, live-checked against Express 4 too, not assumed from training data

Every claim this corpus makes about "this changed in v5" was checked against
a real, installed `express@4.22.2`, side by side, during this corpus's own
research (not shipped as a dependency of the corpus itself, only its own
witnesses' comments cite what was found):

- `app.del`, `req.param`: real, in v4; removed, in v5 (express's own
  migration guide, "Removed" section for both).
- `app.get('*', ...)`, `app.get('/foo/:bar?', ...)`: both register cleanly
  in v4; both throw a real `PathError` at registration time in v5
  (`path-to-regexp` v6 to v8, a real dependency bump with its own
  documented breaking syntax changes, not an Express-authored change).
- `res.send(404)`: in v4, a real deprecated alias for `res.sendStatus(404)`,
  really sets the status to 404, prints a real deprecation warning naming
  the replacement. In v5, no warning, no error, sends `"404"` as the
  response BODY, status stays 200. **This is the one this corpus considers
  the most dangerous**: every other change here fails loudly; this one
  fails silently, exactly the shape of bug a status-code-only check reads
  as a pass.

## Two fingerprint kinds, four `runtime-error` and one `static-pattern`

Four of the five twins are `runtime-error`, real thrown errors:
`EXPRESS_APP_DEL_REMOVED` and the two route-pattern twins throw at real
route-REGISTRATION time (no server needed, a bare `app.get(...)` call);
`EXPRESS_REQ_PARAM_REMOVED` throws against the real `express.request`
prototype, which reproduces the exact real crash a matching request would
hit, without opening a socket.

The fifth, `EXPRESS_RES_SEND_NUMBER_NO_LONGER_SETS_STATUS`, is
`static-pattern`: nothing throws, so there is no exception to catch. Its
real evidence is a real HTTP round trip in this corpus's own gate test
(`test/express-corpus.test.ts`, `test/helpers/express-witnesses.ts`), which
CC6 [27]'s corpus-content telemetry scan never reaches (that scan is scoped
to the corpus's own EXAMPLE text, not this project's own test code, the
same reasoning `corpora/mcp-oauth`'s README gives for its own examples).
The corpus's OWN worked example for this twin never opens a socket at all:
it is a `pattern` block, `res.send(404)`, matched as literal source text
against this corpus's own compiled static-pattern index, in-process, the
same execution shape `corpora/zod` established.

## `target.versions` is an honest, checked range

`>=5 <6`, checked live at the real stable floor (`5.0.0`) and the real
current latest (`5.2.1`); every twin's real text was identical at both
points. Every alpha/beta prerelease that led up to `5.0.0` is out of scope,
those were never a real, adoptable release. No claim is made about Express
4, a real different major in every way this corpus documents.

## Every fix here is a runbook

All five fixes are source edits (`app.del(...)` to `app.delete(...)`,
`req.param(name)` to reading `req.params`/`req.body`/`req.query` directly,
naming the wildcard, splitting an optional route into two registrations,
`res.send(code)` to `res.sendStatus(code)`), never a flat, safe `apply`
call against a declared surface: `apply`'s grammar is call data, not a text
transform, the same reasoning every prior corpus with a source-edit fix
gives for its own.
