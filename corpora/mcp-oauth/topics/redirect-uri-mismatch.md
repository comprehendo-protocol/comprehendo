---
topic: redirect-uri-mismatch
status: ready
stub_fields: []
signatures:
  - "client.redirect_uris"
see_also:
  - unregistered-client
  - claude-connector-oauth
vocabularies_served:
  own_terms:
    - redirect_uri
    - invalid_request
    - registered redirect_uris
  translations:
    - known_tool: auth0
      terms:
        - allowed callback URLs
    - known_tool: aws-cognito
      terms:
        - callback URL not allowed
  task:
    - "fix Unregistered redirect_uri"
    - "why does /authorize reject my redirect_uri"
---

`client_id` resolved to a real, registered client, but this request's
`redirect_uri` is not one that client actually registered (loopback URIs
get RFC 8252 SS7.3's port relaxation; every other host needs an exact
match, never `startsWith`). This is the check that actually stops a
phished consent-click from working: PKCE alone only proves the caller
redeeming a code is the one that started the flow, never that the flow
was allowed to send its result to this particular `redirect_uri`. A
hand-rolled `/authorize` route that skips this will happily redirect a
real authorization code to an attacker's own `redirect_uri`, with the
human never seeing anything wrong on the consent page they approved.

## Examples

### MCP_OAUTH_REDIRECT_URI_MISMATCH, the real error class the router's own authorize handler throws

```javascript
// The real class, real message, real serialization: this is exactly what
// the SDK's own authorize handler throws when a registered client's
// redirect_uris does not contain this request's redirect_uri, verified
// against the real running router (this corpus's own induction,
// packages/registry-tools/test/mcp-oauth-corpus.test.ts).
import { InvalidRequestError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

try {
  throw new InvalidRequestError('Unregistered redirect_uri');
} catch (error) {
  console.error(JSON.stringify(error.toResponseObject()));
}
```
