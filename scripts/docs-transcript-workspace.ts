// Docs As Tests [37]: the workspace one transcript line runs in, and the one
// real invocation of it.
//
// Split from `run-docs-code-blocks.ts` at the project's size gate. Everything
// here answers "what does this command line need on disk, and what did running
// it really do"; the verdict on what that MEANS belongs to the runner.
//
// THE FORMAT GAP THIS FILE IS. Nothing in the corpus authoring format carries
// "here is the media this example needs". `test/helpers/ffmpeg-witnesses.ts`
// already records that gap for the inducing invocations and answers it with a
// declared per-case setup; this is the same answer for the examples a
// generated doc quotes. Every fixture is built by the binary itself out of
// `lavfi`, so a run needs no external media and reproduces on any machine
// carrying the program.
//
// A TRANSCRIPT IS NEVER SHELLED. `invoke` spawns an argv array, so an operand
// can never become a command, and the program itself must be on an allowlist
// derived from the corpus's own `declared_schema.surface`. Corpus text is
// data, never instructions.
//
// @see .mdd/docs/37-docs-as-tests.md

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PreconditionError, WorkspaceError } from './docs-code-blocks.ts';

/** The executable under test. Overridable so CI can point at a pinned build. */
const SURFACE_PATH = process.env['COMPREHENDO_FFMPEG'] ?? '';

/** How long one documented invocation may take before it is a failure. */
const TIMEOUT = 120_000;

/** What a file named in a transcript IS, before the command runs. */
type FixtureRole = 'input' | 'present-output' | 'absent';

interface Fixture {
  readonly name: string;
  readonly role: FixtureRole;
  /** How the binary itself builds it. Absent exactly when the role is absent. */
  readonly make?: (cache: string, name: string) => void;
}

const video =
  (size: string) =>
  (cache: string, name: string): void =>
    build(cache, name, [
      ...['-f', 'lavfi', '-i', `testsrc=size=${size}:rate=10:duration=1`],
      ...['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', name],
    ]);

const videoWithAudio = (cache: string, name: string): void =>
  build(cache, name, [
    ...['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=1'],
    ...['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '1'],
    ...['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-y', name],
  ]);

const textFile = (cache: string, name: string): void => {
  writeFileSync(join(cache, name), 'this is not a media file\n', 'utf8');
};

/**
 * The workspace the flagship corpus's transcripts name.
 *
 * Two roles beyond `input` carry real meaning and both are read off the corpus
 * rather than guessed: `present-output` exists because `FFMPEG_OUTPUT_EXISTS`
 * is a twin ABOUT an output that is already there, and `absent` exists because
 * `FFMPEG_INPUT_NOT_FOUND` is a twin about a file that is not. A transcript
 * reading anything NOT on this list fails naming it, so a new example arriving
 * with new media goes red rather than being quietly skipped.
 */
const WORKSPACE: readonly Fixture[] = Object.freeze([
  { name: 'clip.mp4', role: 'input', make: video('320x240') },
  { name: 'clip-1442x1440.mp4', role: 'input', make: video('1442x1440') },
  { name: 'video-only.mp4', role: 'input', make: video('320x240') },
  { name: 'with-audio.mp4', role: 'input', make: videoWithAudio },
  { name: 'notes.txt', role: 'input', make: textFile },
  { name: 'exists.mp4', role: 'present-output', make: video('64x64') },
  { name: 'does-not-exist.mp4', role: 'absent' },
]);

const fixtureFor = (name: string): Fixture | undefined =>
  WORKSPACE.find((fixture) => fixture.name === name);

/** One program a transcript may name. */
export interface Program {
  readonly name: string;
  /** Whether this program's FINAL operand is a file it writes rather than reads. */
  readonly writesFinalOperand: boolean;
}

/**
 * Programs a transcript may name beyond the corpus's own declared surface.
 *
 * Declared here with the reason, never inferred from the text: the ffmpeg
 * corpus's `inputs` topic uses `ffprobe` as the diagnostic next step after an
 * unreadable file, and ffprobe reads its operands and writes none.
 */
const COMPANIONS: Readonly<Record<string, readonly Program[]>> = Object.freeze({
  ffmpeg: Object.freeze([Object.freeze({ name: 'ffprobe', writesFinalOperand: false })]),
});

/** The allowlist for one corpus: its declared surface, and its companions. */
export const programsFor = (surface: string): readonly Program[] =>
  Object.freeze([
    Object.freeze({ name: surface, writesFinalOperand: true }),
    ...(COMPANIONS[surface] ?? []),
  ]);

/** Where the program really lives, honouring the pinned-build override. */
const programPath = (name: string, surface: string): string =>
  SURFACE_PATH === '' ? name : SURFACE_PATH.replace(new RegExp(`${surface}$`), name);

/** One fixture build, by the binary itself. A failure here is never silent. */
function build(cache: string, name: string, argv: readonly string[]): void {
  const made = spawnSync(programPath('ffmpeg', 'ffmpeg'), ['-hide_banner', '-nostdin', ...argv], {
    cwd: cache,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: TIMEOUT,
  });
  if (made.status !== 0) {
    throw new PreconditionError(`could not build the workspace fixture ${name}:\n${made.stderr}`);
  }
}

/**
 * The binary, or the sentence that says what CI owes.
 *
 * Never a skip: the same call ffmpeg Corpus [32] makes about a missing binary,
 * because a green run that executed nothing is exactly the folklore this gate
 * exists to catch.
 */
export function requireProgram(surface: string): void {
  try {
    execFileSync(programPath(surface, surface), ['-version'], { encoding: 'utf8', stdio: 'pipe' });
  } catch (cause) {
    throw new PreconditionError(
      `this gate executes the corpus's own examples against a real ${surface} and found none on PATH: ${(cause as Error).message}`,
    );
  }
}

/**
 * The files a command READS.
 *
 * For the writing surface that is the operand after each `-i`, minus the ones
 * carrying `=`, which are device and filter specifications (`testsrc=...`) and
 * never paths. For a reading companion it is every positional operand that is
 * not itself the operand of a flag.
 */
function readsOf(argv: readonly string[], program: Program): readonly string[] {
  const operands = argv.slice(1);
  const reads: string[] = [];
  for (let at = 0; at < operands.length; at += 1) {
    const value = operands[at] ?? '';
    if (value.startsWith('-') || value.includes('=')) continue;
    const before = operands[at - 1] ?? '';
    if (program.writesFinalOperand) {
      if (before === '-i') reads.push(value);
      continue;
    }
    if (!before.startsWith('-')) reads.push(value);
  }
  return reads;
}

/**
 * One command's own workspace, seeded from the declared table.
 *
 * A fixture is materialized when the command names it, EXCEPT an `input` this
 * command writes rather than reads (the synthetic-source example really does
 * produce `clip.mp4`, and pre-creating it would turn that example into the
 * output-already-exists failure instead) and except one declared absent.
 */
function prepare(site: string, argv: readonly string[], program: Program, cache: string): void {
  const reads = readsOf(argv, program);
  for (const name of reads) {
    if (fixtureFor(name) === undefined) {
      throw new WorkspaceError(
        `the transcript reads ${name}, which this runner's declared workspace does not carry; declare it in docs-transcript-workspace.ts rather than leaving the example unrun`,
      );
    }
  }
  const writeTarget = program.writesFinalOperand ? (argv[argv.length - 1] ?? '') : '';
  for (const name of new Set(argv.slice(1))) {
    const fixture = fixtureFor(name);
    if (fixture?.make === undefined) continue;
    if (fixture.role === 'input' && name === writeTarget && !reads.includes(name)) continue;
    if (!existsSync(join(cache, name))) fixture.make(cache, name);
    copyFileSync(join(cache, name), join(site, name));
  }
}

/** What one real invocation did: its exit status and the stderr it wrote. */
export interface Invocation {
  readonly status: number;
  readonly stderr: string;
  /** Set only when the program could not be run at all. */
  readonly unrunnable?: string;
}

/**
 * One transcript line, really run, in a workspace of its own.
 *
 * A FRESH workspace per command, not per block, and that is the faithful
 * reading rather than a workaround: the corpus's example blocks are lists of
 * alternative invocations of one situation, not scripts, and they deliberately
 * omit `-y` because the output-already-exists failure is itself a cataloged
 * twin. Run as a script they would collide on `out.mp4` and report a failure
 * the doc never claimed.
 *
 * The fixture cache is shared across the run: the media is built once by the
 * binary and copied in, so what is fresh is the workspace STATE, which is the
 * thing that matters, and a full surface costs seconds instead of minutes.
 */
export function invoke(
  argv: readonly string[],
  program: Program,
  surface: string,
  cache: string,
): Invocation {
  const site = mkdtempSync(join(tmpdir(), 'comprehendo-37-'));
  try {
    prepare(site, argv, program, cache);
    const result = spawnSync(programPath(program.name, surface), [...argv.slice(1)], {
      cwd: site,
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: TIMEOUT,
    });
    if (result.error !== undefined) {
      return Object.freeze({ status: -1, stderr: '', unrunnable: result.error.message });
    }
    return Object.freeze({ status: result.status ?? -1, stderr: result.stderr });
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
}

/** The shared fixture cache for one run, and its removal. */
export const fixtureCache = (): { readonly path: string; readonly cleanup: () => void } => {
  const path = mkdtempSync(join(tmpdir(), 'comprehendo-37-cache-'));
  return { path, cleanup: (): void => rmSync(path, { recursive: true, force: true }) };
};
