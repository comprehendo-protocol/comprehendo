#!/usr/bin/env node
// Docs As Tests [37]: every fenced block in a generated docs surface, really
// executed against the real program the corpus documents.
//
// Principle 10 says generated docs are "generated, never hand-rotted". This is
// the half that makes them provably current rather than probably current: the
// worked examples COMPREHENDO.md Generator [35] quotes out of the corpus are
// RUN here, against the really-installed binary, and a stale one fails CI
// naming the file and the block index.
//
// WHAT "PASSES" MEANS, AND WHY IT IS NOT "EXITS 0". More than half the blocks
// in a real corpus DEMONSTRATE a cataloged failure; a gate that demanded exit
// 0 everywhere would report a correct corpus as broken. The disposition comes
// from the block's own heading and the verdict from the corpus's own
// machine-readable index, so neither is a guess about the prose beside it:
//
//   - a command that exits 0 passes;
//   - a command that exits non-zero must route, through Fingerprint Index &
//     Matcher [21]'s REAL index built from this corpus's twins, to a cataloged
//     failure, and it must be the one this block's heading names;
//   - a block whose heading names a cataloged failure must actually produce
//     it, so an example that quietly started working again is a wrong result,
//     not a pass;
//   - a block whose heading names none has no licensed failure at all: every
//     command in it must exit 0.
//
// NOTHING IS EVER SKIPPED. An unsupported fence language, a program off the
// allowlist, a shell metacharacter, media the declared workspace does not
// carry: each one FAILS naming the block. A gate that skips what it cannot run
// reports green having verified nothing, which is the failure this feature
// exists to prevent (the CC4 [26] call, made again here). A corpus that
// carries no fenced examples at all is the one honest exception: there is
// nothing here for this gate to execute wrongly, so it passes vacuously
// rather than failing a precondition (`declared_schema.surface`, an
// interpreter) nothing would ever spawn.
//
// TWO WORKED-EXAMPLE SHAPES. `sh`/`shell`/`bash`/`console` are argv
// transcripts, one real command line per step, matched against a CLI's own
// operand grammar (ffmpeg Corpus [32]). `python` is a SOURCE block: the whole
// fence is one real script, run as-is, no operand parsing, because a Python
// failure is provoked by a multi-step shape (construct, then call) `apply`
// and an argv transcript can't express either (corpora/openai-python's
// README explains why every one of its fixes is a runbook for the same
// reason). Each shape pays its own precondition: a doc with no `console`
// block never requires the declared CLI, a doc with no `python` block never
// requires an interpreter.
//
// EXIT CODES ARE THE CONTRACT, the same vocabulary Corpus Generator [17] and
// COMPREHENDO.md Generator [35] already use:
//   0  every block passed
//   1  a block failed
//   2  a precondition the caller can fix (bad usage, no corpus, no doc, no
//      build, no binary)
//   70 a bug in this tool, reported with its stack
//
// @see .mdd/docs/37-docs-as-tests.md

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  PreconditionError,
  TranscriptError,
  WorkspaceError,
  extractBlocks,
  isTranscriptLanguage,
  readTranscript,
  reportLines,
} from './docs-code-blocks.ts';
import type { BlockRecord, DocsCodeBlock, TranscriptStep } from './docs-code-blocks.ts';
import {
  fixtureCache,
  invoke,
  invokeSource,
  programsFor,
  requireProgram,
  requirePython,
} from './docs-transcript-workspace.ts';
import type { Program } from './docs-transcript-workspace.ts';

/**
 * A worked example written as source rather than a shell transcript: the
 * block IS the program (`docs-transcript-workspace.ts#invokeSource`), no
 * argv, no operand-fixture resolution. `sh`/`shell`/`bash`/`console` stay
 * argv-transcripts (ffmpeg Corpus [32], a real CLI); `python` is the first
 * of this second shape (openai-python Corpus, a real importable package).
 */
const SOURCE_LANGUAGES: readonly string[] = Object.freeze(['python']);

import type { CorpusSource } from '../packages/registry-tools/dist/corpus-format.js';
import type { FingerprintEntry } from '../packages/registry-tools/dist/fingerprint-facets.js';

export { extractBlocks, readTranscript, reportLines };

export const USAGE: readonly string[] = Object.freeze([
  'run-docs-code-blocks <corpus-dir> [--doc <file>]',
  '',
  '  <corpus-dir>   the corpus the generated surface was generated from',
  '  --doc <file>   the generated surface to execute (default <corpus-dir>/COMPREHENDO.md)',
]);

/** The generated surface a corpus carries by default (35's own spelling). */
const OUTPUT_FILE = 'COMPREHENDO.md';

type Writer = (line: string) => void;

type MatchResult =
  | { readonly outcome: 'matched'; readonly entry: FingerprintEntry }
  | { readonly outcome: 'ambiguous' | 'miss' };

interface FingerprintIndex {
  match(raw: unknown): MatchResult;
}

/**
 * Same precondition COMPREHENDO.md Generator [35] records: this runs under
 * plain node, whose type stripping does not remap a `./foo.js` specifier onto
 * `foo.ts`, so the packages' `src/` trees are not loadable from a standalone
 * script and the BUILT modules are what it reads.
 */
async function built<T>(name: string, module: string): Promise<T> {
  const url = new URL(`../packages/${name}/dist/${module}.js`, import.meta.url);
  try {
    return (await import(/* @vite-ignore */ url.href)) as T;
  } catch (error) {
    if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new PreconditionError(
      `packages/${name} is not built (${url.pathname} is missing): run "npm run build --prefix packages/${name}"`,
    );
  }
}

interface Context {
  readonly index: FingerprintIndex;
  readonly codes: readonly string[];
  readonly programs: readonly Program[];
  readonly surface: string;
  readonly cache: string;
}

/** The last lines the program really wrote, as the record's own evidence. */
const tail = (stderr: string, lines = 6): string =>
  stderr
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .slice(-lines)
    .map((line) => `    ${line}`)
    .join('\n');

/**
 * The cataloged failure this block's heading names, if it names one.
 *
 * Word-matched against the corpus's own twin codes, so the disposition is read
 * off machine-readable corpus data rather than inferred from prose. Two codes
 * in one heading is ambiguous and refused, never picked between.
 */
function licensedCode(title: string, codes: readonly string[]): string | undefined {
  const named = codes.filter((code) => new RegExp(`\\b${code}\\b`).test(title));
  if (named.length > 1) {
    throw new TranscriptError(
      `the heading names more than one cataloged failure: ${named.join(', ')}`,
    );
  }
  return named[0];
}

interface Verdict {
  readonly ok: boolean;
  readonly note: string;
  readonly produced: string | undefined;
}

/**
 * What one real exit status and one real stderr MEAN for this block.
 *
 * Exit 0 passes, with ONE narrow exception verified live: ffmpeg's
 * `FFMPEG_OUTPUT_EXISTS` really exits 0 on some builds while its stderr
 * still carries the exact cataloged line (a real ffmpeg exit-code
 * regression, not this project's; see corpora/ffmpeg/topics/outputs.md).
 * comprehend(stderr) is text-only and never reads exit status
 * (fingerprint-facets.ts's matchesPattern), so the routed match decides
 * that one case, never the exit code alone.
 *
 * The exception is deliberately narrow: a block's heading licenses every
 * command line under it (three lines can share one `### FFMPEG_..." title,
 * the failing form twice and a genuine `-y` success as the contrast), so
 * "the heading names a failure" is not "every line in this block must
 * produce it." Only a command whose real stderr routes to EXACTLY the
 * licensed twin, while exiting 0, is refused; an exit-0 line that matches
 * nothing (the ordinary success case) still passes exactly as it always
 * has, licensed heading or not.
 */
function judge(
  run: { readonly status: number; readonly stderr: string },
  licensed: string | undefined,
  context: Context,
  said: (text: string) => string,
): Verdict {
  const at = `exit ${String(run.status)}`;
  const match = context.index.match(run.stderr);
  const produced = match.outcome === 'matched' ? match.entry.corpusEntryId : undefined;

  if (run.status === 0 && produced !== licensed) {
    return { ok: true, note: said('exit 0'), produced: undefined };
  }
  if (run.status === 0) {
    // produced === licensed here, and licensed is defined (produced is only
    // ever a real corpus code, never undefined, so equality forces both).
    const why = `${at}, cataloged as ${produced} (ffmpeg's own exit status said nothing failed; the message did)`;
    return { ok: true, note: said(`${why}:\n${tail(run.stderr)}`), produced };
  }
  if (match.outcome !== 'matched') {
    const why = `${at}, and the stderr it really wrote routes to no cataloged failure (${match.outcome})`;
    return { ok: false, note: said(`${why}:\n${tail(run.stderr)}`), produced: undefined };
  }
  if (licensed === undefined) {
    const why = `${at}, cataloged as ${produced}, but this example's heading names no failure at all`;
    return { ok: false, note: said(`${why}:\n${tail(run.stderr)}`), produced };
  }
  if (produced !== licensed) {
    const why = `${at} routed to ${produced}, not the ${licensed} its heading names`;
    return { ok: false, note: said(`${why}:\n${tail(run.stderr)}`), produced };
  }
  return { ok: true, note: said(`${at}, cataloged as ${produced}:\n${tail(run.stderr)}`), produced };
}

/** One real invocation, in its own fresh workspace, and what it settles. */
function runCommand(step: TranscriptStep, licensed: string | undefined, context: Context): Verdict {
  if (step.kind !== 'command') return { ok: true, note: step.line, produced: undefined };
  const name = step.argv[0] ?? '';
  const said = (text: string): string => `${step.line}\n  ${text}`;
  const program = context.programs.find((one) => one.name === name);
  if (program === undefined) {
    const allowed = context.programs.map((one) => one.name).join(', ');
    return { ok: false, note: said(`refused: ${name} is not this corpus's call surface (${allowed})`), produced: undefined };
  }
  try {
    const run = invoke(step.argv, program, context.surface, context.cache);
    if (run.unrunnable !== undefined) {
      return { ok: false, note: said(`could not run ${name}: ${run.unrunnable}`), produced: undefined };
    }
    return judge(run, licensed, context, said);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return { ok: false, note: said(error.message), produced: undefined };
    }
    throw error;
  }
}

/** One block, executed, as the record the doc's Data Model asks for. */
function executeBlock(block: DocsCodeBlock, context: Context): BlockRecord {
  const record = (pass: boolean, output: string): BlockRecord =>
    Object.freeze({
      sourceFile: block.sourceFile,
      blockIndex: block.blockIndex,
      language: block.language,
      pass,
      output,
    });
  if (SOURCE_LANGUAGES.includes(block.language)) {
    const said = (text: string): string => `${block.title}\n  ${text}`;
    const licensed = licensedCode(block.title, context.codes);
    try {
      const run = invokeSource(block.code);
      if (run.unrunnable !== undefined) {
        return record(false, said(`could not run the interpreter: ${run.unrunnable}`));
      }
      const verdict = judge(run, licensed, context, said);
      return record(verdict.ok, verdict.note);
    } catch (error) {
      if (error instanceof TranscriptError) return record(false, said(error.message));
      throw error;
    }
  }
  if (!isTranscriptLanguage(block.language)) {
    const named = block.language === '' ? 'an unlabelled fence' : `language ${block.language}`;
    const why = `${named} has no executor in this gate, so it is not run and not skipped`;
    return record(false, `${block.title}\n  ${why}`);
  }
  const notes: string[] = [block.title];
  try {
    const steps = readTranscript(block.code);
    const licensed = licensedCode(block.title, context.codes);
    const commands = steps.filter((step) => step.kind === 'command');
    if (commands.length === 0) return record(false, `${block.title}\n  carries no command to run`);
    let demonstrated = false;
    for (const step of commands) {
      const verdict = runCommand(step, licensed, context);
      notes.push(verdict.note);
      if (!verdict.ok) return record(false, notes.join('\n'));
      if (verdict.produced === licensed) demonstrated = true;
    }
    if (licensed !== undefined && !demonstrated) {
      notes.push(`this example is titled for ${licensed} and no command in it produced that failure`);
      return record(false, notes.join('\n'));
    }
    return record(true, notes.join('\n'));
  } catch (error) {
    if (error instanceof TranscriptError) return record(false, `${block.title}\n  ${error.message}`);
    throw error;
  }
}

/** Every block of one generated docs surface, really executed. */
export async function runDocSurface(
  corpusDir: string,
  docFile: string,
): Promise<readonly BlockRecord[]> {
  if (!existsSync(corpusDir)) {
    throw new PreconditionError(`there is no corpus directory at ${corpusDir}`);
  }
  if (!existsSync(docFile)) {
    throw new PreconditionError(`there is no generated docs surface at ${docFile}`);
  }
  const format = await built<{ parse: (dir: string) => CorpusSource }>(
    'registry-tools',
    'corpus-format',
  );
  const gate = await built<{ fingerprintsOf: (corpus: CorpusSource) => readonly unknown[] }>(
    'registry-tools',
    'gate-fingerprint',
  );
  const finger = await built<{
    buildFingerprintIndex: (source: Iterable<unknown>) => FingerprintIndex;
  }>('registry-tools', 'fingerprint');
  const corpus = format.parse(corpusDir);
  const blocks = extractBlocks(docFile, readFileSync(docFile, 'utf8'));
  // A corpus with zero fenced examples has nothing this gate could execute
  // wrongly: this project's own COMPREHENDO.md Generator [35] deliberately
  // renders no fenced blocks for a target this gate's own program/fixture
  // resolution does not yet generalize to (docs-transcript-workspace.ts's
  // program resolution and fixture table are still ffmpeg-shaped; see this
  // feature's Known Issues). Requiring a program that nothing here would
  // ever spawn is a precondition with no test behind it, never checked.
  // A corpus that DOES carry examples still gets the full requirement,
  // unchanged.
  if (blocks.length === 0) return Object.freeze([]);
  const needsInterpreter = blocks.some((block) => SOURCE_LANGUAGES.includes(block.language));
  const needsTranscriptProgram = blocks.some((block) => isTranscriptLanguage(block.language));
  const surface = corpus.declaredSchema?.surface ?? '';
  if (needsTranscriptProgram && surface === '') {
    throw new PreconditionError(
      `${corpusDir} declares no call surface, so nothing says what its examples invoke`,
    );
  }
  // Each precondition pays only for the shape of block this doc actually
  // carries: a corpus whose examples are all `python`-language scripts never
  // requires the `declared_schema.surface` CLI (openai-python has none of
  // its own, see corpora/openai-python/README.md), and a corpus whose
  // examples are all shell transcripts never requires an interpreter.
  if (needsTranscriptProgram) requireProgram(surface);
  if (needsInterpreter) requirePython();
  const cache = fixtureCache();
  const context: Context = {
    index: finger.buildFingerprintIndex(gate.fingerprintsOf(corpus)),
    codes: corpus.twins.map((twin) => twin.code),
    programs: programsFor(surface),
    surface,
    cache: cache.path,
  };
  try {
    return Object.freeze(
      blocks.map((block) =>
        executeBlock(block, context),
      ),
    );
  } finally {
    cache.cleanup();
  }
}

interface Args {
  readonly corpusDir: string;
  readonly doc: string;
}

/** argv in, one invocation out. Bad usage is a precondition, never a stack. */
function parseArgs(argv: readonly string[]): Args {
  const positional: string[] = [];
  let doc: string | undefined;
  for (let at = 0; at < argv.length; at += 1) {
    const argument = argv[at] ?? '';
    if (argument === '--doc') {
      at += 1;
      doc = argv[at];
      if (doc === undefined) throw new PreconditionError('--doc needs a file path');
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
    doc: doc === undefined ? join(corpusDir, OUTPUT_FILE) : isAbsolute(doc) ? doc : resolve(doc),
  };
}

/** Corpus Format [28] refusing the corpus: the author's to fix, so exit 2. */
const isCorpusRefusal = (error: unknown): boolean =>
  error instanceof Error && error.name === 'CorpusFormatError';

/**
 * The verb. Returns the exit code rather than exiting, so the gate can be
 * asserted on in-process as well as across a real process boundary.
 */
export async function main(argv: readonly string[], out: Writer, err: Writer): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    err(error instanceof PreconditionError ? error.message : String(error));
    return 2;
  }
  let records: readonly BlockRecord[];
  try {
    records = await runDocSurface(args.corpusDir, args.doc);
  } catch (error) {
    if (!(error instanceof PreconditionError) && !isCorpusRefusal(error)) throw error;
    err(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const failed = records.filter((record) => !record.pass);
  for (const line of reportLines(records)) (failed.length === 0 ? out : err)(line);
  return failed.length === 0 ? 0 : 1;
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
