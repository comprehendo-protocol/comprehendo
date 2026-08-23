// Upstream Watch [34]: the ffmpeg half of the watch, which is the half that
// spawns things.
//
// `src/upstream-watch.ts` knows nothing about ffmpeg: it compares a lock entry
// against an OBSERVATION and reports drift. This file is where an observation
// comes from, and it comes the only way it can, by running the really-installed
// binary and reading what it really did.
//
// WHY IT LIVES IN THE TEST TREE, same reason ffmpeg-cli.ts does: CC6 [27]
// forbids `child_process` anywhere under `packages/*/src`, and re-probing an
// upstream tool is verification, never runtime. The split is deliberate rather
// than incidental: the lock FORMAT and the drift COMPARISON generalize to any
// wrapped tool, and only this file knows what `ffmpeg`, `dimensions` and
// `video-with-audio` mean.
//
// Every name a lock entry can carry (a program, a fixture, a capture reader)
// is refused here by name when it is unknown. A probe runner that shrugged at
// an unknown name would report a locked element as clean without having
// observed it, which is the one outcome this feature exists to prevent.

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { subjectOf } from '../../src/upstream-lock.js';
import type { LockCapture, LockEntry, UpstreamLock } from '../../src/upstream-lock.js';
import type { SurfaceObservation } from '../../src/upstream-watch.js';
import {
  FFMPEG,
  dimensions,
  ffmpegVersion,
  makeTextFile,
  makeVideo,
  makeVideoWithAudio,
  run,
  streamKinds,
  workspace,
} from './ffmpeg-cli.js';

/** The repository root, from `packages/registry-tools/test/helpers`. */
export const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

/** The lock file this feature owns. */
export const FFMPEG_LOCK_PATH = join(REPO_ROOT, 'corpora', 'ffmpeg', 'upstream-watch.lock');

/** The version string the binary the watch is scanning really reports. */
export const scannedVersion = (): string => ffmpegVersion();

/** The named workspaces a locked probe can ask for, and nothing else. */
const FIXTURES: Readonly<Record<string, (cwd: string) => void>> = Object.freeze({
  clip: (cwd: string): void => void makeVideo(cwd, 'clip.mp4'),
  'video-only': (cwd: string): void => void makeVideo(cwd, 'video-only.mp4'),
  'video-with-audio': (cwd: string): void => void makeVideoWithAudio(cwd, 'av.mp4'),
  'text-file': (cwd: string): void => void makeTextFile(cwd, 'notes.txt'),
  'existing-output': (cwd: string): void => void makeVideo(cwd, 'exists.mp4', '64x64'),
});

/** The named readings a locked probe can take from what the run produced. */
const READERS: Readonly<Record<string, (cwd: string, file: string) => string>> = Object.freeze({
  dimensions: (cwd: string, file: string): string => dimensions(cwd, file),
  streamKinds: (cwd: string, file: string): string => streamKinds(cwd, file).join(','),
});

/** ffprobe, resolved beside whichever ffmpeg the run is scanning. */
const ffprobeOf = (): string => FFMPEG.replace(/ffmpeg$/, 'ffprobe');

interface ProgramRun {
  readonly status: number;
  readonly stderr: string;
}

/** One real invocation of one of the two programs this corpus's entries name. */
function runProgram(program: string, argv: readonly string[], cwd: string): ProgramRun {
  if (program === 'ffmpeg') {
    const result = run(argv, cwd);
    return { status: result.status, stderr: result.stderr };
  }
  if (program !== 'ffprobe') {
    throw new Error(
      `the lock names the program ${program}, which this runner does not know how to run; an unknown program is refused rather than reported clean`,
    );
  }
  const result = spawnSync(ffprobeOf(), [...argv], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 120_000,
  });
  if (result.error !== undefined) {
    throw new Error(`could not run ${ffprobeOf()}: ${result.error.message}`);
  }
  return { status: result.status ?? -1, stderr: result.stderr };
}

function buildFixture(name: string, cwd: string): void {
  const build = FIXTURES[name];
  if (build === undefined) {
    throw new Error(
      `the lock asks for the fixture ${name}, which this runner does not build; an unknown fixture is refused rather than probed against an empty workspace`,
    );
  }
  build(cwd);
}

function takeCapture(capture: LockCapture, cwd: string): string {
  const read = READERS[capture.read];
  if (read === undefined) {
    throw new Error(
      `the lock asks for the reading ${capture.read}, which this runner cannot take; an unknown reading is refused rather than reported as matching`,
    );
  }
  return read(cwd, capture.file);
}

/**
 * Re-observe one locked element against the tool as it is installed right now.
 *
 * Each probe gets its own temp workspace, so probes cannot see each other's
 * output files and the order they run in cannot change what any of them
 * observes.
 */
export function probeOne(entry: LockEntry): SurfaceObservation {
  const site = workspace();
  try {
    const fixture = entry.probe.fixture;
    if (fixture !== undefined) buildFixture(fixture, site.path);
    const result = runProgram(entry.probe.program, entry.probe.argv, site.path);
    const capture =
      entry.probe.capture !== undefined ? takeCapture(entry.probe.capture, site.path) : undefined;
    return Object.freeze({
      subject: subjectOf(entry),
      status: result.status,
      stderr: result.stderr,
      ...(capture !== undefined ? { capture } : {}),
    });
  } finally {
    site.cleanup();
  }
}

/** Every locked element, re-observed. One pass, one report. */
export function probeAll(lock: UpstreamLock): readonly SurfaceObservation[] {
  return Object.freeze(lock.entries.map((entry) => probeOne(entry)));
}
