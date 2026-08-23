// ffmpeg Fingerprints [33]: the REAL stderr every cataloged failure really
// writes, captured once, and the line of it the fingerprint is a fingerprint ON.
//
// The property suite mutates cryptic CLI text, so the text it mutates has to be
// the text the binary really produced, never a remembered transcription. Each
// entry here is one real run of the real binary through ffmpeg Corpus [32]'s
// own witness table, so a wording change in a future ffmpeg build moves this
// input the same day it moves the corpus.
//
// WHY THE LINE MATTERS. A real ffmpeg failure is a BLOB: banners, input
// descriptions, stream mappings, then the one line that says what went wrong,
// then its echo. A near-miss is not "some character somewhere in that blob
// changed", it is "the line the corpus fingerprinted came out slightly
// different", so the mutation target is that line and the raw handed to the
// matcher is the whole blob with that line replaced, exactly what an agent
// holding a failed invocation would have.

import { run, workspace } from './ffmpeg-cli.js';
import { WITNESSES } from './ffmpeg-witnesses.js';

/** One cataloged failure, as the real binary really reported it. */
export interface CatalogedStderr {
  /** The twin code this run is cataloged under. */
  readonly code: string;
  /** Everything the real run really wrote to stderr. */
  readonly stderr: string;
  /** The one line of it carrying the cataloged text. */
  readonly line: string;
}

/**
 * The single line carrying `fragment`.
 *
 * Two lines carrying it would make `withLine` replace one and leave the other,
 * so a mutation would silently leave the pattern satisfied and the property
 * would pass while testing nothing. That is a loud throw, never a shrug.
 */
export function catalogedLine(stderr: string, fragment: string): string {
  const carrying = stderr.split('\n').filter((line) => line.includes(fragment));
  const only = carrying[0];
  if (carrying.length !== 1 || only === undefined) {
    throw new Error(
      `the real stderr carries ${String(carrying.length)} lines containing ${JSON.stringify(fragment)}; the mutation target must be exactly one line`,
    );
  }
  return only;
}

/** Every cataloged failure, induced once out of the real binary. */
export function catalogedStderr(): readonly CatalogedStderr[] {
  return Object.freeze(
    WITNESSES.map((witness) => {
      const site = workspace();
      try {
        witness.setup?.(site.path);
        const failed = run(witness.argv, site.path);
        if (failed.status === 0) {
          throw new Error(`the witness for ${witness.code} did not fail at all`);
        }
        return Object.freeze({
          code: witness.code,
          stderr: failed.stderr,
          line: catalogedLine(failed.stderr, witness.stderr),
        });
      } finally {
        site.cleanup();
      }
    }),
  );
}

/**
 * The same real blob with its cataloged line replaced: a near-miss in situ.
 *
 * The replacement is a function so a `$` in mutated CLI text stays a `$` and
 * never becomes a `String.replace` substitution pattern.
 */
export const withLine = (seen: CatalogedStderr, line: string): string =>
  seen.stderr.replace(seen.line, () => line);
