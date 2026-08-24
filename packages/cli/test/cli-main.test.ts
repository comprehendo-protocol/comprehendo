/**
 * Corpus Discovery CLI [NN], the CLI entry surface itself.
 *
 * The in-process describe block asserts argv dispatch: `add` routes here,
 * `init`/`scan`/`diff`/`pack` delegate unchanged to @comprehendo/core, and an
 * unrecognized verb reports THIS package's combined usage (mentioning
 * `add`), not core's narrower one.
 *
 * The real-process describe block crosses the actual process boundary the
 * published bin runs across, the same standard `packages/core/test/
 * cli-main.test.ts` holds itself to. One case in it makes a REAL network
 * call to the real npm registry, deliberately: the whole point of `add` is
 * that it reaches a real registry, and a process-boundary test that mocked
 * that away would prove nothing about the actual wiring `main.ts`'s
 * `realFetcher` does. It targets a package name manufactured to be
 * impossible on the real registry (an npm name cannot contain `!`), so the
 * assertion is on the SHAPE of a real 404 answer, never on a specific
 * corpus's presence or absence, which this project does not control and
 * would make the test flaky. This is the same "irreducible real-network
 * dependency, documented rather than mocked away" precedent
 * corpora/openai-python's own `OPENAI_INVALID_API_KEY` witness sets.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { run, USAGE } from '../src/main.js';

const PACKAGE_ROOT = join(import.meta.dirname, '..');
const CLI = join(PACKAGE_ROOT, 'dist', 'main.js');

beforeAll(() => {
  // The entry surface is a built file invoked as a process, so the test
  // builds it (and the sibling packages it imports off their own dist).
  // Compiling here rather than trusting a stale dist/ is the difference
  // between exercising this build and exercising the last one.
  const tsc = join(PACKAGE_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  for (const pkg of ['../core', '../registry-tools', '.']) {
    const cwd = join(PACKAGE_ROOT, pkg);
    const built = spawnSync(process.execPath, [tsc, '-p', join(cwd, 'tsconfig.json')], {
      cwd,
      encoding: 'utf8',
    });
    expect(built.stdout).toBe('');
    expect(built.status).toBe(0);
  }
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
  it('routes add to this package, not to core', async () => {
    const lines: string[] = [];
    const code = await run(['add', 'totally-not-a-real-package-xyz-123'], (line) => lines.push(line));

    expect(code).toBe(1);
    expect(lines[0]).toContain('no comprehendo corpus published for totally-not-a-real-package-xyz-123');
  });

  it('delegates every other verb to @comprehendo/core unchanged', async () => {
    const lines: string[] = [];
    const code = await run(['scan'], (line) => lines.push(line));

    expect(code).toBe(2);
    // core's own precondition message for `scan` with no corpus, proving
    // this really reached core's runInit/runScan machinery, not a stub.
    expect(lines.join('\n')).toContain('needs a target package');
  });

  it('reports the combined usage, add included, on an unrecognized verb', async () => {
    const lines: string[] = [];
    const code = await run(['explain'], (line) => lines.push(line));

    expect(code).toBe(2);
    const output = lines.join('\n');
    for (const verb of ['init', 'scan', 'diff', 'pack', 'add']) {
      expect(output).toContain(`  ${verb}`);
    }
    expect(USAGE.join('\n')).toContain('comprehendo add <target-package>');
  });

  it('reports the combined usage on no verb at all, exit 2', async () => {
    const lines: string[] = [];
    const code = await run([], (line) => lines.push(line));

    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('unknown verb: (none)');
  });

  it('rejects an unknown add flag and a missing target, both exit 2, neither a stack', async () => {
    const lines: string[] = [];

    expect(await run(['add'], (line) => lines.push(line))).toBe(2);
    expect(await run(['add', 'pkg', '--verbose'], (line) => lines.push(line))).toBe(2);

    const output = lines.join('\n');
    expect(output).toContain('needs a target package');
    expect(output).toContain('unknown flag: --verbose');
    expect(output).not.toContain('    at ');
  });
});

describe('the real process boundary', () => {
  it('spawned as a real process, add really reaches the real npm registry', () => {
    // `!` is not a legal character in an npm package name, so `isValidNpmName`
    // refuses it before any fetch — proving the CLI itself never crashes on
    // a malformed target, real process, real exit code.
    const invalid = invoke('add', 'not!a!valid!name');
    expect(invalid.status).toBe(2);
    expect(invalid.stdout).toContain('is not a shape a real npm package name takes');

    // A legal but certain-to-be-unpublished name: real network round trip,
    // real 404 from the real registry, real exit 1.
    const result = invoke('add', 'totally-not-a-real-package-xyz-123');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('no comprehendo corpus published for totally-not-a-real-package-xyz-123');
    expect(result.stdout).toContain('checked @comprehendo/totally-not-a-real-package-xyz-123');
  }, 30_000);

  it('spawned as a real process, add --json emits one real, parseable record', () => {
    const result = invoke('add', 'totally-not-a-real-package-xyz-123', '--json');
    expect(result.status).toBe(1);
    const record = JSON.parse(result.stdout) as { lookup: { outcome: string } };
    expect(record.lookup.outcome).toBe('not-found');
  }, 30_000);

  it('spawned as a real process, init still works, unchanged, delegated to core', () => {
    const result = invoke('init', '/no/such/target/anywhere');
    expect(result.status).toBe(2);
    expect(result.stdout).toContain('no such target package');
  });
});
