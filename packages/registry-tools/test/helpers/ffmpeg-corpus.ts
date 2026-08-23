// ffmpeg Corpus [32]: loading the real corpus, and inducing every claim it
// makes out of the real binary.
//
// `induceAll` is the CLI-shaped counterpart of `verifyAgainstUpstream`, and it
// is deliberately NOT a reimplementation of it: it produces the same
// `UpstreamVerification` value, from the same kind of evidence (what a run
// really observed), so Submission Gate [29]'s REAL `folkloreFindings` and
// `registryTruthFindings` judge this corpus through exactly the code that
// judges a JavaScript corpus, with no tier parameter and no special case.
//
// It exists because `verifyAgainstUpstream` cannot reach an ffmpeg: it
// resolves `installRoot/node_modules/<directory>` and imports the module it
// finds there, so its subject is a package with exported functions. ffmpeg is
// a program. That is a real boundary in the gate, recorded in the feature
// doc's Known Issues rather than papered over by inventing a node_modules
// entry for a binary that is not an npm package.

import { join } from 'node:path';

import { parse } from '../../src/corpus-format.js';
import type { CorpusSource } from '../../src/corpus-format.js';
import { fingerprintsOf } from '../../src/gate-fingerprint.js';
import { buildFingerprintIndex } from '../../src/fingerprint.js';
import type { FingerprintIndex } from '../../src/fingerprint.js';
import { fixKey } from '../../src/gate-upstream.js';
import type { TruthFailure, UpstreamVerification } from '../../src/gate-upstream.js';
import { applyToArgv, ffmpegVersion, run, workspace } from './ffmpeg-cli.js';
import type { FfmpegRun } from './ffmpeg-cli.js';
import { WITNESSES } from './ffmpeg-witnesses.js';

/** The corpus directory this feature owns, from the repository root. */
export const FFMPEG_CORPUS_DIR = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'corpora',
  'ffmpeg',
);

/** The registry directory name, which must exact-match the target package. */
export const FFMPEG_DIRECTORY = 'ffmpeg';

/** The corpus, read by Corpus Format [28]'s REAL parser. Never a typed double. */
export const loadFfmpegCorpus = (): CorpusSource => parse(FFMPEG_CORPUS_DIR);

/** The corpus's own compiled index, through 21's REAL builder. */
export const indexOf = (corpus: CorpusSource): FingerprintIndex =>
  buildFingerprintIndex(fingerprintsOf(corpus));

/** One induction, run and routed. */
export interface Induced {
  readonly code: string;
  readonly status: number;
  readonly stderr: string;
  readonly outcome: string;
  /** The entry the corpus's own index resolved the real stderr to. */
  readonly matched: string;
}

/**
 * Induce one cataloged failure out of the real binary and route its stderr
 * through the corpus's own index.
 *
 * The raw handed to the matcher is the stderr TEXT, which is what an agent
 * holding a failed ffmpeg invocation actually has. `observe` reads a bare
 * string as the message with no error class, so a CLI fingerprint declares a
 * message pattern and nothing else; declaring an `errorClass` here would
 * reject every real match (see fingerprint-facets.ts, `judge`).
 */
export function induceOne(code: string, index: FingerprintIndex): Induced {
  const witness = WITNESSES.find((entry) => entry.code === code);
  if (witness === undefined) {
    throw new Error(`no witness for ${code}: the folklore rule catalogs nothing nobody provoked`);
  }
  const site = workspace();
  try {
    witness.setup?.(site.path);
    const result = run(witness.argv, site.path);
    const match = index.match(result.stderr);
    return {
      code,
      status: result.status,
      stderr: result.stderr,
      outcome: match.outcome,
      matched: match.outcome === 'matched' ? match.entry.corpusEntryId : '',
    };
  } finally {
    site.cleanup();
  }
}

/**
 * Every claim this corpus makes, checked against the real binary, as the
 * `UpstreamVerification` the gate reads.
 *
 * A twin whose induction did not reproduce, or whose failure routed elsewhere,
 * comes back as a named failure rather than as a silent omission, exactly as
 * `verifyAgainstUpstream` does. A fix carrying an `apply` counts as verified
 * only when applying it to the SAME failing argv and rerunning really exits 0.
 */
export function induceAll(corpus: CorpusSource): UpstreamVerification {
  const index = indexOf(corpus);
  const inducedCodes: string[] = [];
  const verifiedFixes: string[] = [];
  const failures: TruthFailure[] = [];

  for (const twin of corpus.twins) {
    const witness = WITNESSES.find((entry) => entry.code === twin.code);
    if (witness === undefined) {
      failures.push({
        kind: 'unrunnable-witness',
        at: twin.code,
        detail: `no inducing invocation is supplied for ${twin.code}`,
      });
      continue;
    }
    const site = workspace();
    try {
      witness.setup?.(site.path);
      const failed = run(witness.argv, site.path);
      const routed = routeInduction(twin.code, failed, index);
      if (routed !== undefined) {
        failures.push(routed);
        continue;
      }
      inducedCodes.push(twin.code);
      proveFixes(corpus, twin.id, twin.code, witness.argv, site.path, verifiedFixes, failures);
    } finally {
      site.cleanup();
    }
  }

  return Object.freeze({
    directory: FFMPEG_DIRECTORY,
    package: corpus.package,
    resolved: Object.freeze({ name: FFMPEG_DIRECTORY, version: ffmpegVersion() }),
    inducedCodes: Object.freeze(inducedCodes),
    verifiedFixes: Object.freeze(verifiedFixes),
    failures: Object.freeze(failures),
  });
}

/** Why this run did not settle the entry, or `undefined` when it did. */
function routeInduction(
  code: string,
  failed: FfmpegRun,
  index: FingerprintIndex,
): TruthFailure | undefined {
  if (failed.status === 0) {
    return {
      kind: 'not-inducible',
      at: code,
      detail: `the real binary did not fail at all when the witness for ${code} ran`,
    };
  }
  const match = index.match(failed.stderr);
  if (match.outcome !== 'matched') {
    return {
      kind: match.outcome === 'ambiguous' ? 'misrouted' : 'not-inducible',
      at: code,
      detail: `the stderr this witness really produced routed as ${match.outcome}`,
    };
  }
  if (match.entry.corpusEntryId !== code) {
    return {
      kind: 'misrouted',
      at: code,
      detail: `the failure this witness really provoked matches ${match.entry.corpusEntryId}`,
    };
  }
  return undefined;
}

/** Each executable fix, applied to the same failing argv and really rerun. */
function proveFixes(
  corpus: CorpusSource,
  id: string,
  code: string,
  argv: readonly string[],
  cwd: string,
  verified: string[],
  failures: TruthFailure[],
): void {
  const declared = corpus.declaredSchema?.operations ?? [];
  for (const fix of corpus.fixes[id] ?? []) {
    if (fix.apply === undefined) continue;
    const retried = run(applyToArgv(argv, fix.apply, declared), cwd);
    if (retried.status === 0) {
      verified.push(fixKey(code, fix.title));
      continue;
    }
    failures.push({
      kind: 'fix-did-not-resolve',
      at: fixKey(code, fix.title),
      detail: `applying "${fix.title}" and retrying still failed:\n${retried.stderr}`,
    });
  }
}
