// mcp-oauth Corpus: the inducing HTTP request for every cataloged entry,
// against the REAL `@modelcontextprotocol/sdk` `mcpAuthRouter`, real
// `OAuthServerProvider` implementation (`mcp-oauth-server.ts`), real
// server. Every response below was captured live before being written down
// (`node scripts` is not how this runs; a scratch vitest test printed each
// real body, then this file was written from that real output); nothing
// here is remembered.

import {
  DemoOAuthServerProvider,
  realAuthorizationCode,
  realPkcePair,
  registerRealClient,
} from './mcp-oauth-server.js';
import type { HttpResponse, HttpWitness } from './http-induction.js';

/** The version this corpus's induction is pinned against (`manifest.json`). */
export const SDK_VERSION = '1.30.0';

const REDIRECT_URI = 'http://example.com/callback';

async function asHttpResponse(response: Response): Promise<HttpResponse> {
  return { status: response.status, text: await response.text() };
}

export const WITNESSES: readonly HttpWitness[] = Object.freeze([
  {
    code: 'MCP_OAUTH_UNREGISTERED_CLIENT',
    request: async (baseUrl: string): Promise<HttpResponse> => {
      const url = new URL(`${baseUrl}/authorize`);
      url.searchParams.set('client_id', 'not-a-real-registered-client');
      url.searchParams.set('redirect_uri', REDIRECT_URI);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('code_challenge', 'x');
      url.searchParams.set('code_challenge_method', 'S256');
      return asHttpResponse(await fetch(url));
    },
    captures: [{ versions: '1.30.0', status: 400, text: '"error":"invalid_client","error_description":"Invalid client_id"' }],
  },
  {
    code: 'MCP_OAUTH_REDIRECT_URI_MISMATCH',
    request: async (baseUrl: string): Promise<HttpResponse> => {
      const client = await registerRealClient(baseUrl, [REDIRECT_URI]);
      const url = new URL(`${baseUrl}/authorize`);
      url.searchParams.set('client_id', client.clientId);
      url.searchParams.set('redirect_uri', 'http://attacker.example/callback');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('code_challenge', 'x');
      url.searchParams.set('code_challenge_method', 'S256');
      return asHttpResponse(await fetch(url));
    },
    captures: [
      { versions: '1.30.0', status: 400, text: '"error":"invalid_request","error_description":"Unregistered redirect_uri"' },
    ],
  },
  {
    code: 'MCP_OAUTH_PKCE_MISMATCH',
    request: async (baseUrl: string): Promise<HttpResponse> => {
      const client = await registerRealClient(baseUrl, [REDIRECT_URI]);
      const pkce = await realPkcePair();
      const code = await realAuthorizationCode(baseUrl, client.clientId, REDIRECT_URI, pkce.challenge);
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: 'wrong-verifier-not-the-real-one',
          client_id: client.clientId,
        }),
      });
      return asHttpResponse(response);
    },
    captures: [
      {
        versions: '1.30.0',
        status: 400,
        text: '"error":"invalid_grant","error_description":"code_verifier does not match the challenge"',
      },
    ],
  },
  {
    code: 'MCP_OAUTH_UNSUPPORTED_GRANT_TYPE',
    request: async (baseUrl: string): Promise<HttpResponse> => {
      const client = await registerRealClient(baseUrl, [REDIRECT_URI]);
      const response = await fetch(`${baseUrl}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: client.clientId }),
      });
      return asHttpResponse(response);
    },
    captures: [
      {
        versions: '1.30.0',
        status: 400,
        text: '"error":"unsupported_grant_type","error_description":"The grant type is not supported by this authorization server."',
      },
    ],
  },
]);

// Kept here rather than in the test file, matching openai-python's own
// `openaiVersion()` precondition: `new DemoOAuthServerProvider()` importing
// cleanly IS the "is the real package installed" check for a same-process
// JS target (there is no separate `--version` probe to run).
export function requireRealSdk(): void {
  new DemoOAuthServerProvider();
}
