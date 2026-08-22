// The fixture corpus every fingerprint test builds its index from.
//
// Shaped like the corpora this matcher will really see: two packages with
// overlapping generic failures (the ambiguity case), one entry that leans on a
// stack shape, and one `static-pattern` entry that must never be matched
// against a runtime error.

import type { FingerprintEntry } from '../../src/fingerprint.js';

export const UNKNOWN_ENCODER: FingerprintEntry = {
  package: '@comprehendo/ffmpeg',
  errorClass: 'FFmpegError',
  messagePattern: "Unknown encoder '*'",
  corpusEntryId: 'UNKNOWN_ENCODER',
};

export const INVALID_ARGUMENT: FingerprintEntry = {
  package: '@comprehendo/ffmpeg',
  errorClass: 'FFmpegError',
  messagePattern: 'Invalid argument: *',
  stackShape: ['ffmpeg/lib/run.js', 'ffmpeg/lib/spawn.js'],
  corpusEntryId: 'INVALID_ARGUMENT',
};

/** Specific ENOENT wording: matches the same raw error the next entry does. */
export const FFMPEG_INPUT_MISSING: FingerprintEntry = {
  package: '@comprehendo/ffmpeg',
  errorClass: 'Error',
  messagePattern: "ENOENT: no such file or directory, open '*'",
  corpusEntryId: 'INPUT_MISSING',
};

/** Generic ENOENT wording from another package's corpus: the ambiguity. */
export const SHARP_INPUT_MISSING: FingerprintEntry = {
  package: '@comprehendo/sharp',
  errorClass: 'Error',
  messagePattern: 'ENOENT: *',
  corpusEntryId: 'INPUT_MISSING',
};

export const NO_DECODE_DELEGATE: FingerprintEntry = {
  package: '@comprehendo/imagemagick',
  errorClass: 'MagickError',
  messagePattern: "no decode delegate for this image format '*'",
  corpusEntryId: 'NO_DECODE_DELEGATE',
};

/** Indexed, never run against a caught error: kind is an open question [21]. */
export const ZOD_PARSE_UNGUARDED: FingerprintEntry = {
  package: '@comprehendo/zod',
  errorClass: 'ZodError',
  messagePattern: '*invalid_type*',
  corpusEntryId: 'PARSE_UNGUARDED',
  kind: 'static-pattern',
};

/** The whole fixture corpus, in a deliberately unsorted declaration order. */
export const CORPUS: readonly FingerprintEntry[] = [
  NO_DECODE_DELEGATE,
  UNKNOWN_ENCODER,
  SHARP_INPUT_MISSING,
  ZOD_PARSE_UNGUARDED,
  INVALID_ARGUMENT,
  FFMPEG_INPUT_MISSING,
];

/** The entries whose message is a single literal plus a trailing wildcard. */
export interface CorpusSample {
  readonly entry: FingerprintEntry;
  /** A real message that matches `entry.messagePattern` exactly. */
  readonly message: string;
  readonly frames: readonly string[];
}

export const SAMPLES: readonly CorpusSample[] = [
  { entry: UNKNOWN_ENCODER, message: "Unknown encoder 'libx265'", frames: [] },
  {
    entry: INVALID_ARGUMENT,
    message: 'Invalid argument: -crf must be between 0 and 51',
    frames: ['run (/app/node_modules/ffmpeg/lib/run.js:41:11)', 'spawn (/app/node_modules/ffmpeg/lib/spawn.js:12:3)'],
  },
  {
    entry: NO_DECODE_DELEGATE,
    message: "no decode delegate for this image format 'HEIC'",
    frames: [],
  },
];

/** A caught error the way a provider really throws one. */
export function caught(name: string, message: string, frames: readonly string[] = []): Error {
  const error = new Error(message);
  error.name = name;
  error.stack = [`${name}: ${message}`, ...frames.map((frame) => `    at ${frame}`)].join('\n');
  return error;
}

/** The error a sample describes, ready to hand to `match`. */
export const errorFor = (sample: CorpusSample, message = sample.message): Error =>
  caught(sample.entry.errorClass ?? 'Error', message, sample.frames);
