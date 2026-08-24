// corpora/mcp-oauth's fifth real target shape: a REAL browser enforcing a
// REAL `Content-Security-Policy: form-action` directive against a REAL
// cross-origin consent form. The other four twins in this corpus are HTTP
// JSON error bodies the SDK's own router returns (`http-induction.ts`); this
// one is not an SDK failure at all, it is the BROWSER refusing to submit a
// form, which is why it needs its own real target rather than being force-fit
// into the HTTP-JSON shape.
//
// Two real, separate Express origins, exactly as a deployed MCP OAuth server
// really is split: the consent/authorize UI (served from the MCP server's own
// origin) POSTing to the token/authorize endpoint (often a distinct origin or
// port in front of a reverse proxy). A same-origin pair never reproduces this
// bug, so the two must really be different origins, not a shortcut.

import type { AddressInfo } from 'node:net';
import express from 'express';

export interface CspPair {
  /** The consent page's real, running origin. */
  readonly consentUrl: string;
  /** The OAuth server's real, running origin, the form's cross-origin target. */
  readonly mcpUrl: string;
  close(): Promise<void>;
}

function listenEphemeral(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${String(port)}`,
        close: () =>
          new Promise((closed, closeReject) => {
            server.close((error) => (error !== undefined ? closeReject(error) : closed()));
          }),
      });
    });
    server.on('error', reject);
  });
}

/**
 * Starts the real MCP/OAuth origin first (its port is the value the consent
 * origin's CSP header and form `action` both need), then the real consent
 * origin, whose header is built by the caller from the real `mcpUrl`.
 *
 * `buildFormAction(mcpUrl)` returns the real `form-action` directive value to
 * ship: `'self'` alone reproduces the bug (the real, common
 * `helmet()`/hand-written default that never anticipated a cross-origin
 * consent form); `` `'self' ${mcpUrl}` `` is the real fix.
 */
export async function startCspPair(buildFormAction: (mcpUrl: string) => string): Promise<CspPair> {
  const mcpApp = express();
  mcpApp.use(express.urlencoded({ extended: true }));
  mcpApp.post('/oauth/authorize', (_req, res) => res.send('authorized'));
  const mcp = await listenEphemeral(mcpApp);

  const consentApp = express();
  consentApp.get('/', (_req, res) => {
    const formAction = buildFormAction(mcp.url);
    res.setHeader('Content-Security-Policy', `default-src 'self'; form-action ${formAction}`);
    res.send(`<!doctype html>
<html>
<body>
  <h1>Approve this connection</h1>
  <form method="POST" action="${mcp.url}/oauth/authorize">
    <input type="text" name="bridge_token" />
    <button type="submit">Approve</button>
  </form>
</body>
</html>`);
  });
  const consent = await listenEphemeral(consentApp);

  return {
    consentUrl: consent.url,
    mcpUrl: mcp.url,
    close: async () => {
      await consent.close();
      await mcp.close();
    },
  };
}
