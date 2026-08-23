// Submission Gate [29]: the REAL corpora and the REAL installed packages these
// suites run the gate over.
//
// Nothing here types a corpus by hand. A fixture is a real toy target package
// on a real disk, scanned by Corpus Generator [17]'s OWN `runInit`/`runScan`,
// finished through 17's OWN `writeCorpus`, and read back through Corpus Format
// [28]'s OWN `parse`. If either of those file shapes moves, these suites go
// red, which is the whole point of not typing a fixture.
//
// For the CC11 [25] half the package is really INSTALLED: `npm pack` produces a
// real tarball and `npm install --offline` unpacks it into a real node_modules
// tree, exactly the shape CI hands the gate. The gate then loads that installed
// module and calls it for real. `--offline` is deliberate: nothing in this
// project reaches a network, in a test any more than in `src/`.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from '../../src/corpus-format.js';
import type { CorpusSource } from '../../src/corpus-format.js';
import type { SubmissionCorpus } from '../../src/gate-result.js';
import { generatorModule, readJsonFile, scratch, writeJsonFile } from './authored-corpus.js';

// The throw-site texts are templated with the package name so two toy targets
// carry genuinely different fingerprints. Two packages whose corpora declare
// the same error class AND the same message pattern really ARE a collision
// (the signature a collision is computed on excludes the package, deliberately,
// see fingerprint-facets.ts), so a shared literal here would make every
// two-corpus suite trip the fingerprint lint by accident.

/** The toy target's source, as 17's scanner reads it. Two real throw sites. */
const toySource = (name: string): string => `/**
 * Encode a payload into the toy wire format: a decimal length prefix, a
 * colon, then the payload itself.
 */
export function encode(input: string): string {
  if (input === '') {
    throw new RangeError('${name} input must not be empty');
  }
  return input.length + ':' + input;
}

/**
 * Decode a toy wire-format frame back into its payload.
 */
export function decode(frame: string): string {
  const at = frame.indexOf(':');
  if (at < 0) {
    throw new TypeError('${name} frame carries no length prefix');
  }
  return frame.slice(at + 1);
}
`;

/** The same two operations as runnable JavaScript: what really gets installed. */
const toyRuntime = (name: string): string => `export function encode(input) {
  if (input === '') {
    throw new RangeError('${name} input must not be empty');
  }
  return input.length + ':' + input;
}

export function decode(frame) {
  const at = frame.indexOf(':');
  if (at < 0) {
    throw new TypeError('${name} frame carries no length prefix');
  }
  return frame.slice(at + 1);
}
`;

/**
 * The SAME package, one release later, where the empty-input rejection was
 * dropped upstream. Nothing in the corpus changed; the world did. This is the
 * drift scenario CC4 [26] requires to fail loudly rather than pass quietly.
 */
const driftedRuntime = (name: string): string => `export function encode(input) {
  return input.length + ':' + input;
}

export function decode(frame) {
  const at = frame.indexOf(':');
  if (at < 0) {
    throw new TypeError('${name} frame carries no length prefix');
  }
  return frame.slice(at + 1);
}
`;

/** 17's authoring corpus, loosely typed: these helpers only edit it. */
export interface AuthoredCorpus {
  readonly provider: string;
  readonly topics: readonly Record<string, unknown>[];
  readonly twins: readonly Record<string, unknown>[];
  readonly fixes: Record<string, readonly Record<string, unknown>[]>;
}

export interface Fixture {
  /** The target package root on disk. */
  readonly target: string;
  /** The corpus source tree, `<target>/comprehendo`. */
  readonly corpus: string;
  /** The package name, which is also the registry directory name. */
  readonly name: string;
  /** Re-read the corpus through 28's real `parse`. */
  readonly source: () => CorpusSource;
  /** The corpus as the gate consumes it. */
  readonly submission: (directory?: string) => SubmissionCorpus;
  /** Re-author the corpus through 17's real writer. */
  readonly rewrite: (edit: (corpus: AuthoredCorpus) => AuthoredCorpus) => Promise<void>;
  /** Edit the manifest the way a corpus author edits it by hand. */
  readonly patchManifest: (patch: Record<string, unknown>) => void;
  readonly cleanup: () => void;
}

const cleanups: (() => void)[] = [];

/** Every temp tree these suites made, removed. Call from an afterEach. */
export function cleanAll(): void {
  while (cleanups.length > 0) cleanups.pop()?.();
}

/**
 * A real toy target package with a real corpus, authored end to end by 17.
 * `name` is both the npm package name and the registry directory name, which
 * is what makes the typosquat check testable at all.
 */
export async function fixture(name = 'toy-encoder'): Promise<Fixture> {
  const { runInit, runScan, corpusPaths } = await generatorModule();
  const { path, cleanup } = scratch('comprehendo-29-');
  cleanups.push(cleanup);
  const target = join(path, name);
  mkdirSync(join(target, 'src'), { recursive: true });
  writeFileSync(
    join(target, 'package.json'),
    `${JSON.stringify({ name, version: '1.0.0', type: 'module', main: 'index.js' }, null, 2)}\n`,
    'utf8',
  );
  writeFileSync(join(target, 'src', 'encode.ts'), toySource(name), 'utf8');
  writeFileSync(join(target, 'index.js'), toyRuntime(name), 'utf8');

  const write = (): void => {
    /* the verbs' stdout is not what these suites assert on */
  };
  runInit({ target, write });
  runScan({ target, write });

  const corpus = join(target, 'comprehendo');
  const paths = corpusPaths(corpus);
  const made: Fixture = {
    target,
    corpus,
    name,
    source: (): CorpusSource => parse(corpus),
    submission: (directory = name): SubmissionCorpus => ({ directory, source: parse(corpus) }),
    rewrite: async (edit): Promise<void> => {
      const { readCorpus, writeCorpus } = await generatorModule();
      writeCorpus(paths, edit(readCorpus(paths)));
    },
    patchManifest: (patch): void => {
      writeJsonFile(paths.manifest, { ...readJsonFile(paths.manifest), ...patch });
    },
    cleanup,
  };
  await complete(made);
  return made;
}

/** The provider's own already-shipped call surface, as the manifest carries it. */
export const TOY_CALL_SCHEMA = Object.freeze({
  surface: 'toy-encoder',
  operations: Object.freeze(['encode', 'decode']),
});

/** The twin codes `complete` publishes, in scan order. */
export const EMPTY_INPUT = 'TOY_0_RANGEERROR';
export const NO_PREFIX = 'TOY_1_TYPEERROR';

/** The witnessed call that really provokes EMPTY_INPUT out of the real package. */
export const EMPTY_INPUT_WITNESS = Object.freeze({
  code: EMPTY_INPUT,
  induce: Object.freeze({ encode: Object.freeze(['']) }),
});

export const NO_PREFIX_WITNESS = Object.freeze({
  code: NO_PREFIX,
  induce: Object.freeze({ decode: Object.freeze(['no-colon-here']) }),
});

const OPERATION_OF: Readonly<Record<string, string>> = { encode: 'encode', decode: 'decode' };

/** The fix that really resolves each cataloged failure, as literal call data. */
const APPLY_OF: Readonly<Record<string, unknown>> = {
  encode: { encode: ['payload'] },
  decode: { decode: ['7:payload'] },
};

/**
 * Finish the corpus the way a human author does: fill every field 17 marked
 * `status: stub`, give each fix a real apply and a real docs pointer, and give
 * each topic a worked example that names the failure it can raise (the loop
 * lint's subject). Written back through 17's OWN writer, so the result is
 * still a tree 17 produced.
 */
export async function complete(made: Fixture): Promise<void> {
  await made.rewrite((corpus) => {
    const twins: Record<string, unknown>[] = corpus.twins.map((twin, at) => ({
      ...twin,
      status: 'draft',
      code: `TOY_${String(at)}_${String(
        (twin['fingerprint'] as Record<string, unknown>)['exception'],
      ).toUpperCase()}`,
      reason: `The toy encoder refused this call; the cataloged cause is entry ${String(at)}.`,
    }));
    const codeFor = (topic: string): string | undefined =>
      twins.find((twin) => twin['docs'] === topic)?.['code'] as string | undefined;
    const topics = corpus.topics.map((topic) => {
      const name = String(topic['topic']);
      const code = codeFor(name);
      return {
        ...topic,
        status: 'draft',
        summary:
          typeof topic['summary'] === 'string' && topic['summary'] !== 'status: stub'
            ? topic['summary']
            : `What ${name} does, in one topic-sized answer.`,
        vocabularies_served: { own_terms: [name], translations: [], task: [] },
        examples:
          code === undefined
            ? []
            : [
                {
                  title: `Recovering from ${code}`,
                  code: `// ${code}: ${name} refuses the call above.\n${JSON.stringify(
                    APPLY_OF[name] ?? {},
                  )}`,
                },
              ],
      };
    });
    const fixes: Record<string, readonly Record<string, unknown>[]> = {};
    for (const twin of twins) {
      const topic = String(twin['docs']);
      fixes[String(twin['id'])] = [
        {
          title: `Call ${OPERATION_OF[topic] ?? topic} with a value it accepts`,
          docs: topic,
          apply: APPLY_OF[topic],
          confidence: 'high',
          status: 'draft',
        },
      ];
    }
    return { ...corpus, topics, twins, fixes };
  });
  // 17's writer has no slot for the provider's declared call schema, so the
  // format's own key is added to the file 17 just wrote, exactly as a corpus
  // author has to add it by hand (see 28's Known Issues).
  made.patchManifest({
    declared_schema: { ...TOY_CALL_SCHEMA, surface: made.name },
  });
}

/** Replace the installed runtime with the release that no longer throws. */
export function driftTarget(made: Fixture): void {
  writeFileSync(join(made.target, 'index.js'), driftedRuntime(made.name), 'utf8');
  writeJsonFile(join(made.target, 'package.json'), {
    name: made.name,
    version: '2.0.0',
    type: 'module',
    main: 'index.js',
  });
}

const npm = (args: readonly string[], cwd: string): string =>
  execFileSync('npm', [...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/**
 * A REAL install: `npm pack` the target, then `npm install --offline` the
 * tarball into a fresh root. The returned path is what CI hands the gate.
 */
export function installTarget(made: Fixture): string {
  const { path, cleanup } = scratch('comprehendo-29-install-');
  cleanups.push(cleanup);
  const packed = npm(['pack', '--pack-destination', path, '--silent'], made.target)
    .trim()
    .split('\n')
    .filter((line) => line.endsWith('.tgz'))
    .pop();
  if (packed === undefined) throw new Error('npm pack produced no tarball');
  const root = join(path, 'root');
  mkdirSync(root, { recursive: true });
  writeJsonFile(join(root, 'package.json'), { name: 'ci-install-root', version: '1.0.0', private: true });
  npm(
    ['install', join(path, packed), '--offline', '--no-audit', '--no-fund', '--ignore-scripts', '--silent'],
    root,
  );
  return root;
}

/** A package directory whose package.json disagrees with the directory name. */
export function plantMislabelled(root: string, directory: string, declared: string): void {
  const home = join(root, 'node_modules', directory);
  mkdirSync(home, { recursive: true });
  writeJsonFile(join(home, 'package.json'), {
    name: declared,
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
  });
  writeFileSync(join(home, 'index.js'), toyRuntime(declared), 'utf8');
}
