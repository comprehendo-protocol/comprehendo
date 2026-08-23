// A REAL five-file authoring corpus, written by Corpus Generator [17] itself.
//
// Corpus Format [28] claims to read "the five-file corpus shape produced by
// Corpus Generator [17]". A fixture typed here to agree with this package's own
// parser would prove nothing about that claim, so this helper does not type
// one: it writes a real toy target package to a real temp directory, runs 17's
// REAL `runInit` and `runScan` over it, and hands back the directory those
// verbs actually produced. If 17's file shape moves, these tests go red, which
// is the entire point.
//
// 17 lives in `packages/core`, which this package takes no dependency on
// (packages install independently, and a `../../core/src` import from `src/`
// breaks rootDir). It is loaded the same way core's own suites load THIS
// package's matcher: a dynamic import of the real module by file URL, at run
// time, under the test runner's transform. No double is ever in the loop.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CORE_SRC = join(import.meta.dirname, '..', '..', '..', 'core', 'src');

/** The slice of 17's module surface these suites drive. */
interface GeneratorModule {
  readonly runInit: (options: VerbOptions) => number;
  readonly runScan: (options: VerbOptions) => number;
  readonly corpusPaths: (root: string) => CorpusPaths;
  readonly readCorpus: (paths: CorpusPaths) => AuthoredCorpus;
  readonly writeCorpus: (paths: CorpusPaths, corpus: AuthoredCorpus) => readonly string[];
}

interface VerbOptions {
  readonly target: string;
  readonly write: (line: string) => void;
}

interface CorpusPaths {
  readonly root: string;
  readonly manifest: string;
  readonly index: string;
  readonly topics: string;
  readonly twins: string;
  readonly fixes: string;
}

/** 17's `AuthoringCorpus`, loosely typed: this helper only edits it. */
interface AuthoredCorpus {
  readonly provider: string;
  readonly topics: readonly Record<string, unknown>[];
  readonly twins: readonly Record<string, unknown>[];
  readonly fixes: Record<string, readonly Record<string, unknown>[]>;
}

let loading: Promise<GeneratorModule> | undefined;

/** Corpus Generator [17]'s real module, loaded once per suite process. */
export async function generatorModule(): Promise<GeneratorModule> {
  loading ??= import(
    /* @vite-ignore */ pathToFileURL(join(CORE_SRC, 'cli', 'index.ts')).href
  ) as Promise<unknown> as Promise<GeneratorModule>;
  return loading;
}

/** Docs Engine [13] and Twin Builder [12], the runtimes a packed corpus feeds. */
export async function coreModule(name: 'docs' | 'twin'): Promise<Record<string, unknown>> {
  return (await import(
    /* @vite-ignore */ pathToFileURL(join(CORE_SRC, `${name}.ts`)).href
  )) as Record<string, unknown>;
}

const TOY_SOURCE = `/**
 * Encode a payload into the toy wire format: a decimal length prefix, a
 * colon, then the payload itself.
 */
export function encode(input: string): string {
  if (input === '') {
    throw new RangeError('input must not be empty');
  }
  return input.length + ':' + input;
}

/**
 * Decode a toy wire-format frame back into its payload.
 */
export function decode(frame: string): string {
  const at = frame.indexOf(':');
  if (at < 0) {
    throw new TypeError('frame carries no length prefix');
  }
  return frame.slice(at + 1);
}
`;

export interface AuthoredTree {
  /** The target package root. */
  readonly target: string;
  /** The corpus root, `<target>/comprehendo`. */
  readonly corpus: string;
  readonly paths: CorpusPaths;
  /** Removes the whole temp tree. */
  readonly cleanup: () => void;
}

/** A temp directory that removes itself, so a suite leaves no tree behind. */
export function scratch(prefix = 'comprehendo-28-'): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), prefix));
  return { path, cleanup: (): void => rmSync(path, { recursive: true, force: true }) };
}

/** Reads a JSON file back off the corpus, as a corpus author's editor would. */
export const readJsonFile = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

export const writeJsonFile = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

/**
 * A real toy target package, `init`ed and `scan`ned by 17. Everything below
 * this line is 17's output, not this file's opinion of it.
 */
export async function authoredTree(): Promise<AuthoredTree> {
  const { runInit, runScan, corpusPaths } = await generatorModule();
  const { path, cleanup } = scratch();
  const target = join(path, 'toy-encoder');
  mkdirSync(join(target, 'src'), { recursive: true });
  writeFileSync(
    join(target, 'package.json'),
    `${JSON.stringify({ name: 'toy-encoder', version: '1.0.0' }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(join(target, 'src', 'encode.ts'), TOY_SOURCE, 'utf8');

  const write = (): void => {
    /* the verbs' stdout is not what these suites assert on */
  };
  runInit({ target, write });
  runScan({ target, write });

  const corpus = join(target, 'comprehendo');
  return { target, corpus, paths: corpusPaths(corpus), cleanup };
}

/** The declared call schema Corpus Format [28] reads out of `manifest.json`. */
export const TOY_CALL_SCHEMA = Object.freeze({
  surface: 'toy-encoder',
  operations: Object.freeze(['encode', 'decode']),
});

/**
 * Finish the corpus the way a human author does: fill every field 17 marked
 * `status: stub`, add the declared call schema, and write it back through 17's
 * OWN writer, so the result is still a file tree 17 produced.
 */
export async function completeCorpus(tree: AuthoredTree): Promise<void> {
  const { readCorpus, writeCorpus } = await generatorModule();
  const corpus = readCorpus(tree.paths);
  const topics = corpus.topics.map((topic) => ({
    ...topic,
    status: 'draft',
    summary:
      typeof topic['summary'] === 'string' && topic['summary'] !== 'status: stub'
        ? topic['summary']
        : `What ${String(topic['topic'])} does, in one topic-sized answer.`,
    vocabularies_served: {
      own_terms: [String(topic['topic'])],
      translations: [],
      task: [],
    },
  }));
  const twins: Record<string, unknown>[] = corpus.twins.map((twin, at) => ({
    ...twin,
    status: 'draft',
    code: `TOY_${String(at)}_${String(
      (twin['fingerprint'] as Record<string, unknown>)['exception'],
    ).toUpperCase()}`,
    reason: `The toy encoder refused this call; the cataloged cause is entry ${String(at)}.`,
  }));
  const fixes: Record<string, readonly Record<string, unknown>[]> = {};
  for (const twin of twins) {
    fixes[String(twin['id'])] = [
      {
        title: 'Pass a non-empty payload',
        docs: String(twin['docs']),
        status: 'draft',
      },
    ];
  }
  writeCorpus(tree.paths, { ...corpus, topics, twins, fixes });

  // 17's writer has no slot for the provider's declared call schema (see the
  // feature doc's Known Issues), so the format's own key is added to the file
  // 17 just wrote, exactly as a corpus author would have to add it by hand.
  const manifest = readJsonFile(tree.paths.manifest);
  writeJsonFile(tree.paths.manifest, { ...manifest, declared_schema: TOY_CALL_SCHEMA });
}
