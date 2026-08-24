---
topic: claude-connector-oauth
status: ready
stub_fields: []
signatures:
  - "mcpAuthRouter({ provider, issuerUrl, ... })"
  - "OAuthServerProvider"
see_also:
  - unregistered-client
  - discovery-and-deployment
vocabularies_served:
  own_terms:
    - mcpAuthRouter
    - OAuthServerProvider
    - DCR
    - PKCE
  translations:
    - known_tool: express
      terms:
        - middleware
        - router
    - known_tool: passport
      terms:
        - strategy
        - authenticate
  task:
    - "add authentication to an MCP server"
    - "make an MCP server work with claude.ai's custom connector"
    - "OAuth for claude.ai connector"
---

`claude.ai`'s personal "Add custom connector" dialog exposes exactly four
fields: Name, Remote MCP server URL, OAuth Client ID (optional), OAuth
Client Secret (optional). Read those two "(optional)" fields precisely:
they mean a caller MAY pre-supply a client id/secret instead of letting
Dynamic Client Registration self-register one, never that authorization
itself is optional. Adding a connector always routes through a real
authorization page; there is no path that skips it. A server with only a
static-token check (`Authorization: Bearer <token>` compared by hand), or
with no auth at all, cannot be reached from this dialog, full stop; it
needs to become its own OAuth 2.0 authorization server, RFC 7591 Dynamic
Client Registration plus the RFC 6749/7636 PKCE authorization-code flow,
public client, no client secret.

`@modelcontextprotocol/sdk` ships this as real, importable server-side
support, not something to hand-roll from the RFCs: `mcpAuthRouter` (from
`@modelcontextprotocol/sdk/server/auth/router.js`) mounts the well-known
discovery routes, the DCR endpoint, token revocation, and rate limiting for
you; you implement `OAuthServerProvider` (`authorize`, `exchangeAuthorization
Code`, `exchangeRefreshToken`, `verifyAccessToken`) for the one piece that
is genuinely yours to decide, how a caller proves they are allowed in. A
single-owner server with no external identity provider (the common case:
you are the only user, and the "proof" is a secret only you have) implements
this interface directly; the SDK's only built-in implementation,
`ProxyOAuthServerProvider`, is for delegating to an external IdP like Auth0
or Okta instead, a different case.

Mounting `mcpAuthRouter` and implementing `OAuthServerProvider` is the
current, correct starting point. Hand-rolling the routes yourself is
possible but reopens every validation the router gives you for free; see
`unregistered-client`.
