---
topic: discovery-and-deployment
status: ready
stub_fields: []
signatures:
  - "/.well-known/oauth-protected-resource"
  - "/.well-known/oauth-authorization-server"
  - "mcpAuthMetadataRouter"
see_also:
  - claude-connector-oauth
vocabularies_served:
  own_terms:
    - well-known
    - protected resource metadata
    - issuerUrl
  translations:
    - known_tool: nginx
      terms:
        - upstream
        - ingress
    - known_tool: traefik
      terms:
        - entrypoint
        - forwarded headers
  task:
    - "why does claude.ai's connector 404 on discovery"
    - "docker healthcheck failing after adding an IP allowlist"
    - "RFC 9728 well-known suffix"
---

RFC 9728 SS3.1 lets a client append the protected resource's own path to
the well-known suffix: `/.well-known/oauth-protected-resource/mcp` for a
resource that lives at `/mcp`, not only the bare
`/.well-known/oauth-protected-resource`. `claude.ai`'s connector requests
the suffixed form FIRST, falling back to the bare path only after that
404s. A hand-rolled discovery route that only serves the bare path breaks
the whole flow before it starts, silently, because the fallback masks the
problem in a browser but not in a strict client. `mcpAuthMetadataRouter`
mounts the suffixed form automatically whenever the resource server's own
URL carries a path, so this is a non-issue when discovery is mounted
through the router rather than written by hand.

One class of bug only ever shows up against a real deployment, never in a
test suite: an app-level IP allowlist that does not exempt loopback blocks
a container's own Docker `HEALTHCHECK`, which hits `/health` directly at
`127.0.0.1`, bypassing any reverse proxy (Traefik, nginx) entirely, no
forwarded-for header, nothing to allowlist against. The orchestrator reads
the resulting failure as "unhealthy" and cycles the container, which reads
as a mystery restart loop, not as an auth bug. Loopback (`127.0.0.1`,
`::1`, `::ffff:127.0.0.1`) should always be exempt from an app-level
allowlist for exactly this reason: nothing external can ever present as
loopback once a real reverse proxy is the only ingress hop.
