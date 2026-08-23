// Cold-Agent Benchmark [38]: CC9 Marker Freeze [10], re-run as a release gate.
//
// This file runs SOMEBODY ELSE'S GATE and nothing of its own. CC9 is already
// enforced, in two places, by scans this feature did not write:
//
//   packages/core/test/marker-freeze.test.ts      the JavaScript literal
//   packages/core/test/marker-purity.test.ts      and its import closure
//   packages/python/tests/test_marker_freeze.py   the Python port's literal
//   packages/python/tests/test_marker_purity.py   and its import closure
//
// They are re-invoked here as real subprocesses, with their own runners, so a
// real marker regression really turns this benchmark red. Reimplementing the
// scan would have produced a check that passes while the real one fails, which
// is the failure shape this whole project exists to refuse.
//
// A MISSING INTERPRETER IS A FAILURE, NEVER A SKIP. `python3` on a machine can
// easily be older than the port's floor (3.11+), and a gate that quietly skips
// half of what it claims to verify reports green having checked nothing. Same
// discipline `requireFfmpeg` already applies to CC4 [26].
//
// @see .mdd/docs/10-cc9-marker-freeze.md
// @see .mdd/docs/38-cold-agent-benchmark.md

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** One scan to re-run: whose contract it is, and how it is really invoked. */
export interface Cc9Scan {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/** What the parent observed the child really do. */
export interface Cc9Result {
  readonly name: string;
  readonly invocation: string;
  readonly status: number;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Cc9Report {
  readonly passed: boolean;
  readonly scans: readonly Cc9Result[];
}

/** A precondition the caller can fix. Never a stack trace, always a sentence. */
export class Cc9PreconditionError extends Error {}

const PYTHON_FLOOR = '(3, 11)';

/**
 * An interpreter that can really run the port's suite: 3.11+ with pytest
 * importable. Candidates in order, and a sentence naming what is missing when
 * none of them works.
 */
export function resolvePython(repoRoot: string): string {
  const candidates = [
    process.env['COMPREHENDO_PYTHON'],
    join(repoRoot, 'packages', 'python', '.venv', 'bin', 'python'),
    'python3.13',
    'python3.12',
    'python3.11',
    'python3',
  ].filter((candidate): candidate is string => candidate !== undefined && candidate !== '');

  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate,
      ['-c', `import pytest, sys; assert sys.version_info >= ${PYTHON_FLOOR}`],
      { encoding: 'utf8' },
    );
    if (probe.error === undefined && probe.status === 0) return candidate;
  }
  throw new Cc9PreconditionError(
    "CC9's Python half needs an interpreter that is 3.11 or newer AND has pytest importable, " +
      `and none of ${candidates.join(', ')} is both. Point COMPREHENDO_PYTHON at one, or create ` +
      'packages/python/.venv. This gate fails rather than skipping: a release gate that verifies ' +
      'one of the two implementations it claims to verify has verified nothing about the other.',
  );
}

/** The two scans, resolved against a real checkout. */
export function cc9Scans(repoRoot: string): readonly Cc9Scan[] {
  const core = join(repoRoot, 'packages', 'core');
  const vitest = join(core, 'node_modules', '.bin', 'vitest');
  if (!existsSync(vitest)) {
    throw new Cc9PreconditionError(
      `CC9's JavaScript half is run with ${vitest}, and it is not installed. ` +
        'Run npm install in packages/core.',
    );
  }
  return Object.freeze([
    {
      name: 'CC9 marker freeze, JavaScript core',
      command: vitest,
      args: ['run', 'test/marker-freeze.test.ts', 'test/marker-purity.test.ts'],
      cwd: core,
    },
    {
      name: 'CC9 marker freeze, Python port',
      command: resolvePython(repoRoot),
      args: [
        '-m',
        'pytest',
        'tests/test_marker_freeze.py',
        'tests/test_marker_purity.py',
        '-q',
      ],
      cwd: join(repoRoot, 'packages', 'python'),
    },
  ]);
}

const lastLines = (text: string, count: number): string =>
  text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(-count)
    .join(' | ');

/** Re-run every scan, and report what the children really did. */
export function runCc9Gate(scans: readonly Cc9Scan[]): Cc9Report {
  const results = scans.map((scan): Cc9Result => {
    const child = spawnSync(scan.command, [...scan.args], {
      cwd: scan.cwd,
      encoding: 'utf8',
      timeout: 300_000,
    });
    const invocation = `${scan.command} ${scan.args.join(' ')}`;
    if (child.error !== undefined) {
      return {
        name: scan.name,
        invocation,
        status: -1,
        passed: false,
        detail: child.error.message,
      };
    }
    const status = child.status ?? -1;
    return {
      name: scan.name,
      invocation,
      status,
      passed: status === 0,
      detail: lastLines(`${child.stdout ?? ''}\n${child.stderr ?? ''}`, 3),
    };
  });
  return Object.freeze({ passed: results.every((one) => one.passed), scans: Object.freeze(results) });
}
