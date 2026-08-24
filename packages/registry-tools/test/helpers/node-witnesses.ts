// node Corpus: the inducing invocation for every cataloged entry, and the
// real `node` binary every one of them runs against.
//
// Unlike ffmpeg (a separate binary) and openai-python (a separate
// interpreter this TS runner cannot import), the target here IS the exact
// runtime this test file is already executing under, so induction is the
// simplest possible form of `process-induction.ts`'s pattern: spawn `node`
// again, real script files on disk, real stdout/stderr, no interpreter
// override needed for correctness (COMPREHENDO_NODE exists anyway, matching
// COMPREHENDO_PYTHON's precedent, so CI can still pin a specific build).
//
// Every script below was run against the real installed `node` (24.7.0 and
// 24.8.0, confirmed identical) before it was written down; nothing here is
// remembered. Two real, current findings are worth stating explicitly
// because they correct assumptions training data widely still gets wrong on
// this exact Node line: `require()` of a genuinely synchronous ES module now
// SUCCEEDS (no `ERR_REQUIRE_ESM`), and `import`/`export` syntax in a `.js`
// file with no `"type": "module"` no longer throws a SyntaxError, it is
// auto-detected and reparsed (with a performance-cost warning). Neither is
// cataloged as a twin here, because neither is a failure; both are
// documented in topics/require-of-esm.md's prose instead, exactly the
// "training-lag correction" this corpus exists to carry.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ProcessWitness } from './process-induction.js';

/** The runtime under test. Overridable so CI can pin a specific build. */
export const NODE = process.env['COMPREHENDO_NODE'] ?? 'node';

/** The real interpreter's own reported version, `v` stripped. */
export function nodeVersion(): string {
  try {
    return execFileSync(NODE, ['--version'], { encoding: 'utf8' }).trim().replace(/^v/, '');
  } catch (cause) {
    throw new Error(
      `the node corpus suites need a real node on PATH (or COMPREHENDO_NODE pointing ` +
        `at one) and found none: ${(cause as Error).message}. CC4 [26] ships no entry a ` +
        'test did not provoke, so these suites fail rather than skip: a green run that ' +
        'induced nothing is the folklore the rule exists to catch.',
    );
  }
}

/** One or more files, written to the induction workspace and run for real. */
const files =
  (entries: Readonly<Record<string, string>>) =>
  (cwd: string): void => {
    for (const [name, source] of Object.entries(entries)) writeFileSync(join(cwd, name), source, 'utf8');
  };

export const WITNESSES: readonly ProcessWitness[] = Object.freeze([
  {
    code: 'NODE_REQUIRE_ASYNC_MODULE',
    program: NODE,
    argv: ['require-async.cjs'],
    setup: files({
      'tla.mjs': 'await Promise.resolve();\nexport const hello = () => "hi";\n',
      'require-async.cjs': "require('./tla.mjs');\n",
    }),
    captures: [
      {
        versions: '>=24.7 <25',
        status: 1,
        text: 'ERR_REQUIRE_ASYNC_MODULE',
      },
    ],
  },
  {
    code: 'NODE_DIRNAME_UNDEFINED_IN_ESM',
    program: NODE,
    argv: ['dirname.mjs'],
    setup: files({
      'dirname.mjs': 'console.log(__dirname);\n',
    }),
    captures: [
      {
        versions: '>=24.7 <25',
        status: 1,
        text: 'ReferenceError: __dirname is not defined in ES module scope',
      },
    ],
  },
  {
    code: 'NODE_REQUIRE_UNDEFINED_IN_ESM',
    program: NODE,
    argv: ['require-in-esm.mjs'],
    setup: files({
      'require-in-esm.mjs': "const fs = require('node:fs');\nconsole.log(fs);\n",
    }),
    captures: [
      {
        versions: '>=24.7 <25',
        status: 1,
        text: 'ReferenceError: require is not defined in ES module scope',
      },
    ],
  },
  {
    code: 'NODE_TOP_LEVEL_AWAIT_IN_CJS',
    program: NODE,
    argv: ['tla.cjs'],
    setup: files({
      'tla.cjs': "await Promise.resolve();\nconsole.log('done');\n",
    }),
    captures: [
      {
        versions: '>=24.7 <25',
        status: 1,
        text: 'SyntaxError: await is only valid in async functions and the top level bodies of modules',
      },
    ],
  },
]);
