// openai-python Corpus: the inducing invocation for every cataloged entry,
// and the real Python interpreter every one of them runs against.
//
// A Python package cannot be `import()`ed by this TypeScript runner, so
// induction here follows Upstream Watch [34]'s own generalized pattern
// (already reused once for a CLI target, ffmpeg): spawn the real interpreter
// running a real script that really imports the real package, and read what
// it really wrote to stderr. Same evidence standard as `verifyAgainstUpstream`,
// a different real target.
//
// Every script below was run against the real installed `openai` package
// before it was written down; nothing here is remembered.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ProcessWitness } from './process-induction.js';

/** The interpreter under test. Overridable so CI can point at a pinned venv. */
export const PYTHON = process.env['COMPREHENDO_PYTHON'] ?? 'python3';

/** The version string the real interpreter's `openai` package reports. */
export function openaiVersion(): string {
  try {
    return execFileSync(PYTHON, ['-c', 'import openai; print(openai.__version__)'], {
      encoding: 'utf8',
    }).trim();
  } catch (cause) {
    throw new Error(
      `the openai-python corpus suites need a real Python with openai installed (or ` +
        `COMPREHENDO_PYTHON pointing at one) and found none: ${(cause as Error).message}. ` +
        'CC4 [26] ships no entry a test did not provoke, so these suites fail rather than skip: ' +
        'a green run that induced nothing is the folklore the rule exists to catch.',
    );
  }
}

/** One Python script, written to the workspace and run for real. */
function pythonScript(name: string, source: string): (cwd: string) => void {
  return (cwd: string): void => void writeFileSync(join(cwd, name), source, 'utf8');
}

/** Obviously not a real credential: no provider's real key format starts this way. */
const NOT_A_REAL_KEY = 'comprehendo-test-placeholder-not-a-real-key-000000';

export const WITNESSES: readonly ProcessWitness[] = Object.freeze([
  {
    code: 'OPENAI_API_REMOVED_V0',
    program: PYTHON,
    argv: ['removed.py'],
    setup: pythonScript(
      'removed.py',
      'import openai\nopenai.ChatCompletion.create(model="gpt-4", messages=[])\n',
    ),
    captures: [
      {
        versions: '>=2.35 <4',
        status: 1,
        text: 'You tried to access openai.ChatCompletion, but this is no longer supported in openai>=1.0.0',
      },
    ],
  },
  {
    code: 'OPENAI_MISSING_API_KEY',
    program: PYTHON,
    argv: ['missing_key.py'],
    setup: pythonScript(
      'missing_key.py',
      'import openai\nclient = openai.OpenAI()\nclient.chat.completions.create(model="gpt-4", messages=[])\n',
    ),
    // OPENAI_API_KEY must not leak in from the real environment, or this
    // witness would silently fall through to a real network call instead
    // of the client-side check it is supposed to induce.
    unsetEnv: ['OPENAI_API_KEY', 'OPENAI_ADMIN_KEY'],
    // Real drift, bisected live: openai<2.35 raises this same client-side
    // check with different wording entirely ("The api_key client option
    // must be set either by passing api_key to the client or by setting
    // the OPENAI_API_KEY environment variable"), confirmed at 1.0.0 through
    // 2.33.0 and changed as of 2.35.0. `target.versions` is narrowed to
    // >=2.35 rather than widened with a second capture, because a glob
    // pattern loose enough to cover both wordings would also be loose
    // enough to collide with unrelated messages (fingerprint precision over
    // recall). See corpora/openai-python/README.md.
    captures: [
      {
        versions: '>=2.35 <4',
        status: 1,
        text: 'Missing credentials. Please pass an `api_key`',
      },
    ],
  },
  {
    code: 'OPENAI_INVALID_API_KEY',
    program: PYTHON,
    argv: ['invalid_key.py'],
    setup: pythonScript(
      'invalid_key.py',
      'import openai\n' +
        `client = openai.OpenAI(api_key="${NOT_A_REAL_KEY}")\n` +
        'client.chat.completions.create(model="gpt-4", messages=[{"role": "user", "content": "hi"}])\n',
    ),
    // A REAL network round trip to api.openai.com: this is the one witness
    // in this corpus that depends on a third-party service's reachability,
    // not only on the package being installed. Recorded in the corpus
    // README, not hidden.
    captures: [
      {
        versions: '>=2.35 <4',
        status: 1,
        text: 'Incorrect API key provided: ',
      },
    ],
  },
]);
