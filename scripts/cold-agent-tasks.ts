// Cold-Agent Benchmark [38]: the scripted task suite itself.
//
// Fourteen tasks, and not one of them was invented for this file. Twelve are
// the twelve failures ffmpeg Corpus [32] really catalogs, phrased as the task
// a caller was actually trying to do when they hit it, and each one is induced
// by the same real argument vector 32's own witness table induces it with
// (`packages/registry-tools/test/helpers/ffmpeg-witnesses.ts`), against the
// same real binary. The suite asserts that correspondence entry by entry, so a
// task that drifts from the catalog goes red rather than quietly measuring
// something else.
//
// The other two exist because the twelve cannot exercise them:
//
//   - the clean path, which measures NON-guessing. An agent that reaches for
//     `comprehend` on an invocation that worked has not understood the
//     snippet, and a suite made only of failures would never notice.
//   - the honest-miss path, which is the only branch in the whole run that
//     reads a source file at all, and the only way to prove the UNDOCUMENTED
//     grant is real rather than hypothetical (CC10 [20]).
//
// Every source is synthetic (`-f lavfi -i testsrc=...`), so the suite needs no
// external media and reproduces on any machine carrying the binary.
//
// @see .mdd/docs/38-cold-agent-benchmark.md
// @see .mdd/docs/32-ffmpeg-corpus.md

import type { Task } from './cold-agent-suite.ts';

/** The banner is suppressed and the prompt refused: a scripted invocation. */
export const INDUCE_PREFIX: readonly string[] = Object.freeze(['-hide_banner', '-nostdin']);

const SRC = (size: string): string => `testsrc=size=${size}:rate=10:duration=1`;

/** The un-adopted package the honest-miss task asks about. No corpus exists for it. */
export const UNADOPTED_PACKAGE = 'toy-widgets';

/** The one file the single granted source pass is allowed to open. */
export const UNADOPTED_SOURCE = 'index.js';

export const TASKS: readonly Task[] = Object.freeze([
  {
    id: 'transcode-a-file-that-is-not-there',
    goal: 'Transcode the clip at does-not-exist.mp4 into out.mp4.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_INPUT_NOT_FOUND',
    argv: [...INDUCE_PREFIX, '-i', 'does-not-exist.mp4', 'out.mp4'],
    stderrWitness: 'does-not-exist.mp4: No such file or directory',
  },
  {
    id: 'transcode-something-that-is-not-media',
    goal: 'Transcode notes.txt into out.mp4.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_INVALID_INPUT_DATA',
    argv: [...INDUCE_PREFIX, '-i', 'notes.txt', 'out.mp4'],
    fixture: { make: 'text', name: 'notes.txt' },
    stderrWitness: 'notes.txt: Invalid data found when processing input',
  },
  {
    id: 'the-output-already-exists',
    goal: 'Encode a one-second test pattern to exists.mp4.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_OUTPUT_EXISTS',
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
    fixture: { make: 'video', name: 'exists.mp4', size: '64x64' },
    stderrWitness: "File 'exists.mp4' already exists. Exiting.",
  },
  {
    id: 'inspect-a-clip-and-forget-the-output',
    goal: 'Run clip.mp4 through ffmpeg.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_NO_OUTPUT_FILE',
    argv: [...INDUCE_PREFIX, '-i', 'clip.mp4'],
    fixture: { make: 'video', name: 'clip.mp4' },
    stderrWitness: 'At least one output file must be specified',
  },
  {
    // The headline task from Wave 6's demo-state, run for real: crop and
    // transcode a video, and hit the odd-dimension fence on the way.
    id: 'crop-and-transcode-a-video-to-720p',
    goal: 'Downscale the 1442x1440 source to 720p high and transcode it to H.264 in out.mp4.',
    kind: 'executable-fix',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_ODD_DIMENSION',
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
    stderrWitness: 'width not divisible by 2 (721x720)',
  },
  {
    id: 'remux-video-and-audio-from-a-silent-source',
    goal: 'Remux the video and audio tracks of video-only.mp4 into out.mp4 without re-encoding.',
    kind: 'executable-fix',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_MAP_MATCHES_NO_STREAM',
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
    fixture: { make: 'video', name: 'video-only.mp4' },
    stderrWitness: "Stream map '0:a' matches no streams.",
  },
  {
    id: 'an-unsupported-codec-was-requested',
    goal: 'Encode a one-second test pattern to out.mp4 with the libx266 encoder.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_UNKNOWN_ENCODER',
    argv: [...INDUCE_PREFIX, '-f', 'lavfi', '-i', SRC('64x64'), '-c:v', 'libx266', '-y', 'out.mp4'],
    stderrWitness: "Unknown encoder 'libx266'",
  },
  {
    id: 'resize-while-copying-the-video-stream',
    goal: 'Resize clip.mp4 to 160x120 into out.mp4, copying the video stream.',
    kind: 'executable-fix',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_FILTER_WITH_STREAMCOPY',
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
    fixture: { make: 'video', name: 'clip.mp4' },
    stderrWitness: 'Filtering and streamcopy cannot be used together.',
  },
  {
    id: 'apply-a-filter-this-build-does-not-have',
    goal: 'Run a one-second test pattern through the notafilter filter into out.mp4.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_UNKNOWN_FILTER',
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
    stderrWitness: "No such filter: 'notafilter'",
  },
  {
    id: 'map-a-filtergraph-output-that-was-never-labelled',
    goal: 'Scale a test pattern through a filtergraph and map its output into out.mp4.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_UNDEFINED_FILTER_LABEL',
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
    stderrWitness: "Output with label 'vv' does not exist in any defined filter graph",
  },
  {
    id: 'set-a-frame-rate-from-a-variable-that-was-not-a-number',
    goal: 'Encode a test pattern to out.mp4 at a frame rate of not-a-number.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_INVALID_FRAMERATE',
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
    stderrWitness: 'Invalid framerate value: not-a-number',
  },
  {
    id: 'mistype-the-video-codec-flag',
    goal: 'Transcode clip.mp4 to out.mp4 with the H.264 encoder, using -vcodex.',
    kind: 'inert-pointer',
    pkg: 'ffmpeg',
    expect: 'FFMPEG_UNRECOGNIZED_OPTION',
    argv: [...INDUCE_PREFIX, '-i', 'clip.mp4', '-vcodex', 'libx264', '-y', 'out.mp4'],
    fixture: { make: 'video', name: 'clip.mp4' },
    stderrWitness: "Unrecognized option 'vcodex'.",
  },
  {
    // Nothing is wrong here, and that is the point: a working invocation must
    // cost the protocol nothing at all.
    id: 'transcode-a-clip-that-simply-works',
    goal: 'Encode a one-second 320x240 test pattern to H.264 in clean.mp4.',
    kind: 'clean',
    pkg: 'ffmpeg',
    expect: 'OK',
    argv: [
      ...INDUCE_PREFIX,
      '-f',
      'lavfi',
      '-i',
      SRC('320x240'),
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-y',
      'clean.mp4',
    ],
  },
  {
    // The one grant. `toy-widgets` is really installed in the consumer root
    // and really has no corpus, so `docs` really answers UNDOCUMENTED and the
    // permitted single source pass really opens a real file.
    id: 'question-a-package-nobody-has-documented',
    goal: `Register a widget with the ${UNADOPTED_PACKAGE} package.`,
    kind: 'honest-miss',
    pkg: UNADOPTED_PACKAGE,
    expect: 'UNDOCUMENTED',
    argv: [],
    question: 'how do I register a widget',
  },
]);
