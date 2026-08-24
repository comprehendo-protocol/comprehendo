# `@comprehendo/mcp-oauth`

## Smoke test

The flagship twin, firing against the real, running `mcpAuthRouter`. The
real HTTP response body (`packages/registry-tools/test/mcp-oauth-corpus.test.ts`
inducing `MCP_OAUTH_UNREGISTERED_CLIENT` against a real Express app on a
real ephemeral localhost port, unedited):

```
{"error":"invalid_client","error_description":"Invalid client_id"}
```

routes, through this corpus's own fingerprint index, to
`MCP_OAUTH_UNREGISTERED_CLIENT`
(`node scripts/run-docs-code-blocks.ts corpora/mcp-oauth`, real output):

```
ok     corpora/mcp-oauth/COMPREHENDO.md block 0 (javascript)
5 blocks, 5 passed, 0 failed
```

No guess, no assumption about what the SDK does: the exact JSON error
shape a phished-consent-click vulnerability class produces, closed
structurally the moment the real router is mounted correctly, and named
the instant it isn't.

A sidecar corpus for **`@modelcontextprotocol/sdk`** (npm, real installed
version `1.30.0`), in Corpus Format [28]'s authoring shape
(`corpus_authoring: 1`), the same five-file layout `corpora/ffmpeg/` and
`corpora/openai-python/` use. It covers the OAuth 2.0 authorization-server
side of the SDK, `mcpAuthRouter` and `OAuthServerProvider`: what makes an
MCP server reachable from `claude.ai`'s personal "Add custom connector"
dialog, and the four real, structural validation failures its own router
enforces.

## Generalized from a real build, not written from the RFCs cold

This corpus's prose is generalized from a real production build (a single-
owner MCP server, no external identity provider, adding OAuth so
`claude.ai`'s connector could reach it), with every project-specific name
stripped: no internal env var names, no internal file paths, no internal
doc IDs. The lessons survive the generalization; the internals do not need
to.

That build predates (or did not use) the SDK's own `mcpAuthRouter` and
hand-rolled its own `/authorize`/`/token`/`/register` routes instead, and
its worst real bug (Phase 7 review, unanimous across four independent
reviewers) was exactly the shape `MCP_OAUTH_UNREGISTERED_CLIENT` and
`MCP_OAUTH_REDIRECT_URI_MISMATCH` document: `client_id`/`redirect_uri`
were never validated against what actually registered, so a phished
consent-click could hand an attacker a real authorization code. Verified
live, reading the SDK's own real source (`server/auth/handlers/
authorize.js`, `1.30.0`): mounting the real `mcpAuthRouter` makes this
exact hole structurally impossible, because both checks fire before your
own `provider.authorize()` is ever called. The corrected, current guidance
this corpus leads with is "mount the router, implement
`OAuthServerProvider`", not "here is how to hand-roll it safely" (the
`claude-connector-oauth` topic), and every twin's `reason` field says so
explicitly.

## Every twin was induced against the real, running SDK, none was remembered

`packages/registry-tools/test/mcp-oauth-corpus.test.ts` starts a real
Express app mounting the real `mcpAuthRouter` (`server/auth/router.js`)
against a real, minimal `OAuthServerProvider` implementation
(`test/helpers/mcp-oauth-server.ts`), listening on a real ephemeral
localhost port, and makes real HTTP requests (`test/helpers/
mcp-oauth-witnesses.ts`) that provoke each cataloged failure for real.
`target.versions` pins the single version this was actually verified
against (`1.30.0`, an exact pin, not a range): the SDK's own error classes
and the router's own validation order were read directly from its real
source before any of this was written down, but no bisection across
multiple SDK releases has been run yet (openai-python's own README records
what that looks like when it finds real drift; this corpus has not needed
it yet).

## A third real induction shape, not a copy of the first two

ffmpeg spawns a real CLI process and reads stderr. openai-python spawns a
real Python script and reads stderr. Neither fits a real npm package whose
failures are HTTP responses from a real, stateful, in-process server:
`packages/registry-tools/test/helpers/http-induction.ts` is the third
shape, a real HTTP round trip against a real server this corpus's own
test starts and tears down, reusing `process-induction.ts`'s
`VersionedCapture` concept (an HTTP status is the same idea as an exit
status) rather than duplicating it, but genuinely different where the
shapes actually differ (async, no argv, no workspace/env isolation an HTTP
client does not need).

## A fifth real twin, and a fourth real induction shape: the browser itself

`MCP_OAUTH_CSP_BLOCKS_CONSENT_FORM` is not an SDK failure at all: a consent
page's own `Content-Security-Policy: form-action 'self'` blocks the
cross-origin POST to the real OAuth authorize endpoint before it is ever
sent, so there is no HTTP response, no thrown exception, nothing the other
four twins' shape (`http-induction.ts`) can provoke or read. The only real
evidence is a real browser's own `console` event, so it gets its own real
target and its own real witness (`test/helpers/csp-form-action-server.ts`,
two real Express origins; `test/helpers/csp-form-action-witness.ts`, a real
headless Chromium via this package's own real `playwright` devDependency),
induced and merged into the one `UpstreamVerification` the gate reads
(`gate.ts#runSubmissionGate` takes the first entry per directory, never a
union, so `test/mcp-oauth-corpus.test.ts` builds one merged record rather
than two). `test/mcp-oauth-corpus.test.ts` also proves the runbook fix live:
widening `form-action` to the real cross-origin target is asserted to really
stop the block, not just assumed to.

This twin's own worked example does NOT reproduce that live, on purpose:
the browser-blocked shape has no pure, socket-free analog the way throwing
an imported SDK error class does, so, matching "a real limit it hit" below,
the example prints the exact real text the induction test really captured
and points at that test for the live proof, rather than opening a socket in
corpus content to re-derive it.

## Fingerprints are the real JSON error body, not error classes

Like the other two corpora, an agent reading this corpus's kind of failure
has TEXT in hand (the response body a client received, or a log line), not
a live `OAuthError` instance in the same process. Every entry here
declares a `message_pattern` (a literal fragment of the real
`{"error":"...","error_description":"..."}` body `toResponseObject()`
really produces) and no `exception`, the same reasoning the other two
corpora's own READMEs give.

## Every fix here is a runbook, and that is not a shortcut

The `apply` grammar is literal call data against this corpus's own
`declared_schema`. None of these five failures has a safe, single, flat
correction to apply: "register the real client first", "use the exact
registered redirect_uri", "resend the correct code_verifier", "use
authorization_code or refresh_token" are all corrections to what the
CALLER sends, not a code change this corpus could make on the caller's
behalf; `MCP_OAUTH_CSP_BLOCKS_CONSENT_FORM`'s own fix is a deployment
decision instead (widen `form-action` to the real cross-origin target, or
put the consent UI and the OAuth endpoints on one origin), never something
safe to apply unattended either. Inventing an `apply` that pretended
otherwise would either do nothing safe or guess at credentials or origins
this corpus does not have. Every fix here is an inert docs pointer, the
same honest answer `corpora/openai-python`'s own multi-step fixes already
established.

## A second real worked-example shape for Docs As Tests [37], and a real limit it hit

Doc 37 originally knew one worked-example shape, ffmpeg's argv transcript.
`corpora/openai-python` added a second, `python`-language SOURCE blocks
(the whole fence is a real script, run as-is). This corpus needed a THIRD:
`javascript`-language SOURCE blocks, run against a real `node` (no
override needed; the gate's own process is proof `node` exists), resolved
from `packages/registry-tools`'s own `node_modules` (Node's ESM loader
walks up from the FILE's own path, never `cwd`, so the temp file is
written inside that tree rather than the system tmpdir Python's
`invokeSource` uses).

**The real limit found building it**: a worked example that starts a real
server and makes a real `fetch()` against it, even to `127.0.0.1`, is
still literally network code, and CC6 [27]'s corpus-content scan
(`gate-telemetry.ts`) refuses ANY corpus example that opens a socket, on
principle, with no loopback exception, because a corpus's own example
text is something a downstream agent might read, copy, or execute
directly, and "nothing a corpus carries ever crosses the wire, in either
tier" does not carve out an exception for "only to itself." This is not a
scanner gap to route around; it is what the rule is FOR. This corpus's
examples do not open a socket at all: each one imports the real, exact
`OAuthError` subclass the router really throws (verified against the real
router's real source and this corpus's own real induction) and constructs
it directly, `throw`s it, and prints the real `.toResponseObject()`
output, exactly reproducing the real JSON body with zero network code.
The full, real, end-to-end HTTP proof lives in the induction test above,
which is test code, not corpus content, and CC6's scan never reaches it.
