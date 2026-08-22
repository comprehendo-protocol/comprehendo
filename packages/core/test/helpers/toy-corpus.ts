/**
 * Corpus Generator [17] test support: a real toy target package in a temp
 * directory, plus the byte-level snapshot the "a re-scan never touches a
 * human-owned field" claim is checked with.
 *
 * The target is a real, compiling TypeScript package (test/fixtures/toy-target),
 * copied per test so a verb can write to it. The spec's mongodb-operator kit
 * fixtures are deliberately untouched; those belong to packages/spec.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

import { STUB, readCorpus, writeCorpus, corpusPaths, type VerbOptions } from '../../src/cli/index.js';

export const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

export type ToyFixture = 'toy-target' | 'toy-target-next';

export interface Workspace {
  /** The copied target package root. */
  readonly target: string;
  /** `<target>/comprehendo`, the default corpus root. */
  readonly corpus: string;
  /** Everything the verbs have written, one entry per line. */
  readonly lines: string[];
  /** Options for a verb, with the writer wired to `lines`. */
  options(extra?: Partial<VerbOptions>): VerbOptions;
  /** Replace the target's sources with another fixture's, in place. */
  upgrade(fixture: ToyFixture): void;
  /** Read and rewrite one file inside the target. */
  edit(file: string, change: (text: string) => string): void;
  /** Write a brand-new file inside the target (parent dirs created). */
  addFile(file: string, content: string): void;
}

const workspaces: string[] = [];

export function makeWorkspace(fixture: ToyFixture = 'toy-target'): Workspace {
  const root = mkdtempSync(join(tmpdir(), 'comprehendo-corpus-'));
  workspaces.push(root);
  const target = join(root, 'target');
  cpSync(join(FIXTURES, fixture), target, { recursive: true });
  const lines: string[] = [];
  return {
    target,
    corpus: join(target, 'comprehendo'),
    lines,
    options(extra = {}) {
      return { target, write: (line) => lines.push(line), ...extra };
    },
    upgrade(next) {
      rmSync(join(target, 'src'), { recursive: true, force: true });
      cpSync(join(FIXTURES, next, 'src'), join(target, 'src'), { recursive: true });
      const manifest = JSON.parse(
        readFileSync(join(FIXTURES, next, 'package.json'), 'utf8'),
      ) as Record<string, unknown>;
      writeFileSync(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    },
    edit(file, change) {
      const path = join(target, file);
      writeFileSync(path, change(readFileSync(path, 'utf8')), 'utf8');
    },
    addFile(file, content) {
      const path = join(target, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, 'utf8');
    },
  };
}

/** A flat internal package with no `src/`: the `local` corpus path. */
export function makeLocalPackage(name: string): string {
  const root = mkdtempSync(join(tmpdir(), 'comprehendo-local-'));
  workspaces.push(root);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'package.json'), `{"name":"${name}","version":"0.1.0"}\n`, 'utf8');
  writeFileSync(
    join(root, 'internal.ts'),
    ['/** Look one identifier up in the internal table. */',
      'export function lookup(key: string): string {',
      "  if (key === '') {",
      "    throw new RangeError('key must not be empty');",
      '  }',
      '  return key;',
      '}',
      ''].join('\n'),
    'utf8',
  );
  return root;
}

export function cleanupWorkspaces(): void {
  for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** Every file under `dir`, POSIX-relative path to exact content. */
export function snapshot(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (current: string): void => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else files[relative(dir, full).split(sep).join('/')] = readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return files;
}

/**
 * Write, as a human would, every field a scan left as a stub. Used by the pack
 * tests: the packed runtime format has no way to say "nobody wrote this yet".
 */
export function fillEveryStub(corpusRoot: string): void {
  const paths = corpusPaths(corpusRoot);
  const corpus = readCorpus(paths);
  writeCorpus(paths, {
    ...corpus,
    topics: corpus.topics.map((topic) => ({
      ...topic,
      summary: topic.summary === STUB ? `What ${topic.topic} is for, written by a human.` : topic.summary,
    })),
    twins: corpus.twins.map((twin) => ({
      ...twin,
      code: twin.code === STUB ? twin.fingerprint.exception.toUpperCase() : twin.code,
      reason: twin.reason === STUB ? `${twin.fingerprint.message_pattern}.` : twin.reason,
    })),
    fixes: Object.fromEntries(
      Object.entries(corpus.fixes).map(([id, fixes]) => [
        id,
        fixes.map((fix) => ({ ...fix, title: fix.title === STUB ? 'Pass a value the call accepts' : fix.title })),
      ]),
    ),
  });
}
