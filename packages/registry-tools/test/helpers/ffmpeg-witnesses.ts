// ffmpeg Corpus [32]: the inducing invocation for every cataloged entry.
//
// THE FORMAT GAP THIS FILE IS. `gate-upstream.ts` already records it: nothing
// in the authoring corpus format carries "here is the call that provokes this
// failure". A fix's `apply` is the call that AVOIDS the failure, and the
// inverse is not derivable from it, so the inducing calls arrive beside the
// corpus as witnesses that the gate RUNS. This table is that, for a corpus
// whose target is a command-line program rather than a module.
//
// VERSION-SCOPED, because ffmpeg does not keep its wording (or its exit
// codes) stable across a major release, and this corpus now declares more
// than one supported major (`corpora/ffmpeg/manifest.json`'s
// `target.versions`). Every `argv` below is ONE invocation, shared across
// every supported major (an argv that only works on one range would be a
// second witness, not a version-scoped one; none of the twelve needs that).
// Each `observations` entry is a REAL, separately re-run capture: the exit
// status and a real stderr fragment, one per declared range, resolved
// against the installed binary by `observationFor`.
//
// Every argv below was run against both real binaries before it was written
// down (ffmpeg 4.4.2-0ubuntu0.22.04.1 and ffmpeg 6.1.1-3ubuntu5, the two
// ranges `manifest.json` declares), and every stderr fragment is text those
// runs really wrote. Nothing here is remembered, and nothing is paraphrased:
// ffmpeg's wording varies by version and build flags, so an entry nobody
// watched reproduce is folklore by construction (CC4 [26]).
//
// Every source is synthetic (`-f lavfi -i testsrc=...`), so an induction needs
// no external media, is deterministic, and is reproducible on any machine
// carrying a supported binary.

import { UnsupportedVersionError, matchesRange } from '../../src/version-range.js';
import { INDUCE_PREFIX, makeTextFile, makeVideo, makeVideoWithAudio } from './ffmpeg-cli.js';

/** One real, version-scoped capture of what an induction really wrote. */
export interface VersionedObservation {
  /** The declared range this capture belongs to, e.g. `>=4.4 <5`. */
  readonly versions: string;
  /** The exit status the run really returned. Never assumed nonzero: see
   * `FFMPEG_OUTPUT_EXISTS` on the `>=6 <8` range, which really returns 0. */
  readonly status: number;
  /** A literal fragment of the stderr the run really wrote, this range only. */
  readonly stderr: string;
}

/** How one cataloged failure is really provoked out of the real binary. */
export interface Witness {
  /** The twin `code` this run must produce, per the corpus. */
  readonly code: string;
  /** What the workspace needs before the run. Returns nothing; it writes files. */
  readonly setup?: (cwd: string) => void;
  /** The real argument vector, minus the program name. One argv, every range. */
  readonly argv: readonly string[];
  /** Real captures, one per declared range this witness has been re-run against. */
  readonly observations: readonly VersionedObservation[];
}

const SRC = (size: string, extra = ''): string =>
  `testsrc=size=${size}:rate=10:duration=1${extra}`;

/**
 * The version-scoped capture for one witness against the binary really
 * installed. Refuses, naming every range tried, when the installed binary
 * matches none: a supported-binary assumption this project never makes
 * silently (Fix 4, the gate and the watch both resolve through this).
 */
export function observationFor(witness: Witness, installedVersion: string): VersionedObservation {
  const found = witness.observations.find((observation) =>
    matchesRange(observation.versions, installedVersion),
  );
  if (found === undefined) {
    const ranges = witness.observations.map((observation) => observation.versions).join(', ');
    throw new UnsupportedVersionError(
      `${installedVersion} matches none of ${witness.code}'s declared observation ranges (${ranges}); ` +
        'this witness has never been re-run against this major',
    );
  }
  return found;
}

/**
 * The twelve inducing runs, in catalog order.
 *
 * Every witness carries two real observations, one per range
 * `corpora/ffmpeg/manifest.json` declares (`>=4.4 <5`, observed against
 * 4.4.2-0ubuntu0.22.04.1 libavcodec 58.134.100 libx264 enabled; `>=6 <8`,
 * observed against 6.1.1-3ubuntu5 libavcodec 60.31.102 libx264 enabled). The
 * `>=4.4 <5` text is the induction record `JUDGMENT-32-ffmpeg-corpus.md`
 * quotes line by line; the `>=6 <8` text is this fix's own re-induction.
 */
export const WITNESSES: readonly Witness[] = Object.freeze([
  {
    code: 'FFMPEG_INPUT_NOT_FOUND',
    argv: [...INDUCE_PREFIX, '-i', 'does-not-exist.mp4', 'out.mp4'],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: 'does-not-exist.mp4: No such file or directory' },
      // 6.1 restructured the message across three lines and dropped the
      // "path: reason" shape entirely; the fingerprint pattern
      // (`*: No such file or directory*`) still matches unmodified (the
      // substring survives inside "Error opening input files: ..."), so
      // only this witness capture, not the corpus, needed updating.
      { versions: '>=6 <8', status: 254, stderr: 'Error opening input file does-not-exist.mp4.' },
    ],
  },
  {
    code: 'FFMPEG_INVALID_INPUT_DATA',
    setup: (cwd): void => void makeTextFile(cwd, 'notes.txt'),
    argv: [...INDUCE_PREFIX, '-i', 'notes.txt', 'out.mp4'],
    observations: [
      {
        versions: '>=4.4 <5',
        status: 1,
        stderr: 'notes.txt: Invalid data found when processing input',
      },
      { versions: '>=6 <8', status: 183, stderr: 'Error opening input file notes.txt.' },
    ],
  },
  {
    code: 'FFMPEG_OUTPUT_EXISTS',
    setup: (cwd): void => void makeVideo(cwd, 'exists.mp4', '64x64'),
    argv: [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      SRC('64x64'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      'exists.mp4',
    ],
    observations: [
      {
        versions: '>=4.4 <5',
        status: 1,
        stderr: "File 'exists.mp4' already exists. Exiting.",
      },
      // A real ffmpeg 6.x regression, verified directly against the binary,
      // not assumed: the message is BYTE-IDENTICAL to 4.4's, but the exit
      // status is 0. comprehend(stderr) never reads exit status (matching
      // is text-only, packages/registry-tools/src/fingerprint-facets.ts),
      // so routing is unaffected; only a caller that used exit status as
      // its own "did this fail" signal would be misled, and this witness
      // now records the fact rather than the old assumption.
      {
        versions: '>=6 <8',
        status: 0,
        stderr: "File 'exists.mp4' already exists. Exiting.",
      },
    ],
  },
  {
    code: 'FFMPEG_NO_OUTPUT_FILE',
    setup: (cwd): void => void makeVideo(cwd, 'clip.mp4'),
    argv: [...INDUCE_PREFIX, '-i', 'clip.mp4'],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: 'At least one output file must be specified' },
      { versions: '>=6 <8', status: 1, stderr: 'At least one output file must be specified' },
    ],
  },
  {
    // The canonical 720p downscale: a source whose aspect makes the derived
    // width 721, which 4:2:0 chroma subsampling cannot represent.
    code: 'FFMPEG_ODD_DIMENSION',
    argv: [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=1442x1440:rate=5:duration=1',
      '-vf',
      'scale=-1:720',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-y',
      'out.mp4',
    ],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: 'width not divisible by 2 (721x720)' },
      { versions: '>=6 <8', status: 187, stderr: 'width not divisible by 2 (721x720)' },
    ],
  },
  {
    code: 'FFMPEG_MAP_MATCHES_NO_STREAM',
    setup: (cwd): void => void makeVideo(cwd, 'video-only.mp4'),
    argv: [
      ...INDUCE_PREFIX,
      '-i',
      'video-only.mp4',
      '-map',
      '0:v',
      '-map',
      '0:a',
      '-c',
      'copy',
      '-y',
      'out.mp4',
    ],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: "Stream map '0:a' matches no streams." },
      { versions: '>=6 <8', status: 234, stderr: "Stream map '0:a' matches no streams." },
    ],
  },
  {
    code: 'FFMPEG_UNKNOWN_ENCODER',
    argv: [...INDUCE_PREFIX, '-f', 'lavfi', '-i', SRC('64x64'), '-c:v', 'libx266', '-y', 'out.mp4'],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: "Unknown encoder 'libx266'" },
      { versions: '>=6 <8', status: 8, stderr: "Unknown encoder 'libx266'" },
    ],
  },
  {
    code: 'FFMPEG_FILTER_WITH_STREAMCOPY',
    setup: (cwd): void => void makeVideo(cwd, 'clip.mp4'),
    argv: [
      ...INDUCE_PREFIX,
      '-i',
      'clip.mp4',
      '-vf',
      'scale=160:120',
      '-c:v',
      'copy',
      '-y',
      'out.mp4',
    ],
    observations: [
      {
        versions: '>=4.4 <5',
        status: 1,
        stderr: 'Filtering and streamcopy cannot be used together.',
      },
      {
        versions: '>=6 <8',
        status: 218,
        stderr: 'Filtering and streamcopy cannot be used together.',
      },
    ],
  },
  {
    code: 'FFMPEG_UNKNOWN_FILTER',
    argv: [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      SRC('64x64'),
      '-vf',
      // A trailing bare `=1` (no `=key`) is valid enough for 4.4's option
      // parser to still report the unknown-filter error, but 6.1's stricter
      // parser stops at the malformed option list first and reports THAT
      // instead ("No option name near '1'"), never reaching the filter-name
      // check at all. Found by review, verified live on both binaries:
      // `notafilter=x=1` (a syntactically valid key=value pair) provokes the
      // identical "No such filter" text and needs no version split, so the
      // argv is corrected here rather than the corpus's fingerprint pattern
      // widened to catch a parse error that is not this twin's failure.
      'notafilter=x=1',
      '-y',
      'out.mp4',
    ],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: "No such filter: 'notafilter'" },
      { versions: '>=6 <8', status: 8, stderr: "No such filter: 'notafilter'" },
    ],
  },
  {
    code: 'FFMPEG_UNDEFINED_FILTER_LABEL',
    argv: [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      SRC('64x64'),
      '-filter_complex',
      '[0:v]scale=32:32[v]',
      '-map',
      '[vv]',
      '-y',
      'out.mp4',
    ],
    observations: [
      {
        versions: '>=4.4 <5',
        status: 1,
        stderr: "Output with label 'vv' does not exist in any defined filter graph",
      },
      {
        versions: '>=6 <8',
        status: 234,
        stderr: "Output with label 'vv' does not exist in any defined filter graph",
      },
    ],
  },
  {
    code: 'FFMPEG_INVALID_FRAMERATE',
    argv: [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      SRC('64x64'),
      '-r',
      'not-a-number',
      '-y',
      'out.mp4',
    ],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: 'Invalid framerate value: not-a-number' },
      { versions: '>=6 <8', status: 234, stderr: 'Invalid framerate value: not-a-number' },
    ],
  },
  {
    code: 'FFMPEG_UNRECOGNIZED_OPTION',
    setup: (cwd): void => void makeVideo(cwd, 'clip.mp4'),
    argv: [...INDUCE_PREFIX, '-i', 'clip.mp4', '-vcodex', 'libx264', '-y', 'out.mp4'],
    observations: [
      { versions: '>=4.4 <5', status: 1, stderr: "Unrecognized option 'vcodex'." },
      { versions: '>=6 <8', status: 8, stderr: "Unrecognized option 'vcodex'." },
    ],
  },
]);

/**
 * The second half of the fence claim, which one induction cannot make: three
 * DIFFERENT sources, two of which the `-1` form fails on and one of which it
 * already succeeds on. A fence is a class made unexpressible, so it owes
 * evidence over a class, not over the one case that provoked it.
 */
export const FENCE_SOURCES: readonly { readonly size: string; readonly derived: string }[] =
  Object.freeze([
    { size: '202x100', derived: '101x50' },
    { size: '302x100', derived: '151x50' },
    { size: '606x400', derived: '76x50' },
  ]);

/** The scale invocation both forms of the fence case share, minus the filter. */
export const scaleArgv = (size: string, filter: string): readonly string[] =>
  Object.freeze([
    ...INDUCE_PREFIX,
    '-f',
    'lavfi',
    '-i',
    `testsrc=size=${size}:rate=5:duration=1`,
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-y',
    'out.mp4',
  ]);

/** The stream-selection safety case: the same corrected map, audio present. */
export const withAudioFixture = (cwd: string): string => makeVideoWithAudio(cwd, 'av.mp4');
