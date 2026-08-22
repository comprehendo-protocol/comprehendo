/**
 * Corpus Generator [17], `comprehendo diff`: re-scan and report drift. This is
 * the operation Upstream Watch [34] is built on, so its output, its exit code
 * and its refusal to write are all contract, not convenience.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { CliError, runDiff, runInit, runScan, type DriftReport } from '../src/cli/index.js';
import { cleanupWorkspaces, makeWorkspace, snapshot, type Workspace } from './helpers/toy-corpus.js';

afterEach(cleanupWorkspaces);

/** An authored corpus for v1 of the toy target, ready to be diffed. */
function authored(): Workspace {
  const workspace = makeWorkspace();
  runInit(workspace.options());
  runScan(workspace.options());
  workspace.lines.length = 0;
  return workspace;
}

function reportFrom(workspace: Workspace): { code: number; report: DriftReport } {
  const code = runDiff(workspace.options({ json: true }));
  return { code, report: JSON.parse(workspace.lines.join('\n')) as DriftReport };
}

describe('comprehendo diff, no drift', () => {
  it('reports no drift and exits 0 when the corpus matches the target', () => {
    const workspace = authored();

    const code = runDiff(workspace.options());

    expect(code).toBe(0);
    expect(workspace.lines).toContain('drift: 0');
    expect(workspace.lines[0]).toBe('comprehendo diff toy-encoder@1.0.0 (corpus recorded 1.0.0)');
  });

  it('writes nothing at all: the corpus is byte-identical after a diff', () => {
    const workspace = authored();
    const before = snapshot(workspace.corpus);

    runDiff(workspace.options());

    expect(snapshot(workspace.corpus)).toEqual(before);
  });
});

describe('comprehendo diff, drift against a new target version', () => {
  it('reports a changed signature as drift, naming what it was and what it is', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { report } = reportFrom(workspace);

    expect(report.drift).toContainEqual({
      kind: 'signature-changed',
      subject: 'encode',
      was: 'function encode(input: string, options?: EncodeOptions): string',
      now: 'function encode(input: string, codec: string, options?: EncodeOptions): string',
    });
  });

  it('reports a newly exported symbol as a missing topic', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { report } = reportFrom(workspace);

    expect(report.drift).toContainEqual({
      kind: 'topic-missing',
      subject: 'encodeAll',
      now: 'function encodeAll(inputs: readonly string[], codec: string): string[]',
    });
  });

  it('reports a vanished export as an orphaned topic', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { report } = reportFrom(workspace);

    expect(report.drift).toContainEqual({ kind: 'topic-orphaned', subject: 'Codec' });
  });

  it('reports an added throw site as a twin the corpus does not carry', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { report } = reportFrom(workspace);

    expect(report.drift).toContainEqual({
      kind: 'twin-missing',
      subject: 'src/encode.ts#decode#TypeError#wire-is-not-in-the-toy-wire-format',
      now: 'TypeError: wire is not in the toy wire format',
    });
  });

  it('reports a removed throw site as a twin the target no longer raises', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { report } = reportFrom(workspace);

    expect(report.drift).toContainEqual({
      kind: 'twin-orphaned',
      subject: 'src/encode.ts#decode#SyntaxError#wire-format-needs-a-length-prefix',
      was: 'SyntaxError: wire format needs a length prefix',
    });
  });

  it('names the target version it re-scanned against', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    runDiff(workspace.options());

    expect(workspace.lines[0]).toBe('comprehendo diff toy-encoder@2.0.0 (corpus recorded 1.0.0)');
  });

  it('exits 1 when it found drift, so a lock file in CI can act on it', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { code, report } = reportFrom(workspace);

    expect(report.drift.length).toBeGreaterThan(0);
    expect(code).toBe(1);
  });

  it('ignores a pure line-number move, which is formatting, not drift', () => {
    const workspace = authored();
    workspace.edit('src/encode.ts', (text) => `\n\n// a new comment at the top\n${text}`);

    const { code, report } = reportFrom(workspace);

    expect(report.drift).toEqual([]);
    expect(code).toBe(0);
  });
});

describe('comprehendo diff, stubs are reported, never enforced', () => {
  it('reports remaining stub fields separately from drift', () => {
    const workspace = authored();

    const { report } = reportFrom(workspace);

    expect(report.drift).toEqual([]);
    expect(report.stubs).toContainEqual({
      file: 'topics/decode.md',
      record: 'decode',
      field: 'summary',
    });
  });

  it('does not fail its exit code on stubs alone, that is the submission gate', () => {
    const workspace = authored();

    const { code, report } = reportFrom(workspace);

    expect(report.stubs.length).toBeGreaterThan(0);
    expect(code).toBe(0);
  });
});

describe('comprehendo diff, machine-readable output', () => {
  it('emits a JSON drift report with --json', () => {
    const workspace = authored();
    workspace.upgrade('toy-target-next');

    const { report } = reportFrom(workspace);

    expect(report.target).toBe('toy-encoder');
    expect(report.scanned_version).toBe('2.0.0');
    expect(report.corpus_version).toBe('1.0.0');
    expect(Array.isArray(report.drift)).toBe(true);
    expect(Array.isArray(report.stubs)).toBe(true);
  });

  it('refuses to diff a package with no corpus, naming init', () => {
    const workspace = makeWorkspace();

    expect(() => runDiff(workspace.options())).toThrow(CliError);
  });
});
