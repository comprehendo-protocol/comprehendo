// express Corpus: the inducing calls for every cataloged entry, both kinds.
//
// Like zod, express is a real, direct npm dependency of this package (aliased
// `express5`, `npm:express@^5.0.0`, kept separate from the `express@^4.21.2`
// `mcp-oauth` corpus already depends on for `mcpAuthRouter`'s peer requirement
// — two real installed majors, side by side, neither corpus's induction
// touches the other's).
//
// THREE real, calling-shape twins (app.del, the two path-to-regexp v8 route-
// pattern changes) throw at REGISTRATION time, no server needed at all: a
// bare `app.get(...)`/`app.del(...)` call against a real, throwaway app.
// ONE (req.param) is provoked directly against `express.request`, the real,
// shared prototype object every real request inherits from, no listening
// server and no socket, the exact same real TypeError a real request would
// throw (verified live: aliasing it to a local named `req` and calling
// `req.param(...)` produces the identical message text a real handler's
// crash does). The one STATIC-PATTERN twin (res.send(<number>)) has no
// throw to catch by definition; its real claim (the response really is
// status 200, body "404", not an error) can only be observed against a
// real, working response object, which needs a real request/response cycle
// — a real, listening ephemeral-port server, `http-induction.ts`'s pattern,
// used here directly since express itself is the thing under test.

import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';

import express5 from 'express5';
import type { Express } from 'express5';

const require = createRequire(import.meta.url);

/** The real, installed express5's own reported version. Never assumed. */
export function expressVersion(): string {
  const pkg = require('express5/package.json') as { readonly version: string };
  return pkg.version;
}

// --- runtime-error twins: a real call, a real catch, no server needed ------

export interface RuntimeWitness {
  readonly code: string;
  /** The real call that throws. Not expected to return. */
  readonly provoke: () => unknown;
}

export const RUNTIME_WITNESSES: readonly RuntimeWitness[] = Object.freeze([
  {
    // app.del was REMOVED in v5 (express's own migration guide, "Removed
    // methods"): the alias for app.delete never exists past v4.
    code: 'EXPRESS_APP_DEL_REMOVED',
    provoke: () => {
      const app = express5();
      (app as unknown as { del: (path: string, handler: unknown) => unknown }).del(
        '/x',
        () => undefined,
      );
    },
  },
  {
    // req.param (singular) was REMOVED in v5 (distinct from req.params,
    // plural, still real). Provoked against the real request prototype
    // object every request instance inherits from, not a synthetic double:
    // aliased to a local `req` first, so the real TypeError's own message
    // text (which names the failing expression) matches what a real
    // request handler's crash produces, byte for byte.
    code: 'EXPRESS_REQ_PARAM_REMOVED',
    provoke: () => {
      const req = express5.request as unknown as { param: (name: string) => unknown };
      req.param('id');
    },
  },
  {
    // path-to-regexp went from v6 to v8 under express 5, a real dependency
    // bump with its own breaking route-syntax changes. A bare `*` wildcard
    // is no longer a complete pattern; it now needs a name.
    code: 'EXPRESS_BARE_WILDCARD_REMOVED',
    provoke: () => {
      const app = express5();
      app.get('*', (_req, res) => res.end());
    },
  },
  {
    // Same path-to-regexp v8 bump: the `:name?` optional-parameter suffix
    // is no longer valid route syntax.
    code: 'EXPRESS_OPTIONAL_PARAM_SYNTAX_REMOVED',
    provoke: () => {
      const app = express5();
      app.get('/foo/:bar?', (_req, res) => res.end());
    },
  },
]);

/** One real call, really caught. Throws if the call did NOT throw. */
export function induceRuntime(witness: RuntimeWitness): { readonly errorClass: string; readonly text: string } {
  try {
    witness.provoke();
  } catch (error) {
    const err = error as Error;
    return { errorClass: err.constructor.name, text: err.message };
  }
  throw new Error(`${witness.code}'s witness did not throw against the real, installed express5`);
}

// --- static-pattern twins: no throw to catch, a live-verified claim instead

export interface StaticWitness {
  readonly code: string;
  /** A realistic source snippet the cataloged pattern is written to catch. */
  readonly positiveSample: string;
  /** A structurally-similar snippet that must NOT match (the precision test). */
  readonly nearMiss: string;
  /** Proves the real claim behind the pattern, live, right now. Throws if false. */
  readonly verifyClaim: () => Promise<void>;
}

export const STATIC_WITNESSES: readonly StaticWitness[] = Object.freeze([
  {
    // In v4, `res.send(<number>)` was a deprecated ALIAS for
    // `res.sendStatus(<number>)`: it really set the status code and printed
    // a deprecation warning (confirmed live against a real express@4.22.2
    // during this corpus's own research, not shipped as a dependency here).
    // In v5 the alias is gone with NO warning and NO error: the number is
    // sent as the literal response BODY instead, status stays 200. Nothing
    // throws, so a real listening server and a real request are the only
    // way to observe the real, wrong response.
    code: 'EXPRESS_RES_SEND_NUMBER_NO_LONGER_SETS_STATUS',
    positiveSample: 'res.send(404)',
    nearMiss: 'res.sendStatus(404)',
    verifyClaim: async (): Promise<void> => {
      const app = express5();
      app.get('/status-test', (_req, res) => res.send(404));
      const server = app.listen(0);
      try {
        await new Promise<void>((resolve) => server.once('listening', resolve));
        const { port } = server.address() as AddressInfo;
        const response = await fetch(`http://127.0.0.1:${String(port)}/status-test`);
        const body = await response.text();
        if (response.status !== 200) {
          throw new Error(
            `expected res.send(404) to leave the real status at 200 (the drift this twin catalogs); got ${String(response.status)}`,
          );
        }
        if (body !== '404') {
          throw new Error(
            `expected res.send(404)'s real body to be the literal string "404"; got ${JSON.stringify(body)}`,
          );
        }
      } finally {
        server.close();
      }
    },
  },
]);
