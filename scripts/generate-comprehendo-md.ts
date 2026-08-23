#!/usr/bin/env node
// COMPREHENDO.md Generator [35]: the file-browsing discovery channel, generated,
// and the drift gate that keeps it honest.
//
// An agent that browses a repository before running any code finds this file
// and learns the package speaks Comprehendo. That is the third of the four
// discovery channels Marker & Probe [11] names (marker at runtime, manifest
// statically, this file when browsing, the twin's own field mid-failure), and
// it is the only one that costs nothing to look at.
//
// The file's CONTENT lives in `comprehendo-md.ts`, which is pure. This module
// is the impure half: it loads the real tooling, reads and writes real files,
// parses argv, and returns the exit code CI reads.
//
// WHY IT IMPORTS `dist/` AND NOT `src/`. This runs under plain `node`, whose
// type stripping does not rewrite a `./foo.js` specifier onto `foo.ts` the way
// a bundler does, so the packages' own source trees are not loadable from a
// standalone script at all. The built modules are, and they are the same code
// the published packages ship. The drift suite refuses to run against a
// `dist/` older than its `src/`, so a stale build cannot pass this gate
// quietly.
//
// EXIT CODES ARE THE CONTRACT, because CI reads them. Same vocabulary Corpus
// Generator [17]'s CLI already established:
//   0  the file is current (--check), or was written
//   1  drift: the committed file is not what the corpus generates
//   2  a precondition the caller can fix (bad usage, no corpus, no build)
//   70 a bug in this tool, reported with its stack
//
// @see .mdd/docs/35-comprehendo-md-generator.md

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { OUTPUT_FILE, count, driftReport, renderPacked } from './comprehendo-md.ts';

import type {
  CorpusSource,
  PackedCorpus,
} from '../packages/registry-tools/dist/corpus-format.js';
import type {
  DocsOptions,
  DocsSurface,
  PackedCorpus as PackedDocs,
} from '../packages/core/dist/docs.js';

export { OUTPUT_FILE, driftReport, renderPacked };

export const USAGE: readonly string[] = Object.freeze([
  'generate-comprehendo-md <corpus-dir> [--check] [--out <file>]',
  '',
  '  <corpus-dir>   a corpus in Corpus Format [28] authoring shape',
  `  --check        exit 1 when the committed ${OUTPUT_FILE} is not what the corpus generates`,
  `  --out <file>   where to read or write (default <corpus-dir>/${OUTPUT_FILE})`,
]);

/** A precondition the caller can fix. Never a stack trace, always a sentence. */
class PreconditionError extends Error {}

type Writer = (line: string) => void;

interface FormatTier {
  readonly parse: (corpusDir: string) => CorpusSource;
  readonly pack: (corpus: CorpusSource) => PackedCorpus;
}

interface DocsTier {
  readonly parsePackedCorpus: (raw: unknown) => PackedDocs;
  readonly createDocs: (corpus: PackedDocs, options: DocsOptions) => DocsSurface;
}

interface MarkerTier {
  readonly COMPREHENDO_MARKER: symbol;
}

const BUILT = (name: string, module: string): URL =>
  new URL(`../packages/${name}/dist/${module}.js`, import.meta.url);

/**
 * One built module, or the sentence that says what to build. A module that
 * exists and throws on load is re-thrown untouched: only a genuinely missing
 * build is a precondition, and reporting an unrelated failure as one would
 * send the caller off to run a build that was never the problem.
 */
async function built<T>(name: string, module: string): Promise<T> {
  const url = BUILT(name, module);
  try {
    return (await import(/* @vite-ignore */ url.href)) as T;
  } catch (error) {
    if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new PreconditionError(
      `packages/${name} is not built (${url.pathname} is missing): run "npm run build --prefix packages/${name}"`,
    );
  }
}

/**
 * Render a corpus directory, through the real tooling end to end: [28]'s
 * `parse` and `pack`, then [13]'s own `parsePackedCorpus` and `createDocs`.
 * The topic menu is what `docs()` really answers, not a re-derivation of it,
 * so a corpus that engine would refuse never renders a file at all.
 *
 * The docs surface is given a sink rather than a log path: a generator must
 * not append to a maintainer's usage log (CC6 [27] keeps that file local and
 * meaningful, and a build step writing to it would be noise, not usage).
 */
export async function renderFromCorpus(corpusDir: string): Promise<string> {
  const format = await built<FormatTier>('registry-tools', 'corpus-format');
  const docs = await built<DocsTier>('core', 'docs');
  const marker = await built<MarkerTier>('core', 'marker');
  const packed = format.pack(format.parse(corpusDir));
  const surface = docs.createDocs(docs.parsePackedCorpus(packed.docs), { sink: () => undefined });
  const answer = surface();
  const index = 'topics' in answer ? answer.topics : [];
  return renderPacked(packed, index, marker.COMPREHENDO_MARKER.description ?? '');
}

/**
 * Corpus Format [28] refusing to read or to pack a corpus. That is a corpus
 * the author can fix, never a bug in this generator, so it exits 2 with the
 * violations 28 already named rather than 70 with a stack.
 *
 * Matched by name, not by `instanceof`: this script loads 28 from `dist/`
 * while a test suite loads it from `src/` under its own transform, and two
 * module instances do not share a class identity. The name is set by the
 * class itself and is what every other reader of these refusals matches on.
 */
const isCorpusRefusal = (error: unknown): boolean =>
  error instanceof Error && error.name === 'CorpusFormatError';

interface Invocation {
  readonly corpusDir: string;
  readonly out: string;
  readonly check: boolean;
}

/** argv in, one invocation out. Bad usage is a precondition, never a stack. */
function parseArgs(argv: readonly string[]): Invocation {
  const positional: string[] = [];
  let out: string | undefined;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    if (argument === '--check') {
      check = true;
    } else if (argument === '--out') {
      index += 1;
      out = argv[index];
      if (out === undefined) throw new PreconditionError('--out needs a file path');
    } else if (argument.startsWith('--')) {
      throw new PreconditionError(`unknown flag: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  const named = positional[0];
  if (named === undefined) throw new PreconditionError(USAGE.join('\n'));
  if (positional.length > 1) {
    throw new PreconditionError(`one corpus directory at a time, got ${String(positional.length)}`);
  }
  const corpusDir = resolve(named);
  return {
    corpusDir,
    out: out === undefined ? join(corpusDir, OUTPUT_FILE) : isAbsolute(out) ? out : resolve(out),
    check,
  };
}

/** The rendered file, or the exit code that says why there is none. */
async function rendered(
  invocation: Invocation,
  err: Writer,
): Promise<{ content: string } | { code: number }> {
  if (!existsSync(invocation.corpusDir)) {
    err(`there is no corpus directory at ${invocation.corpusDir}`);
    return { code: 2 };
  }
  try {
    return { content: await renderFromCorpus(invocation.corpusDir) };
  } catch (error) {
    if (error instanceof PreconditionError || isCorpusRefusal(error)) {
      err(error instanceof Error ? error.message : String(error));
      return { code: 2 };
    }
    throw error;
  }
}

/**
 * The verb. Returns the exit code rather than exiting, so the gate can assert
 * on it in-process as well as across a real process boundary.
 */
export async function main(argv: readonly string[], out: Writer, err: Writer): Promise<number> {
  let invocation: Invocation;
  try {
    invocation = parseArgs(argv);
  } catch (error) {
    err(error instanceof PreconditionError ? error.message : String(error));
    return 2;
  }
  const result = await rendered(invocation, err);
  if (!('content' in result)) return result.code;
  const content = result.content;

  if (!invocation.check) {
    writeFileSync(invocation.out, content);
    out(`wrote ${invocation.out} (${count(content.split('\n').length - 1, 'line')})`);
    return 0;
  }
  if (!existsSync(invocation.out)) {
    err(`drift: there is no ${OUTPUT_FILE} at ${invocation.out}, and the corpus generates one`);
    return 1;
  }
  const report = driftReport(readFileSync(invocation.out, 'utf8'), content);
  if (report.length === 0) {
    out(`${invocation.out} is current with the corpus`);
    return 0;
  }
  err(`drift: ${invocation.out} is not what ${invocation.corpusDir} generates`);
  for (const line of report) err(line);
  err(`regenerate it with: node scripts/generate-comprehendo-md.ts ${invocation.corpusDir}`);
  return 1;
}

/** Invoked as a script, not imported: run the verb and carry its exit code. */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(
    process.argv.slice(2),
    (line) => process.stdout.write(`${line}\n`),
    (line) => process.stderr.write(`${line}\n`),
  )
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String((error as Error).stack ?? error)}\n`);
      process.exitCode = 70;
    });
}
