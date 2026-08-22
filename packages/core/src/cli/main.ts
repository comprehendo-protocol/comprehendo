#!/usr/bin/env node
// Corpus Generator [17]: the CLI entry surface.
//
// `comprehendo <verb> <target> [flags]`. Argv parsing lives here and nowhere
// else, so "the verb works" and "the syntax a user types reaches the verb"
// stay two separate, separately tested claims.
//
// Exit codes are part of the contract, because CI reads them:
//   0  the verb did its job
//   1  diff found drift (this is what a lock file in CI acts on)
//   2  a precondition the user can fix (bad usage, missing corpus, stubs)
//   70 a bug in this tool, reported with its stack

import { CliError } from './errors.js';
import { runDiff } from './diff.js';
import { runInit } from './init.js';
import { runPack } from './pack.js';
import { runScan } from './scan.js';
import type { VerbOptions } from './options.js';

type Verb = (options: VerbOptions) => number;

const VERBS: Readonly<Record<string, Verb>> = {
  init: runInit,
  scan: runScan,
  diff: runDiff,
  pack: runPack,
};

const FLAGS_WITH_VALUES = new Set(['--corpus', '--src', '--out']);

export const USAGE = [
  'comprehendo <verb> <target-package> [flags]',
  '',
  '  init   scaffold the five-file corpus for a target package',
  '  scan   pre-fill everything a machine can know; mark the rest status: stub',
  '  diff   re-scan and report what drifted; exits 1 when it found drift',
  '  pack   compile the authored corpus into the packed runtime artifact',
  '',
  '  --corpus <dir>   corpus root (default <target>/comprehendo)',
  '  --src <dir>      source directory inside the target (default src)',
  '  --out <file>     where pack writes (default <target>/comprehendo.packed.json)',
  '  --json           machine-readable output (diff)',
];

export function parseArgs(argv: readonly string[], write: (line: string) => void): VerbOptions & {
  readonly verb: string;
} {
  const [verb, ...rest] = argv;
  if (verb === undefined || VERBS[verb] === undefined) {
    throw new CliError(`unknown verb: ${verb ?? '(none)'}\n${USAGE.join('\n')}`);
  }
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const argument = rest[i] ?? '';
    if (!argument.startsWith('--')) {
      positional.push(argument);
      continue;
    }
    if (argument === '--json') {
      flags['--json'] = 'true';
      continue;
    }
    if (!FLAGS_WITH_VALUES.has(argument)) {
      throw new CliError(`unknown flag: ${argument}\n${USAGE.join('\n')}`);
    }
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CliError(`${argument} needs a value\n${USAGE.join('\n')}`);
    }
    flags[argument] = value;
    i += 1;
  }
  const target = positional[0];
  if (target === undefined) {
    throw new CliError(`comprehendo ${verb} needs a target package\n${USAGE.join('\n')}`);
  }
  return {
    verb,
    target,
    ...(flags['--corpus'] === undefined ? {} : { corpus: flags['--corpus'] }),
    ...(flags['--src'] === undefined ? {} : { source: flags['--src'] }),
    ...(flags['--out'] === undefined ? {} : { out: flags['--out'] }),
    json: flags['--json'] === 'true',
    write,
  };
}

/** The whole CLI as a function: argv in, exit code out, output through `write`. */
export function run(argv: readonly string[], write: (line: string) => void): number {
  try {
    const options = parseArgs(argv, write);
    const verb = VERBS[options.verb];
    return verb === undefined ? 2 : verb(options);
  } catch (error) {
    if (error instanceof CliError) {
      write(`comprehendo: ${error.message}`);
      return error.exitCode;
    }
    // Not a precondition anyone can fix: this is a bug in the tool, and hiding
    // its stack behind a friendly message would only cost the report.
    write(`comprehendo: unexpected failure`);
    write(error instanceof Error ? (error.stack ?? error.message) : String(error));
    return 70;
  }
}

const invokedDirectly = (): boolean => {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url.endsWith(entry.replace(/\\/g, '/'));
};

/**
 * stdout closing early (`comprehendo scan pkg | head`) is a normal way to use a
 * CLI, and an unhandled EPIPE would turn it into a crash report.
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
  process.exitCode = run(process.argv.slice(2), writeLine);
}
