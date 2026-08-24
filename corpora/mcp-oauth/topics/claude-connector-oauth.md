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
    - "does my MCP server need auth for claude.ai vs Claude Code"
---

This is about `claude.ai`'s own web "Add custom connector" dialog, a
different integration path from Claude Code's MCP setup (`.mcp.json`,
`claude mcp add`), which commonly needs no auth (local stdio, or a remote
server you already trust). None of this applies there.

The dialog has four fields: Name, Remote MCP server URL, OAuth Client ID
(optional), OAuth Client Secret (optional). A genuinely authless server
(every request answered, nothing checked) connects and works, confirmed
live, `initialize`/`tools/list` complete with no OAuth step when nothing
401s, and reachable-by-anyone is exactly the tradeoff that makes, a real
choice, never a silent default. A narrower, easier mistake: a server that
already checks a STATIC secret by hand (`Authorization: Bearer <token>`
compared in code, 401 without it) is protected with no credential path
this dialog can satisfy, there is no field for a static token, so
claude.ai tries the OAuth discovery it always attempts on a 401 and fails
to register with a service that was never built. "Authless" and
"hand-protected" look identical from a task description; only one needs
anything below.

`@modelcontextprotocol/sdk` ships this as real, importable server-side
support: `mcpAuthRouter` (`@modelcontextprotocol/sdk/server/auth/router.js`)
mounts discovery, DCR, revocation and rate limiting for you; implement
`OAuthServerProvider` (`authorize`, `exchangeAuthorizationCode`,
`exchangeRefreshToken`, `verifyAccessToken`) for the one piece that is
genuinely yours, how a caller proves they are allowed in. A single-owner
server with no external IdP (only user, "proof" is a secret only you
have) implements this directly; `ProxyOAuthServerProvider` delegates to
Auth0/Okta instead. Hand-rolling instead of mounting
`mcpAuthRouter` reopens every validation it gives free; see
`unregistered-client`.
