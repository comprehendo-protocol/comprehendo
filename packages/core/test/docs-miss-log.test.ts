// Docs Engine [13]: the local miss log, and the structural claim that nothing
// in this engine can reach the network (CC6 [27], the same scan shape CC1 [07]
// runs over the marker).
//
// Helpers are deliberately local to this file: packages/core/test/ has no
// shared helper module yet and sibling Wave-2 features are building in
// parallel, so creating one here would be an unowned shared file.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createDocs,
  DEFAULT_LOG_PATH,
  loadPackedCorpus,
  type LookupRecord,
  type PackedCorpus,
} from '../src/docs.js';

const CORPUS_PATH = fileURLToPath(
  new URL('./fixtures/mongodb-operator.packed.json', import.meta.url),
);
/** Every module the docs engine is made of. The CC6 scan covers all of them. */
const ENGINE_MODULES = ['docs.ts', 'docs-vocabulary.ts'];

const dirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'comprehendo-docs-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const readLog = (path: string): LookupRecord[] =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LookupRecord);

const corpus = (): PackedCorpus => loadPackedCorpus(CORPUS_PATH);
const at = (iso: string) => (): Date => new Date(iso);

describe('the local miss log', () => {
  it('records every lookup, hit and miss alike', () => {
    const logPath = join(tempDir(), 'nested', 'docs-usage.log');
    const docs = createDocs(corpus(), { logPath, now: at('2026-08-22T10:00:00.000Z') });
    docs('$group');
    docs('how do I shard a capped collection');

    const entries = readLog(logPath);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      query: '$group',
      timestamp: '2026-08-22T10:00:00.000Z',
      result: 'hit',
      topic: '$group',
    });
    expect(entries[1]).toEqual({
      query: 'how do I shard a capped collection',
      timestamp: '2026-08-22T10:00:00.000Z',
      result: 'miss',
    });
  });

  it('records an index browse too, as its own result kind', () => {
    const logPath = join(tempDir(), 'docs-usage.log');
    const docs = createDocs(corpus(), { logPath, now: at('2026-08-22T10:00:00.000Z') });
    docs();

    expect(readLog(logPath)).toEqual([
      { query: null, timestamp: '2026-08-22T10:00:00.000Z', result: 'index' },
    ]);
  });

  it('is one JSON object per line, so the file is greppable and streamable', () => {
    const logPath = join(tempDir(), 'docs-usage.log');
    const docs = createDocs(corpus(), { logPath });
    docs('$match');
    docs('$grup');

    const raw = readFileSync(logPath, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    for (const line of raw.split('\n').filter((l) => l.length > 0)) {
      expect(line).not.toContain('\n');
      const record = JSON.parse(line) as LookupRecord;
      expect(typeof record.timestamp).toBe('string');
      expect(Date.parse(record.timestamp)).not.toBeNaN();
    }
  });

  it('is append-only: a second engine over the same path never truncates', () => {
    const logPath = join(tempDir(), 'docs-usage.log');
    createDocs(corpus(), { logPath })('$group');
    createDocs(corpus(), { logPath })('$match');
    createDocs(corpus(), { logPath })();

    const entries = readLog(logPath);
    expect(entries.map((e) => e.query)).toEqual(['$group', '$match', null]);
  });

  it('a miss never records a topic: the log must not invent an answer', () => {
    const logPath = join(tempDir(), 'docs-usage.log');
    createDocs(corpus(), { logPath })('group by index selection');

    const [entry] = readLog(logPath);
    expect(entry?.result).toBe('miss');
    expect(entry && 'topic' in entry).toBe(false);
  });

  it('an injected sink sees the same records the file would carry', () => {
    const seen: LookupRecord[] = [];
    const docs = createDocs(corpus(), { sink: (record) => seen.push(record) });
    docs();
    docs('$group');
    docs('$grup');

    expect(seen.map((r) => r.result)).toEqual(['index', 'hit', 'miss']);
    expect(docs.logStats()).toEqual({ written: 3, failed: 0 });
  });

  it('an unwritable log never breaks docs(), and the failure is counted', () => {
    // The parent of this path is an existing FILE, so the directory the log
    // needs can never be created. docs() must still answer.
    const logPath = join(CORPUS_PATH, 'impossible', 'docs-usage.log');
    const docs = createDocs(corpus(), { logPath });
    expect((docs('$group') as { topic?: string }).topic).toBe('$group');
    expect((docs('$grup') as { code?: string }).code).toBe('UNDOCUMENTED');
    expect(docs.logStats()).toEqual({ written: 0, failed: 2 });
  });

  it('with no options at all it writes a local file under the working directory', () => {
    expect(isAbsolute(DEFAULT_LOG_PATH)).toBe(false);
    expect(DEFAULT_LOG_PATH.split(/[\\/]/)).not.toContain('..');

    const cwd = process.cwd();
    const dir = tempDir();
    try {
      process.chdir(dir);
      const docs = createDocs(corpus());
      docs('$group');
      expect(docs.logStats()).toEqual({ written: 1, failed: 0 });
      expect(readLog(join(dir, DEFAULT_LOG_PATH))[0]?.topic).toBe('$group');
    } finally {
      process.chdir(cwd);
    }
  });
});

// RED-GATE NOTE: the three pure-absence scans below (no network module, no
// network global, no directory API) are invariant scans, not feature
// skeletons, and they pass against an empty file by construction, exactly like
// the generated rule-conformance suite the build flow exempts from the Red
// Gate. They are the CC6 [27] / CC1 [07] claim in test form and are what would
// go red the day someone adds an import to this engine. The two positive scans
// in the same block (the exact import allowlist, the exact node:fs surface)
// were red at the gate and anchor the absence claims to a real implementation.
describe('nothing here can reach the network (CC6 [27])', () => {
  // The whole engine, not just its entry module: CC1 [07] says the scan covers
  // "any module it imports", because a transitive import defeats the guarantee.
  const MODULES = ENGINE_MODULES.map((name) => ({
    name,
    text: readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8'),
  }));

  const importSpecifiers = (text: string): string[] =>
    [...text.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');

  it('the engine as a whole imports nothing beyond local-filesystem modules', () => {
    const specifiers = MODULES.flatMap(({ text }) => importSpecifiers(text))
      .filter((specifier) => !specifier.startsWith('.'));
    expect([...new Set(specifiers)].sort()).toEqual(['node:fs', 'node:path']);
  });

  it('every relative import stays inside the engine', () => {
    for (const { name, text } of MODULES) {
      for (const specifier of importSpecifiers(text).filter((s) => s.startsWith('.'))) {
        expect(ENGINE_MODULES, `${name} imports ${specifier}`).toContain(
          specifier.replace(/^\.\//, '').replace(/\.js$/, '.ts'),
        );
      }
    }
  });

  it('imports no network-capable module, statically or dynamically', () => {
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
    for (const { name, text } of MODULES) {
      for (const module of forbidden) {
        expect(text, `${name} references ${module}`).not.toMatch(
          new RegExp(`['"](?:node:)?${module}['"]`),
        );
      }
      expect(text, `${name} imports dynamically`).not.toMatch(/\bimport\s*\(/);
      expect(text, `${name} calls require`).not.toMatch(/\brequire\s*\(/);
    }
  });

  it('calls no network-capable builtin', () => {
    for (const { name, text } of MODULES) {
      for (const builtin of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'sendBeacon', 'EventSource']) {
        expect(text, `${name} uses ${builtin}`).not.toContain(builtin);
      }
      expect(text, `${name} carries a URL`).not.toMatch(/https?:\/\//);
    }
  });

  it('never walks a directory: the corpus is one artifact, read once', () => {
    for (const { name, text } of MODULES) {
      for (const api of ['readdir', 'opendir', 'glob', 'watch', 'scandir']) {
        expect(text, `${name} uses ${api}`).not.toContain(api);
      }
    }
  });

  it('touches the filesystem only to read the artifact and append the log', () => {
    const entry = MODULES.find(({ name }) => name === 'docs.ts')?.text ?? '';
    const fsImport = /import\s*\{([^}]*)\}\s*from\s*'node:fs'/.exec(entry);
    expect(fsImport).not.toBeNull();
    const used = (fsImport?.[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort();
    expect(used).toEqual(['appendFileSync', 'mkdirSync', 'readFileSync']);
  });
});
