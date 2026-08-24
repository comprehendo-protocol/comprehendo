---
topic: pkce-mismatch
status: ready
stub_fields: []
signatures:
  - "code_verifier"
  - "code_challenge"
see_also:
  - unsupported-grant-type
  - claude-connector-oauth
vocabularies_served:
  own_terms:
    - code_verifier
    - code_challenge
    - invalid_grant
  translations:
    - known_tool: oauth2-proxy
      terms:
        - code exchange
    - known_tool: passport-oauth2
      terms:
        - token exchange
  task:
    - "fix code_verifier does not match the challenge"
    - "why does POST /token fail after a real code"
---

`/token` recomputes `SHA256(code_verifier)` and compares it against the
`code_challenge` recorded when the code was issued; a mismatch means the
caller sent a different `code_verifier` than the one whose challenge went
to `/authorize`, usually a fresh PKCE pair generated for a retry instead
of reusing the original. The code is not consumed by a failed check, so a
retry with the CORRECT verifier still works against the same code; a
SECOND wrong attempt, or reuse of an already-exchanged code, is a
distinct replay failure, not an identical typo.

## Examples

### MCP_OAUTH_PKCE_MISMATCH, the real error class the router's own token handler throws

```javascript
// The real class, real message, real serialization: this is exactly what
// the SDK's own token handler throws when SHA256(code_verifier) does not
// equal the recorded code_challenge, verified against the real running
// router (this corpus's own induction,
// packages/registry-tools/test/mcp-oauth-corpus.test.ts).
import { InvalidGrantError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

try {
  throw new InvalidGrantError('code_verifier does not match the challenge');
} catch (error) {
  console.error(JSON.stringify(error.toResponseObject()));
}
```
