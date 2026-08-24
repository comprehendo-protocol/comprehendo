// corpora/mcp-oauth's real target: a real Express app mounting the REAL
// `@modelcontextprotocol/sdk` OAuth authorization-server router
// (`server/auth/router.js#mcpAuthRouter`) against a MINIMAL, real,
// generalized `OAuthServerProvider` implementation, the same shape a
// single-owner MCP server (no external IdP to proxy to) implements for
// real. Nothing here is a double of the SDK: every route, every validation,
// every error class is the SDK's own, real, imported code.
//
// This is the "I am my own authorization server" case the SDK ships no
// built-in provider for (only `ProxyOAuthServerProvider`, for delegating to
// an external IdP, exists as a built-in). See corpora/mcp-oauth/README.md.

import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Response } from 'express';

// Deep imports, not the `./server` barrel: the barrel does not re-export the
// auth submodule (confirmed by reading `dist/esm/server/index.js`), but the
// package's own `exports` map (`"./*"`) makes every dist path importable.
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { InvalidGrantError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  AuthInfo,
} from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

/** In-memory client registry: `POST /register` is how a real client arrives. */
class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private readonly clients = new Map<string, OAuthClientInformationFull>();

  getClient(clientId: string): OAuthClientInformationFull | undefined {
    return this.clients.get(clientId);
  }

  registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): OAuthClientInformationFull {
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(full.client_id, full);
    return full;
  }
}

interface IssuedCode {
  readonly clientId: string;
  readonly codeChallenge: string;
  used: boolean;
}

interface IssuedToken {
  readonly clientId: string;
}

/**
 * The minimal, real implementation of `OAuthServerProvider` a single-owner
 * server (this corpus's whole subject) writes by hand: no external IdP,
 * every code and token is this process's own. `authorize()` mints a real,
 * single-use code and redirects; `exchangeAuthorizationCode()` consumes it.
 * `challengeForAuthorizationCode()` is called by the SDK's OWN token
 * handler, before this provider's `exchangeAuthorizationCode`, to verify
 * PKCE itself (see `token.js`); this provider does not re-verify it.
 */
export class DemoOAuthServerProvider implements OAuthServerProvider {
  readonly clientsStore = new InMemoryClientsStore();
  private readonly codes = new Map<string, IssuedCode>();
  private readonly tokens = new Map<string, IssuedToken>();

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    const code = randomBytes(16).toString('hex');
    this.codes.set(code, { clientId: client.client_id, codeChallenge: params.codeChallenge, used: false });
    const target = new URL(params.redirectUri);
    target.searchParams.set('code', code);
    if (params.state !== undefined) target.searchParams.set('state', params.state);
    res.redirect(302, target.href);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const entry = this.codes.get(authorizationCode);
    if (entry === undefined) throw new InvalidGrantError('unknown authorization code');
    return entry.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    const entry = this.codes.get(authorizationCode);
    if (entry === undefined || entry.used) {
      throw new InvalidGrantError('authorization code is unknown or already used');
    }
    entry.used = true;
    const accessToken = randomBytes(16).toString('hex');
    this.tokens.set(accessToken, { clientId: client.client_id });
    return { access_token: accessToken, token_type: 'bearer', expires_in: 3600 };
  }

  async exchangeRefreshToken(): Promise<OAuthTokens> {
    // Not exercised by this corpus's induction; a real implementation would
    // rotate the refresh token here (see corpora/mcp-oauth's
    // token-lifecycle topic, generalized from RFC 6749 §6).
    throw new Error('refresh_token grant not exercised by this induction workspace');
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const entry = this.tokens.get(token);
    if (entry === undefined) throw new InvalidGrantError('invalid access token');
    return { token, clientId: entry.clientId, scopes: [] };
  }
}

export interface RealServer {
  readonly baseUrl: string;
  readonly provider: DemoOAuthServerProvider;
  readonly close: () => Promise<void>;
}

/**
 * The real target this corpus documents, actually running: a real Express
 * app, the REAL `mcpAuthRouter`, listening on a real ephemeral localhost
 * port. No mocking, no stub HTTP client; every witness makes a real `fetch`
 * against this.
 */
export async function startRealServer(): Promise<RealServer> {
  const provider = new DemoOAuthServerProvider();
  const app = express();
  const issuerUrl = new URL('http://127.0.0.1:0');
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      // Loopback is exempted from the SDK's own HTTPS-issuer requirement
      // (`checkIssuerUrl` in router.js); real, not a workaround.
    }),
  );
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${String(port)}`;
      resolve({
        baseUrl,
        provider,
        close: () =>
          new Promise<void>((closed, reject) => {
            server.close((error) => (error !== undefined ? reject(error) : closed()));
          }),
      });
    });
  });
}

/** A real client, registered for real via a real `POST /register`. */
export async function registerRealClient(
  baseUrl: string,
  redirectUris: readonly string[],
): Promise<{ readonly clientId: string }> {
  const response = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      redirect_uris: [...redirectUris],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (response.status !== 201) {
    throw new Error(`real /register really failed: ${String(response.status)} ${await response.text()}`);
  }
  const body = (await response.json()) as { client_id: string };
  return { clientId: body.client_id };
}

/** A real S256 PKCE pair, computed for real (no library needed, one hash). */
export async function realPkcePair(): Promise<{ readonly verifier: string; readonly challenge: string }> {
  const verifier = randomBytes(32).toString('base64url');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = Buffer.from(digest).toString('base64url');
  return { verifier, challenge };
}

/** A real, single-use authorization code, minted by a real `/authorize` round trip. */
export async function realAuthorizationCode(
  baseUrl: string,
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
): Promise<string> {
  const url = new URL(`${baseUrl}/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  const response = await fetch(url, { redirect: 'manual' });
  if (response.status !== 302) {
    throw new Error(`real /authorize did not redirect: ${String(response.status)} ${await response.text()}`);
  }
  const location = response.headers.get('location');
  if (location === null) throw new Error('real /authorize redirected with no Location header');
  const code = new URL(location).searchParams.get('code');
  if (code === null) throw new Error(`real /authorize redirected with no code: ${location}`);
  return code;
}
