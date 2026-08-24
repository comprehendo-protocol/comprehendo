---
topic: unregistered-client
status: ready
stub_fields: []
signatures:
  - "provider.clientsStore.getClient(client_id)"
see_also:
  - claude-connector-oauth
  - redirect-uri-mismatch
vocabularies_served:
  own_terms:
    - client_id
    - invalid_client
    - clientsStore
  translations:
    - known_tool: auth0
      terms:
        - unknown application
    - known_tool: aws-cognito
      terms:
        - app client not found
  task:
    - "fix Invalid client_id"
    - "why does /authorize reject my request"
---

The SDK's own `/authorize` handler looks up `client_id` in
`provider.clientsStore` and rejects before your own `provider.authorize()`
ever runs, if it resolves to nothing. This check exists because Dynamic
Client Registration is intentionally public (RFC 7591: any caller can
self-register, no credential needed) and proves nothing by itself; the
real security boundary is one step later, the human's own consent, and it
is only real if the `client_id` presenting itself there is one that
actually registered. Skip this check (by hand-rolling `/authorize` instead
of mounting `mcpAuthRouter`) and a phished consent-click can hand a real
authorization code to a caller who never registered at all.

## Examples

### MCP_OAUTH_UNREGISTERED_CLIENT, the real error class the router's own authorize handler throws

```javascript
// The real class, real message, real serialization: this is exactly what
// the SDK's own authorize handler throws and sends when clientsStore.getClient
// returns nothing, verified against the real running router (this corpus's
// own induction, packages/registry-tools/test/mcp-oauth-corpus.test.ts).
import { InvalidClientError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

try {
  throw new InvalidClientError('Invalid client_id');
} catch (error) {
  console.error(JSON.stringify(error.toResponseObject()));
}
```
