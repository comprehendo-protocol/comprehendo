#!/usr/bin/env node
// Corpus Discovery CLI [NN]: the published `comprehendo` bin. Five verbs,
// one process: `init`/`scan`/`diff`/`pack` are @comprehendo/core's own,
// unchanged, delegated here without alteration (this package never
// reimplements them, so there is exactly one copy of author-side corpus
// tooling to keep correct); `add` is the one new, network-touching verb
// that could not live inside @comprehendo/core at all, because CC6 No
// Telemetry [27] requires zero network code anywhere in that package. This
// is why `add` gets its OWN small argv parser rather than reusing @core's
// `parseArgs`, whose `target` positional means "a local directory to
// resolve and scan" for the other four verbs; `add`'s `target` means "an
// npm package name to look up", a different meaning `parseArgs` was never
// built to carry.
//
// Exit codes, the same contract Corpus Generator [17] already established,
// carried through unchanged for the delegated verbs and matched here for
// `add` (see add.ts's own exitCodeFor for the exact mapping):
//   0  the verb did its job
//   1  drift found (diff) / no corpus published for this target (add)
//   2  a precondition the caller can fix
//   70 a bug in this tool

import { CliError, run as runCore, USAGE as CORE_USAGE } from '../../core/dist/cli/index.js';

import { runAdd } from './add.js';
import { realInstaller } from './installer.js';
import type { Fetcher } from './registry-lookup.js';

const ADD_USAGE: readonly string[] = Object.freeze([
  '',
  '  add    check whether a comprehendo corpus is published for a target',
  '         package, and optionally install it',
  '',
  '  comprehendo add <target-package> [--install] [--json]',
  '',
  '  --install   run "npm install --save-dev" once the corpus is confirmed',
  '              to exist (default: print the command instead of running it)',
  '  --json      machine-readable output (add)',
]);

export const USAGE: readonly string[] = Object.freeze([...CORE_USAGE, ...ADD_USAGE]);

/**
 * @comprehendo/core's own four verbs, named here rather than imported: `run`,
 * `USAGE` and `CliError` are its module surface, but its internal `VERBS` map
 * is not exported, and duplicating four stable, already-frozen verb names is
 * cheaper and more honest than reaching past the export boundary to avoid it.
 * Needed so an unrecognized verb here reports THIS package's combined usage
 * (mentioning `add`) rather than core's own narrower one.
 */
const CORE_VERBS = new Set(['init', 'scan', 'diff', 'pack']);

interface AddArgs {
  readonly target: string;
  readonly install: boolean;
  readonly json: boolean;
}

function parseAddArgs(argv: readonly string[]): AddArgs {
  const positional: string[] = [];
  let install = false;
  let json = false;
  for (const argument of argv) {
    if (argument === '--install') {
      install = true;
      continue;
    }
    if (argument === '--json') {
      json = true;
      continue;
    }
    if (argument.startsWith('--')) {
      throw new CliError(`unknown flag: ${argument}\n${USAGE.join('\n')}`);
    }
    positional.push(argument);
  }
  const target = positional[0];
  if (target === undefined) {
    throw new CliError(`comprehendo add needs a target package\n${USAGE.join('\n')}`);
  }
  if (positional.length > 1) {
    throw new CliError(`one target package at a time, got ${String(positional.length)}`);
  }
  return { target, install, json };
}

/** `fetch` itself is the one seam this whole package exists to hold; real by default, injected only in tests. */
const realFetcher: Fetcher = (url) => fetch(url);

/** The whole CLI as a function: argv in, exit code out, output through `write`. */
export async function run(argv: readonly string[], write: (line: string) => void): Promise<number> {
  const [verb, ...rest] = argv;
  if (verb !== undefined && CORE_VERBS.has(verb)) {
    return runCore(argv, write);
  }
  if (verb !== 'add') {
    write(`comprehendo: unknown verb: ${verb ?? '(none)'}\n${USAGE.join('\n')}`);
    return 2;
  }
  try {
    const args = parseAddArgs(rest);
    return await runAdd(
      { ...args, write },
      { fetcher: realFetcher, installer: realInstaller, cwd: process.cwd() },
    );
  } catch (error) {
    if (error instanceof CliError) {
      write(`comprehendo: ${error.message}`);
      return error.exitCode;
    }
    // Not a precondition anyone can fix: this is a bug in the tool, and
    // hiding its stack behind a friendly message would only cost the report.
    write('comprehendo: unexpected failure');
    write(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return 70;
  }
}

const invokedDirectly = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url.endsWith(entry.replace(/\\/g, '/'));
};

/**
 * stdout closing early (`comprehendo add pkg | head`) is a normal way to use
 * a CLI, and an unhandled EPIPE would turn it into a crash report.
 */
function writeLine(line: string): void {
  try {
    process.stdout.write(`${line}\n`);
  } catch {
    process.exitCode = 0;
  }
}

if (invokedDirectly()) {
  process.stdout.on('error', () => undefined);
  // Explicit fire-and-forget: the entry point has no caller to return a
  // promise to, `process.exitCode` is how a Node CLI process reports back.
  void run(process.argv.slice(2), writeLine).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      writeLine('comprehendo: unexpected failure');
      writeLine(error instanceof Error ? (error.stack ?? error.message) : String(error));
      process.exitCode = 70;
    },
  );
}
