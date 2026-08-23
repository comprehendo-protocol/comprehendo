// ffmpeg Corpus [32]: the REAL binary, and the process boundary the folklore
// rule (CC4 [26]) is settled across.
//
// Every claim `corpora/ffmpeg/` makes is a claim about a program, not about a
// module, so nothing here doubles ffmpeg. `run` spawns the really-installed
// `ffmpeg` executable, captures the stderr it really wrote and the exit status
// it really returned, and hands both back to the parent. That crossing is the
// process boundary this feature owns: the child records a failure in stderr,
// and the parent observes it through the SAME text a caught invocation would
// hand `comprehend(raw)`.
//
// WHY THIS LIVES IN THE TEST TREE. CC6 [27] forbids `child_process` anywhere
// under `packages/*/src`, and the scan that enforces it reads `src/` only (see
// `packages/core/test/no-telemetry.test.ts`). Spawning is a verification step,
// never a runtime one, so it lives here beside `gate-fixture.ts`, which spawns
// npm for the same reason.
//
// WHY A MISSING BINARY IS A FAILURE AND NEVER A SKIP. 26 is explicit that a
// cataloged entry is provoked by an actual test actually triggering the
// failure. A suite that skips itself when ffmpeg is absent reports green while
// having verified nothing, which is precisely the folklore the rule exists to
// catch, so `requireFfmpeg` throws and names what CI owes.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The executable under test. Overridable so CI can point at a pinned build. */
export const FFMPEG = process.env['COMPREHENDO_FFMPEG'] ?? 'ffmpeg';

/** What one real invocation did: its exit status and the stderr it wrote. */
export interface FfmpegRun {
  readonly argv: readonly string[];
  readonly status: number;
  readonly stderr: string;
}

/**
 * One real ffmpeg invocation.
 *
 * `-nostdin` is passed by every caller through `INDUCE_PREFIX` rather than
 * here, because it is part of what a cataloged invocation IS (the
 * output-already-exists entry catalogs the non-interactive wording, which is a
 * different message from the interactive prompt); this function adds nothing
 * to an argv it is handed.
 *
 * Never a shell: the argv is an array, so an operand is an argument and can
 * never be a command. That is the whole reason a corpus `apply` for a CLI
 * surface is safe (see corpora/ffmpeg/README.md).
 */
export function run(argv: readonly string[], cwd: string): FfmpegRun {
  const result = spawnSync(FFMPEG, [...argv], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 120_000,
  });
  if (result.error !== undefined) {
    throw new Error(
      `could not run ${FFMPEG}: ${result.error.message}; this suite induces every cataloged failure out of the real binary and never simulates one`,
    );
  }
  return Object.freeze({
    argv: Object.freeze([...argv]),
    status: result.status ?? -1,
    stderr: result.stderr,
  });
}

/** The banner is suppressed and the prompt is refused: a scripted invocation. */
export const INDUCE_PREFIX: readonly string[] = Object.freeze(['-hide_banner', '-nostdin']);

/** The version string the real binary reports, for the induction record. */
export function ffmpegVersion(): string {
  const out = execFileSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  return (out.split('\n')[0] ?? '').trim();
}

/** Throws, naming what CI owes, when the real binary is not there to induce. */
export function requireFfmpeg(): string {
  try {
    return ffmpegVersion();
  } catch (cause) {
    throw new Error(
      `the ffmpeg corpus suites need a real ffmpeg on PATH (or COMPREHENDO_FFMPEG pointing at one) and found none: ${(cause as Error).message}. ` +
        'CC4 [26] ships no entry a test did not provoke, so these suites fail rather than skip: a green run that induced nothing is the folklore the rule exists to catch.',
    );
  }
}

/** A temp workspace that removes itself, so a suite leaves no tree behind. */
export function workspace(): { readonly path: string; readonly cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'comprehendo-32-'));
  return { path, cleanup: (): void => rmSync(path, { recursive: true, force: true }) };
}

/** A synthetic source clip, built by ffmpeg itself: no external media, ever. */
export function makeVideo(cwd: string, name: string, size = '320x240'): string {
  const made = run(
    [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      `testsrc=size=${size}:rate=10:duration=1`,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-y',
      name,
    ],
    cwd,
  );
  if (made.status !== 0) throw new Error(`could not build the fixture ${name}:\n${made.stderr}`);
  return join(cwd, name);
}

/** The same, with a silent audio track: the stream-selection safety case. */
export function makeVideoWithAudio(cwd: string, name: string): string {
  const made = run(
    [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=320x240:rate=10:duration=1',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=44100:cl=stereo',
      '-t',
      '1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-y',
      name,
    ],
    cwd,
  );
  if (made.status !== 0) throw new Error(`could not build the fixture ${name}:\n${made.stderr}`);
  return join(cwd, name);
}

/** A plain text file: what "not a media file" means, concretely. */
export function makeTextFile(cwd: string, name: string): string {
  mkdirSync(cwd, { recursive: true });
  writeFileSync(join(cwd, name), 'this is not a media file\n', 'utf8');
  return join(cwd, name);
}

/** The stream kinds a produced file really carries, read by real ffprobe. */
export function streamKinds(cwd: string, name: string): readonly string[] {
  const probe = spawnSync(
    FFMPEG.replace(/ffmpeg$/, 'ffprobe'),
    ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', name],
    { cwd, encoding: 'utf8' },
  );
  return Object.freeze(
    (probe.stdout ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== ''),
  );
}

/** The width and height a produced file really carries, read by real ffprobe. */
export function dimensions(cwd: string, name: string): string {
  const probe = spawnSync(
    FFMPEG.replace(/ffmpeg$/, 'ffprobe'),
    ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', name],
    { cwd, encoding: 'utf8' },
  );
  return (probe.stdout ?? '').trim();
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The CLI half of Corpus Format [28]'s `apply` grammar: what it MEANS to apply
 * literal call data to an argv.
 *
 * The grammar itself is 28's and is not reinterpreted here. `{operation:
 * operand}`, an array operand being the argument list, is read exactly the way
 * `gate-induce.ts`'s `readCalls` reads it; what this function adds is the one
 * thing a CLI surface needs and a module surface does not, namely where an
 * operation goes in an argument vector:
 *
 *   - a string operand means the option occurs once, carrying that operand;
 *   - an array operand means the option's occurrences are exactly those, in
 *     that order (ffmpeg options such as `-map` are repeatable, so "replace
 *     the operand" is ambiguous and "these are the occurrences" is not);
 *   - every existing occurrence of the option is removed first, and the
 *     replacements are inserted immediately before the output path, which is
 *     where ffmpeg reads per-output options.
 *
 * Two refusals, both load-bearing:
 *   - an operation the corpus's `declared_schema` does not declare is refused
 *     (CC7 [09] at apply time, not only at validate time);
 *   - an operand that is not a string, or an empty argument list, is refused,
 *     because an apply that cannot be read as literal call data is exactly how
 *     a compromised corpus would smuggle something past a checker.
 */
export function applyToArgv(
  argv: readonly string[],
  apply: unknown,
  declaredOperations: readonly string[],
): readonly string[] {
  const stages = Array.isArray(apply) ? apply : [apply];
  let next = [...argv];
  for (const stage of stages) {
    if (!isRecord(stage)) {
      throw new Error('an apply is literal call data: an object, or a list of them');
    }
    for (const [option, operand] of Object.entries(stage)) {
      if (!declaredOperations.includes(option)) {
        throw new Error(
          `the apply names ${option}, which this corpus's declared_schema does not declare; an apply stays inside the provider's own call surface`,
        );
      }
      const operands = Array.isArray(operand) ? operand : [operand];
      if (operands.length === 0 || !operands.every((one) => typeof one === 'string')) {
        throw new Error(
          `the apply for ${option} is not a string operand or a non-empty list of them, so it is not literal call data for a command line`,
        );
      }
      next = insertOption(dropOption(next, option), option, operands);
    }
  }
  return Object.freeze(next);
}

/** Every occurrence of an option, with its operand, gone. */
function dropOption(argv: readonly string[], option: string): string[] {
  const kept: string[] = [];
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === option) {
      at += 1;
      continue;
    }
    kept.push(argv[at] as string);
  }
  return kept;
}

/** The occurrences, in order, immediately before the output path. */
function insertOption(
  argv: readonly string[],
  option: string,
  operands: readonly string[],
): string[] {
  const added = operands.flatMap((operand) => [option, operand]);
  const at = Math.max(argv.length - 1, 0);
  return [...argv.slice(0, at), ...added, ...argv.slice(at)];
}
