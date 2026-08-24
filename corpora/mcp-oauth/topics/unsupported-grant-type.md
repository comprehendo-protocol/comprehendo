---
topic: unsupported-grant-type
status: ready
stub_fields: []
signatures:
  - "grant_type=authorization_code"
  - "grant_type=refresh_token"
see_also:
  - pkce-mismatch
  - claude-connector-oauth
vocabularies_served:
  own_terms:
    - grant_type
    - unsupported_grant_type
    - client_credentials
  translations:
    - known_tool: oauth2-proxy
      terms:
        - grant type
    - known_tool: passport-oauth2
      terms:
        - strategy
  task:
    - "fix unsupported grant type"
    - "why does client_credentials fail against this server"
---

Only two grant types exist on the server side of this SDK:
`authorization_code` for the initial exchange, `refresh_token` for
renewal. Anything else, `client_credentials` being what an agent reaches
for most often (no user-facing consent step, the simplest OAuth grant to
remember), is refused outright: there is no server-side extension point
for adding a third, by design, because a personal MCP server has no
separate machine-to-machine caller to authenticate that way, and
`claude.ai`'s own connector never sends anything else. A refresh exchange
itself rotates the refresh token per RFC 6749 SS6: a correct
implementation deletes the old one in the SAME call that issues the new
pair, so a leaked old refresh token stops working the moment a legitimate
refresh happens, never staying valid alongside the new one.

## Examples

### MCP_OAUTH_UNSUPPORTED_GRANT_TYPE, the real error class the router's own token handler throws

```javascript
// The real class, real message, real serialization: this is exactly what
// the SDK's own token handler throws for any grant_type besides
// authorization_code and refresh_token, verified against the real running
// router (this corpus's own induction,
// packages/registry-tools/test/mcp-oauth-corpus.test.ts).
import { UnsupportedGrantTypeError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

try {
  throw new UnsupportedGrantTypeError('The grant type is not supported by this authorization server.');
} catch (error) {
  console.error(JSON.stringify(error.toResponseObject()));
}
```
