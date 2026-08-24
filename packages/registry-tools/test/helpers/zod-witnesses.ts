// zod Corpus: the inducing calls for every cataloged entry, both kinds.
//
// zod is a real, direct npm dependency of this package (unlike ffmpeg, a
// spawned CLI, or openai, a spawned Python script): there is no process to
// spawn and no runtime boundary to cross, so induction here is the plainest
// possible form CC4 [26] asks for, call the real, installed package directly
// and observe what it really does. `runtime-error` twins are caught real
// throws; `static-pattern` twins have no throw to catch by definition (see
// each one's own comment below), so their evidence is a real, live-verified
// behavioral or compile-time claim instead, cited inline, never invented.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { z } from 'zod';

/**
 * Real zod, real tsc, resolved for real: TypeScript's module resolution
 * walks UP from the checked FILE's own path looking for `node_modules`,
 * never from `cwd`, the identical reason `docs-transcript-workspace.ts`'s
 * `invokeJavaScript` writes its own scratch files inside this package's
 * tree rather than the system tmpdir. `zod` and `typescript` are both real
 * devDependencies of `packages/registry-tools` (see `package.json`), so a
 * scratch file written here resolves both for real, no NODE_PATH trick.
 */
const RESOLUTION_ROOT = join(import.meta.dirname, '..', '..');

const require = createRequire(import.meta.url);

/** The real, installed zod's own reported version. Never assumed. */
export function zodVersion(): string {
  const pkg = require('zod/package.json') as { readonly version: string };
  return pkg.version;
}

// --- runtime-error twins: a real call, a real catch --------------------------

export interface RuntimeWitness {
  readonly code: string;
  /** The call that really throws. Not expected to return. */
  readonly provoke: () => unknown;
}

export const RUNTIME_WITNESSES: readonly RuntimeWitness[] = Object.freeze([
  {
    // .optional() widens to accept `undefined`, never `null`. Real, minimal
    // repro: a string schema, marked optional, handed a literal null.
    code: 'ZOD_OPTIONAL_REJECTS_NULL',
    provoke: () => z.string().optional().parse(null),
  },
  {
    // .deepPartial() was REMOVED in v4 (zod's own migration guide, "Removed"
    // section, not "Deprecated"), so calling it throws a real TypeError, not
    // a ZodError: it never reaches validation at all.
    code: 'ZOD_DEEP_PARTIAL_REMOVED',
    provoke: () => (z.object({ a: z.string() }) as unknown as { deepPartial: () => unknown }).deepPartial(),
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
  throw new Error(`${witness.code}'s witness did not throw against the real, installed zod`);
}

// --- static-pattern twins: no throw to catch, a live-verified claim instead --

export interface StaticWitness {
  readonly code: string;
  /** A realistic source snippet the cataloged pattern is written to catch. */
  readonly positiveSample: string;
  /** A structurally-similar snippet that must NOT match (the precision test). */
  readonly nearMiss: string;
  /** Proves the real claim behind the pattern, live, right now. Throws if false. */
  readonly verifyClaim: () => void;
}

export const STATIC_WITNESSES: readonly StaticWitness[] = Object.freeze([
  {
    code: 'ZOD_REQUIRED_ERROR_PARAM_IGNORED',
    positiveSample: 'z.string({ required_error: "Name is required" })',
    nearMiss: 'z.string({ error: "Name is required" })',
    // Real, live, TWO-PART claim, both confirmed live against this exact
    // real zod: a TypeScript build REJECTS this call outright (a real
    // TS2353 "Object literal may only specify known properties", confirmed
    // by `tsc` refusing this very file's literal `{ required_error: ... }`
    // until cast through `unknown`, deliberately, right here, to reach the
    // plain-JS behavior underneath); a caller who bypasses that (plain JS,
    // `as any`, `@ts-ignore`) gets THROUGH to construction with no error at
    // all, and the custom message is silently dropped at validation time.
    // The pattern is cataloged for the second, quieter case: a TS build
    // already catches the first one for free.
    verifyClaim: (): void => {
      const params = { required_error: 'Name is required' } as unknown as { error: string };
      const schema = z.string(params);
      const result = schema.safeParse(undefined);
      if (result.success) throw new Error('expected the schema to reject undefined');
      const message = result.error.issues[0]?.message ?? '';
      if (message.includes('Name is required')) {
        throw new Error(
          `required_error was NOT silently ignored against this real zod (message: ${message}); the claim this twin makes no longer holds, drift`,
        );
      }
      if (!message.includes('Invalid input')) {
        throw new Error(`unexpected message shape, cannot confirm the default fired: ${message}`);
      }
    },
  },
  {
    code: 'ZOD_RECORD_SINGLE_ARG_REJECTED',
    positiveSample: 'z.record(z.string())',
    nearMiss: 'z.record(z.string(), z.number())',
    // Real, live claim: this is a genuine, current TS compile error against
    // the real, installed zod's own .d.ts, not a guess about its types. A
    // real tsc invocation, real error code, checked live.
    verifyClaim: (): void => {
      const site = mkdtempSync(join(RESOLUTION_ROOT, '.zod-static-scratch-'));
      try {
        writeFileSync(
          join(site, 'check.ts'),
          "import { z } from 'zod';\nconst s = z.record(z.string());\n",
          'utf8',
        );
        writeFileSync(
          join(site, 'tsconfig.json'),
          JSON.stringify({
            compilerOptions: {
              strict: true,
              module: 'nodenext',
              moduleResolution: 'nodenext',
              noEmit: true,
              types: [],
            },
          }),
          'utf8',
        );
        const tscBin = join(RESOLUTION_ROOT, 'node_modules', '.bin', 'tsc');
        let output = '';
        let threw = false;
        try {
          execFileSync(tscBin, ['-p', 'tsconfig.json'], { cwd: site, encoding: 'utf8' });
        } catch (error) {
          threw = true;
          output = (error as { stdout?: string }).stdout ?? '';
        }
        if (!threw || !output.includes('TS2554')) {
          throw new Error(
            `expected a real TS2554 "Expected 2-3 arguments" error against the real, installed zod's types; got: ${threw ? output : 'tsc did not fail at all, drift'}`,
          );
        }
      } finally {
        rmSync(site, { recursive: true, force: true });
      }
    },
  },
]);
