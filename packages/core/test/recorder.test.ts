/**
 * Recorder [16]: the optional maintainer black box.
 *
 * Three claims, all of them falsifiable here rather than asserted:
 *   1. Off by default, and zero overhead when off (the "wrapped" provider is
 *      the SAME object, so there is no per-call indirection to pay for).
 *   2. Every call through every surface (twin, docs, validate, explain) is
 *      captured in BOTH directions, with a timestamp, against REAL calls: a
 *      real twin built from the toy catalog, a real docs() lookup, real
 *      validate/explain hooks.
 *   3. Nothing in this module can reach a network (CC6 [27]), scanned
 *      statically over recorder.ts and its whole relative import closure,
 *      because a transitive import is exactly what would defeat the claim.
 *
 * The provider under test is the same toy package the SDK Entry [14] suites
 * build, so what the recorder wraps is a real provider, never a stand-in.
 *
 * Temp-dir helpers are local to this file on purpose: packages/core/test/
 * carries no filesystem helper module, and creating one here would be an
 * unowned shared file (docs-miss-log.test.ts made the same call).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { hasMarker, probe } from '../src/marker.js';
import { makeProvider, type Provider } from '../src/sdk.js';
import type { LookupRecord } from '../src/docs.js';
import type { Twin } from '../src/twin.js';
import {
  DEFAULT_RECORDING_PATH,
  recordProvider,
  recordingOf,
  type CallRecord,
} from '../src/recorder.js';
import { readCoreSources, transitiveImportClosure } from './helpers/source-scan.js';
import {
  TOY_RAW_CATALOGED,
  TOY_RAW_NOVEL,
  toyCorpus,
  toyHooks,
  toyRuntime,
  type ToyOptions,
} from './helpers/toy-provider.js';

const toy = (options: ToyOptions = {}): Provider =>
  makeProvider(options.corpus ?? toyCorpus(), toyHooks(options));

const dirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'comprehendo-recorder-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const readLog = (path: string): CallRecord[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as CallRecord);

const at = (iso: string) => (): Date => new Date(iso);

/** A collecting sink plus the records it saw, the injected-sink path. */
const collector = (): { seen: CallRecord[]; sink: (record: CallRecord) => void } => {
  const seen: CallRecord[] = [];
  return { seen, sink: (record: CallRecord): void => void seen.push(record) };
};

/** The pipeline the toy judge answers cleanly, and the one it twins. */
const CLEAN_PIPELINE = [{ $match: { userId: 7 } }];
const SPILL_PIPELINE = [{ $sort: { createdAt: -1 } }];

const payloadOf = (record: CallRecord | undefined): Record<string, unknown> =>
  (record?.payload ?? {}) as Record<string, unknown>;

describe('recording is opt-in, and off is genuinely off', () => {
  it('hands back the very same provider when nothing enables it', () => {
    const provider = toy();

    expect(recordProvider(provider)).toBe(provider);
    expect(recordProvider(provider, {})).toBe(provider);
    expect(recordProvider(provider, { enabled: false })).toBe(provider);
  });

  it('costs nothing when off: no wrapper, no indirection, not even on the surfaces', () => {
    const provider = toy();
    const { sink } = collector();

    const off = recordProvider(provider, { enabled: false, sink });

    // Identity on every surface is what "zero overhead" MEANS here: the caller
    // is holding the original closures, so there is no per-call work to pay.
    expect(off).toBe(provider);
    expect(off.docs).toBe(provider.docs);
    // Read through an index accessor rather than `off.twinFor`: these three are
    // declared as METHODS on Provider, and naming one without calling it is
    // what `@typescript-eslint/unbound-method` (correctly) refuses.
    for (const key of ['twinFor', 'errorFor', 'raise'] as const) {
      const original = (provider as unknown as Record<string, unknown>)[key];
      expect(typeof original, `provider.${key} is not a function`).toBe('function');
      expect((off as unknown as Record<string, unknown>)[key]).toBe(original);
    }
    expect(off.validate).toBe(provider.validate);
    expect(off.explain).toBe(provider.explain);
    expect(recordingOf(off)).toBeUndefined();
  });

  it('records nothing at all when off, across all four surfaces', () => {
    const provider = toy();
    const { seen, sink } = collector();

    const off = recordProvider(provider, { enabled: false, sink });
    off.docs();
    off.docs('$group');
    off.twinFor(TOY_RAW_CATALOGED);
    off.errorFor(TOY_RAW_NOVEL);
    off.validate?.(CLEAN_PIPELINE);
    off.explain?.(CLEAN_PIPELINE);

    expect(seen).toEqual([]);
  });

  it('writes no file when off, even with a log path handed to it', () => {
    const logPath = join(tempDir(), 'recorder.log');
    const off = recordProvider(toy(), { logPath });

    off.docs('$group');

    expect(() => readFileSync(logPath, 'utf8')).toThrow();
  });

  it('is never on the provider path: makeProvider does not import the recorder', () => {
    const closure = transitiveImportClosure('sdk.ts').map((source) => source.path);

    expect(closure).toContain('sdk.ts');
    expect(closure).not.toContain('recorder.ts');
  });
});

describe('a recording provider is still the provider', () => {
  it('answers the probe with the same entry, on the wrapper itself', () => {
    const provider = toy();
    const { sink } = collector();

    const wrapped = recordProvider(provider, { enabled: true, sink });

    expect(wrapped).not.toBe(provider);
    expect(hasMarker(wrapped)).toBe(true);
    expect(probe(wrapped)).toBe(provider.entry);
  });

  it('passes the declaration fields through unchanged', () => {
    const provider = toy();
    const { sink } = collector();

    const wrapped = recordProvider(provider, { enabled: true, sink });

    expect(wrapped.name).toBe(provider.name);
    expect(wrapped.level).toBe(provider.level);
    expect(wrapped.comprehendo).toBe(provider.comprehendo);
    expect(wrapped.surfaces).toEqual(provider.surfaces);
    expect(wrapped.entry).toBe(provider.entry);
    expect(wrapped.manifest).toBe(provider.manifest);
    expect(wrapped.twins).toBe(provider.twins);
  });

  it('keeps a Level 1 provider at Level 1: no validate, no explain, not even as keys', () => {
    const { sink } = collector();

    const wrapped = recordProvider(toy({ judge: 'none' }), { enabled: true, sink });

    expect(Object.keys(wrapped)).not.toContain('validate');
    expect(Object.keys(wrapped)).not.toContain('explain');
    expect(wrapped.level).toBe(1);
  });

  it('keeps docs callable AND keeps its logStats, and keeps mark() marking', () => {
    const provider = toy();
    const { sink } = collector();

    const wrapped = recordProvider(provider, { enabled: true, sink });
    const handle = wrapped.mark({ close: (): void => undefined });

    expect(wrapped.docs('$group')).toMatchObject({ topic: '$group' });
    expect(wrapped.docs.logStats()).toEqual({ written: 1, failed: 0 });
    expect(probe(handle)).toBe(provider.entry);
  });
});

describe('every call and response is captured, both directions, with a timestamp', () => {
  it('captures a real twin build, in and out', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), {
      enabled: true,
      sink,
      now: at('2026-08-22T10:00:00.000Z'),
    });

    const twin = wrapped.twinFor(TOY_RAW_CATALOGED);

    expect(twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(seen).toHaveLength(2);
    expect(seen[0]).toEqual({
      timestamp: '2026-08-22T10:00:00.000Z',
      direction: 'in',
      surface: 'twin',
      payload: { method: 'twinFor', args: [TOY_RAW_CATALOGED] },
    });
    expect(seen[1]).toEqual({
      timestamp: '2026-08-22T10:00:00.000Z',
      direction: 'out',
      surface: 'twin',
      payload: { method: 'twinFor', returned: twin },
    });
  });

  it('captures a real docs() lookup, in and out, index browse included', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), { enabled: true, sink });

    const answer = wrapped.docs('$group');
    const index = wrapped.docs();

    expect(seen.map((r) => [r.direction, r.surface])).toEqual([
      ['in', 'docs'],
      ['out', 'docs'],
      ['in', 'docs'],
      ['out', 'docs'],
    ]);
    expect(payloadOf(seen[0])).toEqual({ method: 'docs', args: ['$group'] });
    expect(payloadOf(seen[1])).toEqual({ method: 'docs', returned: answer });
    expect(payloadOf(seen[2])).toEqual({ method: 'docs', args: [] });
    expect(payloadOf(seen[3])).toEqual({ method: 'docs', returned: index });
  });

  it('captures a real validate() verdict, in and out', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), { enabled: true, sink });

    const clean = wrapped.validate?.(CLEAN_PIPELINE);
    const twinned = wrapped.validate?.(SPILL_PIPELINE) as Twin;

    expect(clean).toEqual({ valid: true });
    expect(twinned.code).toBe('SORT_UNINDEXED_SPILL');
    expect(seen.map((r) => [r.direction, r.surface])).toEqual([
      ['in', 'validate'],
      ['out', 'validate'],
      ['in', 'validate'],
      ['out', 'validate'],
    ]);
    expect(payloadOf(seen[0])).toEqual({ method: 'validate', args: [CLEAN_PIPELINE] });
    expect(payloadOf(seen[1])).toEqual({ method: 'validate', returned: { valid: true } });
    expect(payloadOf(seen[3])).toEqual({ method: 'validate', returned: twinned });
  });

  it('captures a real explain() call, in and out, without executing anything', () => {
    const runtime = toyRuntime();
    const { seen, sink } = collector();
    const wrapped = recordProvider(makeProvider(toyCorpus(), toyHooks({ runtime })), {
      enabled: true,
      sink,
    });

    const explanation = wrapped.explain?.(CLEAN_PIPELINE);

    expect(runtime.executions).toBe(0);
    expect(seen.map((r) => [r.direction, r.surface])).toEqual([
      ['in', 'explain'],
      ['out', 'explain'],
    ]);
    expect(payloadOf(seen[0])).toEqual({ method: 'explain', args: [CLEAN_PIPELINE] });
    expect(payloadOf(seen[1])).toEqual({ method: 'explain', returned: explanation });
  });

  it('records the call BEFORE it runs and the response after, never both at the end', () => {
    const timeline: string[] = [];
    const provider = makeProvider(toyCorpus(), {
      ...toyHooks(),
      docs: {
        sink: (record: LookupRecord): void => void timeline.push(`engine:${record.result}`),
      },
    });
    const wrapped = recordProvider(provider, {
      enabled: true,
      sink: (record: CallRecord): void => void timeline.push(`${record.direction}:${record.surface}`),
    });

    wrapped.docs('$group');

    expect(timeline).toEqual(['in:docs', 'engine:hit', 'out:docs']);
  });

  it('captures errorFor: the twin travels with the record, not just an empty Error', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), { enabled: true, sink });

    const error = wrapped.errorFor(TOY_RAW_CATALOGED, { path: 'pipeline[0].$sort' });

    expect(error.twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(payloadOf(seen[0])).toEqual({
      method: 'errorFor',
      args: [TOY_RAW_CATALOGED, { path: 'pipeline[0].$sort' }],
    });
    expect(payloadOf(seen[1])).toEqual({
      method: 'errorFor',
      returned: { name: 'Error', message: error.message, twin: error.twin },
    });
    expect(seen.every((record) => record.surface === 'twin')).toBe(true);
  });

  it('captures raise(): the throw is the response, recorded before it propagates', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), { enabled: true, sink });

    let thrown: unknown;
    try {
      wrapped.raise(TOY_RAW_CATALOGED);
    } catch (error) {
      thrown = error;
    }

    const caught = thrown as Error & { twin: Twin };
    expect(caught.twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(probe(caught)).toBeDefined();
    expect(seen.map((r) => r.direction)).toEqual(['in', 'out']);
    expect(payloadOf(seen[1])).toEqual({
      method: 'raise',
      thrown: { name: 'Error', message: caught.message, twin: caught.twin },
    });
  });

  it('records a surface that throws, and rethrows the original error untouched', () => {
    const { seen, sink } = collector();
    const provider = makeProvider(toyCorpus(), {
      ...toyHooks(),
      // A hook with a missing return in one branch: the SDK refuses the
      // verdict, and the recorder must record the refusal, not swallow it.
      validate: () => undefined as never,
    });
    const wrapped = recordProvider(provider, { enabled: true, sink });

    expect(() => wrapped.validate?.(CLEAN_PIPELINE)).toThrow(TypeError);
    expect(seen.map((r) => r.direction)).toEqual(['in', 'out']);
    expect(payloadOf(seen[1])['method']).toBe('validate');
    expect(payloadOf(seen[1])['thrown']).toMatchObject({ name: 'TypeError' });
  });

  it('every record carries a real ISO timestamp, on a real clock', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), { enabled: true, sink });

    wrapped.docs('$group');
    wrapped.twinFor(TOY_RAW_NOVEL);

    expect(seen).toHaveLength(4);
    for (const record of seen) {
      expect(typeof record.timestamp).toBe('string');
      expect(Date.parse(record.timestamp)).not.toBeNaN();
      expect(record.timestamp).toBe(new Date(record.timestamp).toISOString());
    }
  });

  it('keeps the session in call order, so a maintainer can replay it', () => {
    const { seen, sink } = collector();
    const wrapped = recordProvider(toy(), { enabled: true, sink });

    wrapped.docs();
    wrapped.validate?.(CLEAN_PIPELINE);
    wrapped.twinFor(TOY_RAW_NOVEL);
    wrapped.explain?.(CLEAN_PIPELINE);

    expect(seen.map((r) => `${r.direction}:${r.surface}`)).toEqual([
      'in:docs',
      'out:docs',
      'in:validate',
      'out:validate',
      'in:twin',
      'out:twin',
      'in:explain',
      'out:explain',
    ]);
  });
});

describe('the recording is a local file, and only a local file', () => {
  it('appends one JSON object per line, both directions, to the given path', () => {
    const logPath = join(tempDir(), 'nested', 'recorder.log');
    const wrapped = recordProvider(toy(), {
      enabled: true,
      logPath,
      now: at('2026-08-22T10:00:00.000Z'),
    });

    wrapped.docs('$group');
    wrapped.twinFor(TOY_RAW_CATALOGED);

    const raw = readFileSync(logPath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    const entries = readLog(logPath);
    expect(entries.map((e) => `${e.direction}:${e.surface}`)).toEqual([
      'in:docs',
      'out:docs',
      'in:twin',
      'out:twin',
    ]);
    expect(entries.every((e) => e.timestamp === '2026-08-22T10:00:00.000Z')).toBe(true);
    expect(payloadOf(entries[2])).toEqual({ method: 'twinFor', args: [TOY_RAW_CATALOGED] });
  });

  it('is append-only: a second recording over the same path never truncates', () => {
    const logPath = join(tempDir(), 'recorder.log');
    recordProvider(toy(), { enabled: true, logPath }).docs('$group');
    recordProvider(toy(), { enabled: true, logPath }).docs('$match');

    expect(readLog(logPath).map((e) => payloadOf(e)['args'])).toEqual([
      ['$group'],
      undefined,
      ['$match'],
      undefined,
    ]);
  });

  it('an injected sink sees the same records the file would carry', () => {
    const logPath = join(tempDir(), 'recorder.log');
    const { seen, sink } = collector();
    const now = at('2026-08-22T10:00:00.000Z');

    recordProvider(toy(), { enabled: true, sink, now }).twinFor(TOY_RAW_CATALOGED);
    recordProvider(toy(), { enabled: true, logPath, now }).twinFor(TOY_RAW_CATALOGED);

    expect(readLog(logPath)).toEqual(JSON.parse(JSON.stringify(seen)) as CallRecord[]);
  });

  it('an unwritable recording never breaks the call it was recording, and is counted', () => {
    // The parent of this path is an existing FILE, so the directory can never
    // be created. The call being recorded must still answer.
    const blocker = join(tempDir(), 'recorder.log');
    writeFileSync(blocker, '');
    const wrapped = recordProvider(toy(), { enabled: true, logPath: join(blocker, 'deeper.log') });

    expect(wrapped.docs('$group')).toMatchObject({ topic: '$group' });
    expect(wrapped.twinFor(TOY_RAW_CATALOGED).code).toBe('SORT_UNINDEXED_SPILL');
    expect(recordingOf(wrapped)?.stats()).toEqual({ written: 0, failed: 4 });
  });

  it('a payload that cannot be serialized is counted, never thrown at the caller', () => {
    const logPath = join(tempDir(), 'recorder.log');
    const wrapped = recordProvider(toy(), { enabled: true, logPath });
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(wrapped.twinFor(circular).code).toBe('UNSTRUCTURED');
    const stats = recordingOf(wrapped)?.stats();
    expect(stats?.failed).toBeGreaterThan(0);
  });

  it('a sink that throws is counted, and the recorded call still answers', () => {
    const wrapped = recordProvider(toy(), {
      enabled: true,
      sink: (): never => {
        throw new Error('sink is broken');
      },
    });

    expect(wrapped.docs('$group')).toMatchObject({ topic: '$group' });
    expect(recordingOf(wrapped)?.stats()).toEqual({ written: 0, failed: 2 });
  });

  it('defaults to a relative path under the working directory, never outside it', () => {
    expect(isAbsolute(DEFAULT_RECORDING_PATH)).toBe(false);
    expect(DEFAULT_RECORDING_PATH.split(/[\\/]/)).not.toContain('..');

    const cwd = process.cwd();
    const dir = tempDir();
    try {
      process.chdir(dir);
      const wrapped = recordProvider(toy(), { enabled: true });
      wrapped.docs('$group');
      expect(recordingOf(wrapped)?.stats()).toEqual({ written: 2, failed: 0 });
      expect(readLog(join(dir, DEFAULT_RECORDING_PATH))).toHaveLength(2);
    } finally {
      process.chdir(cwd);
    }
  });
});

// The pure-absence scans here (no network module, no network global) are
// invariant scans, not feature skeletons, and they pass against an empty file
// by construction. They are anchored by the two POSITIVE scans in the same
// block (the exact non-relative import allowlist, the exact node:fs surface),
// which were red at the gate against a module that did not exist.
describe('nothing here can reach the network (CC6 [27])', () => {
  const RECORDER = 'recorder.ts';
  /** recorder.ts plus every module it can pull in, the way CC1 [07] scopes a scan. */
  const CLOSURE = (): { path: string; text: string; code: string }[] =>
    transitiveImportClosure(RECORDER);
  const entry = (): { path: string; text: string; code: string } => {
    const source = readCoreSources().find((file) => file.path === RECORDER);
    if (source === undefined) throw new Error('recorder.ts is not in src/');
    return source;
  };

  const importSpecifiers = (code: string): string[] =>
    [...code.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');

  it('imports nothing outside the local filesystem: node:fs and node:path, exactly', () => {
    const specifiers = importSpecifiers(entry().code).filter((s) => !s.startsWith('.'));

    expect([...new Set(specifiers)].sort()).toEqual(['node:fs', 'node:path']);
  });

  it('touches node:fs only to create the directory and append the line', () => {
    const fsImport = /import\s*\{([^}]*)\}\s*from\s*'node:fs'/.exec(entry().code);

    expect(fsImport).not.toBeNull();
    const used = (fsImport?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();
    expect(used).toEqual(['appendFileSync', 'mkdirSync']);
  });

  it('the whole closure imports no network-capable module, statically or dynamically', () => {
    const forbidden = [
      'net',
      'tls',
      'http',
      'https',
      'http2',
      'dns',
      'dgram',
      'child_process',
      'worker_threads',
      'inspector',
      'cluster',
    ];
    for (const { path, code } of CLOSURE()) {
      for (const module of forbidden) {
        expect(code, `${path} references ${module}`).not.toMatch(
          new RegExp(`['"](?:node:)?${module}['"]`),
        );
      }
    }
  });

  it('never resolves a module at run time: no dynamic import, no require', () => {
    const { code } = entry();

    expect(code).not.toMatch(/\bimport\s*\(/);
    expect(code).not.toMatch(/\brequire\s*\(/);
  });

  it('calls no network-capable builtin anywhere in the closure', () => {
    for (const { path, code } of CLOSURE()) {
      for (const builtin of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
        expect(code, `${path} uses ${builtin}`).not.toContain(builtin);
      }
    }
    expect(entry().text, 'recorder.ts carries a URL').not.toMatch(/https?:\/\//);
  });

  it('names no host and no address: a recording has nowhere to go', () => {
    const { code } = entry();

    expect(code).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    expect(code).not.toMatch(/localhost/i);
  });
});
