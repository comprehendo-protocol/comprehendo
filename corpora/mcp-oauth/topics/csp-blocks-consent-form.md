---
topic: csp-blocks-consent-form
status: ready
stub_fields: []
signatures:
  - "Content-Security-Policy: form-action 'self'"
see_also:
  - claude-connector-oauth
vocabularies_served:
  own_terms:
    - form-action
  task:
    - "the consent/approve button does nothing, no error, no request sent"
---

A consent page's own security header, not the OAuth flow, breaks this.
`form-action 'self'` (a `helmet()` default) means this page's forms may only
submit to its own origin, but the real OAuth authorize endpoint routinely
lives at a different origin or port. The browser enforces this
unconditionally: nothing is sent, and nothing downstream (SDK, logs, a
breakpoint in the handler) ever sees a request. There is no thrown
exception; the only evidence is the browser's own console.

Getting the OAuth handshake itself right ([[claude-connector-oauth]]) does
not prevent this, the header must independently name the cross-origin
destination the form targets. Fix, never widen past the real target:
`form-action 'self' https://your-real-mcp-origin`.

## Examples

### MCP_OAUTH_CSP_BLOCKS_CONSENT_FORM, the real text a real browser really wrote

```javascript
// The exact browser console text this corpus's own induction test really
// captured (a real headless Chromium, a real cross-origin form submit,
// blocked by a real, unwidened form-action; packages/registry-tools/test/
// mcp-oauth-corpus.test.ts). Printed directly, no socket opened here: the
// live two-origin round trip is test code, not corpus content (see this
// corpus's README, "a real limit it hit"). The origin is the one
// deployment-specific part; everything else is the browser's own wording.
console.error(
  "Sending form data to 'https://your-mcp-origin/oauth/authorize' violates the following Content Security Policy directive: \"form-action 'self'\". The request has been blocked.",
);
process.exit(1);
```
