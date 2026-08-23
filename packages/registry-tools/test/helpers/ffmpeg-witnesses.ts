// ffmpeg Corpus [32]: the inducing invocation for every cataloged entry.
//
// THE FORMAT GAP THIS FILE IS. `gate-upstream.ts` already records it: nothing
// in the authoring corpus format carries "here is the call that provokes this
// failure". A fix's `apply` is the call that AVOIDS the failure, and the
// inverse is not derivable from it, so the inducing calls arrive beside the
// corpus as witnesses that the gate RUNS. This table is that, for a corpus
// whose target is a command-line program rather than a module.
//
// Every argv below was run against the real ffmpeg before it was written down,
// and the message each one is cataloged under is the text that run really
// wrote to stderr. Nothing here is remembered, and nothing is paraphrased:
// ffmpeg's wording varies by version and build flags, so an entry nobody
// watched reproduce is folklore by construction (CC4 [26]).
//
// Every source is synthetic (`-f lavfi -i testsrc=...`), so an induction needs
// no external media, is deterministic, and is reproducible on any machine
// carrying the binary.

import { INDUCE_PREFIX, makeTextFile, makeVideo, makeVideoWithAudio } from './ffmpeg-cli.js';

/** How one cataloged failure is really provoked out of the real binary. */
export interface Witness {
  /** The twin `code` this run must produce, per the corpus. */
  readonly code: string;
  /** What the workspace needs before the run. Returns nothing; it writes files. */
  readonly setup?: (cwd: string) => void;
  /** The real argument vector, minus the program name. */
  readonly argv: readonly string[];
  /**
   * A literal fragment of the stderr the induction really produced, quoted
   * from a real run. Asserted verbatim ALONGSIDE the fingerprint match, so a
   * corpus pattern loosened until it matches anything still goes red here.
   */
  readonly stderr: string;
}

const SRC = (size: string, extra = ''): string =>
  `testsrc=size=${size}:rate=10:duration=1${extra}`;

/**
 * The twelve inducing runs, in catalog order.
 *
 * Observed against ffmpeg version 4.4.2-0ubuntu0.22.04.1 (libavcodec
 * 58.134.100, libx264 enabled), which is the version the induction record in
 * JUDGMENT-32-ffmpeg-corpus.md quotes line by line.
 */
export const WITNESSES: readonly Witness[] = Object.freeze([
  {
    code: 'FFMPEG_INPUT_NOT_FOUND',
    argv: [...INDUCE_PREFIX, '-i', 'does-not-exist.mp4', 'out.mp4'],
    stderr: 'does-not-exist.mp4: No such file or directory',
  },
  {
    code: 'FFMPEG_INVALID_INPUT_DATA',
    setup: (cwd): void => void makeTextFile(cwd, 'notes.txt'),
    argv: [...INDUCE_PREFIX, '-i', 'notes.txt', 'out.mp4'],
    stderr: 'notes.txt: Invalid data found when processing input',
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
    stderr: "File 'exists.mp4' already exists. Exiting.",
  },
  {
    code: 'FFMPEG_NO_OUTPUT_FILE',
    setup: (cwd): void => void makeVideo(cwd, 'clip.mp4'),
    argv: [...INDUCE_PREFIX, '-i', 'clip.mp4'],
    stderr: 'At least one output file must be specified',
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
    stderr: 'width not divisible by 2 (721x720)',
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
    stderr: "Stream map '0:a' matches no streams.",
  },
  {
    code: 'FFMPEG_UNKNOWN_ENCODER',
    argv: [...INDUCE_PREFIX, '-f', 'lavfi', '-i', SRC('64x64'), '-c:v', 'libx266', '-y', 'out.mp4'],
    stderr: "Unknown encoder 'libx266'",
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
    stderr: 'Filtering and streamcopy cannot be used together.',
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
      'notafilter=1',
      '-y',
      'out.mp4',
    ],
    stderr: "No such filter: 'notafilter'",
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
    stderr: "Output with label 'vv' does not exist in any defined filter graph",
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
    stderr: 'Invalid framerate value: not-a-number',
  },
  {
    code: 'FFMPEG_UNRECOGNIZED_OPTION',
    setup: (cwd): void => void makeVideo(cwd, 'clip.mp4'),
    argv: [...INDUCE_PREFIX, '-i', 'clip.mp4', '-vcodex', 'libx264', '-y', 'out.mp4'],
    stderr: "Unrecognized option 'vcodex'.",
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
