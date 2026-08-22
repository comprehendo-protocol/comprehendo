/**
 * Corpus Generator [17], the CLI entry surface itself.
 *
 * Two different claims live here. That the verbs work is the other
 * cli-*.test.ts files' job; this file asserts that the argv a user actually
 * types reaches them, and the last describe crosses the REAL process boundary,
 * compiling the package and spawning the built CLI, because a child that
 * writes files and an exit code the parent never observes is exactly the
 * failure an in-process suite cannot see.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { USAGE, run } from '../src/cli/index.js';
import { cleanupWorkspaces, fillEveryStub, makeWorkspace } from './helpers/toy-corpus.js';

const PACKAGE_ROOT = join(import.meta.dirname, '..');
const CLI = join(PACKAGE_ROOT, 'dist', 'cli', 'main.js');

afterEach(cleanupWorkspaces);

beforeAll(() => {
  // The entry surface is a built file invoked as a process, so the test builds
  // it. Compiling here rather than trusting a stale dist/ is the difference
  // between exercising this build and exercising the last one.
  const tsc = join(PACKAGE_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  const built = spawnSync(process.execPath, [tsc, '-p', join(PACKAGE_ROOT, 'tsconfig.json')], {
    cwd: PACKAGE_ROOT,
    encoding: 'utf8',
  });
  expect(built.stdout).toBe('');
  expect(built.status).toBe(0);
  expect(existsSync(CLI)).toBe(true);
}, 120_000);

interface Invocation {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

const invoke = (...args: string[]): Invocation => {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
};

describe('argv dispatch', () => {
  it('routes each documented verb to its handler', () => {
    const workspace = makeWorkspace();
    const lines = workspace.lines;
    const write = (line: string): number => lines.push(line);

    expect(run(['init', workspace.target], write)).toBe(0);
    expect(run(['scan', workspace.target], write)).toBe(0);
    expect(run(['diff', workspace.target], write)).toBe(0);
    fillEveryStub(workspace.corpus);
    expect(run(['pack', workspace.target], write)).toBe(0);

    expect(lines.filter((line) => line.startsWith('comprehendo '))).toEqual([
      'comprehendo init toy-encoder@1.0.0',
      'comprehendo scan toy-encoder@1.0.0 (src/)',
      'comprehendo diff toy-encoder@1.0.0 (corpus recorded 1.0.0)',
      `comprehendo pack toy-encoder -> ${join(workspace.target, 'comprehendo.packed.json')}`,
    ]);
  });

  it('prints usage listing every verb and exits 2 on an unknown verb', () => {
    const lines: string[] = [];

    const code = run(['explain', './pkg'], (line) => lines.push(line));

    expect(code).toBe(2);
    const output = lines.join('\n');
    for (const verb of ['init', 'scan', 'diff', 'pack']) {
      expect(output).toContain(`  ${verb}   `);
    }
    expect(USAGE[0]).toBe('comprehendo <verb> <target-package> [flags]');
  });

  it('prints usage and exits 2 when no target package is given', () => {
    const lines: string[] = [];

    const code = run(['scan'], (line) => lines.push(line));

    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('needs a target package');
  });

  it('accepts the documented flags and rejects an unknown one', () => {
    const workspace = makeWorkspace();
    const elsewhere = join(workspace.target, '..', 'elsewhere');
    const lines: string[] = [];
    const write = (line: string): number => lines.push(line);

    expect(run(['init', workspace.target, '--corpus', elsewhere], write)).toBe(0);
    expect(existsSync(join(elsewhere, 'index.json'))).toBe(true);
    expect(run(['init', workspace.target, '--verbose'], write)).toBe(2);
    expect(run(['init', workspace.target, '--corpus'], write)).toBe(2);
    expect(lines.join('\n')).toContain('unknown flag: --verbose');
    expect(lines.join('\n')).toContain('--corpus needs a value');
  });

  it('reports a precondition failure as a message, never a raw stack', () => {
    const workspace = makeWorkspace();
    const lines: string[] = [];

    const code = run(['scan', workspace.target], (line) => lines.push(line));

    expect(code).toBe(2);
    expect(lines[0]).toContain('comprehendo: no corpus at');
    expect(lines.join('\n')).not.toContain('    at ');
  });
});

describe('the real process boundary', () => {
  it('spawned as a real process, init writes the corpus the parent then reads', () => {
    const workspace = makeWorkspace();

    const result = invoke('init', workspace.target);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('comprehendo init toy-encoder@1.0.0');
    // The parent observes what the child recorded, not just what it printed.
    const index = JSON.parse(readFileSync(join(workspace.corpus, 'index.json'), 'utf8')) as {
      provider: string;
    };
    expect(index.provider).toBe('toy-encoder');
    for (const file of ['manifest.json', 'twins.json', 'fixes.json', 'topics']) {
      expect(existsSync(join(workspace.corpus, file))).toBe(true);
    }
  });

  it('spawned as a real process, a refused overwrite reaches the parent as exit 2', () => {
    const workspace = makeWorkspace();
    expect(invoke('init', workspace.target).status).toBe(0);

    const second = invoke('init', workspace.target);

    expect(second.status).toBe(2);
    expect(second.stdout).toContain('refuses to overwrite');
  });

  it('spawned as a real process, diff reports drift to the parent as exit 1', () => {
    const workspace = makeWorkspace();
    invoke('init', workspace.target);
    invoke('scan', workspace.target);
    workspace.upgrade('toy-target-next');

    const diffed = invoke('diff', workspace.target, '--json');

    expect(diffed.status).toBe(1);
    const report = JSON.parse(diffed.stdout) as { drift: readonly { kind: string }[] };
    expect(report.drift.map((entry) => entry.kind)).toContain('signature-changed');
  });
});
