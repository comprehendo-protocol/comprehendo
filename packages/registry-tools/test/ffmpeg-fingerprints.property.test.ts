// ffmpeg Fingerprints [33] against CC10 Honest Miss [20]: the hostile domain.
//
// Wave 4 proved the matcher degrades honestly against a JavaScript-shaped
// corpus, where an error carries a class name, a stack, and a message with the
// payload at the end (cc10-honest-miss.property.test.ts). ffmpeg is the
// opposite: no class, no stack, no structure at all, just cryptic stderr text
// with operands baked through the middle of the sentence, and twelve entries
// whose fingerprints are therefore message patterns and nothing else. That is
// the domain this suite exists to stress, because it is the one where a matcher
// tempted to "get close" would hand an agent another failure's flag fix.
//
// EVERYTHING HERE IS REAL. The corpus is `corpora/ffmpeg/` read by Corpus
// Format [28]'s real `parse`; the fingerprints are the ones Submission Gate
// [29]'s real `fingerprintsOf` compiles; the index is Fingerprint Index &
// Matcher [21]'s real builder; and the text being mutated is the stderr the
// really-installed binary really wrote this run, one real invocation per
// cataloged entry. No transcription, no fixture, no double.
//
// The claim, in three parts:
//   1. an operand the pattern deliberately does not pin (a codec name, a path,
//      a dimension, a stream index, a heap address) may move, and the entry
//      must still recognise its own failure;
//   2. a mutation that damages the words the pattern DOES pin must degrade to
//      UNSTRUCTURED, and must never resolve to a different entry;
//   3. text welding two cataloged failures together resolves only to what the
//      text really justifies, and to UNSTRUCTURED when that is not exactly one
//      entry.
//
// AC1 (`comprehend(stderr)` against real cataloged output returns the correct
// twin) is NOT re-tested here: ffmpeg-induction.test.ts already runs all twelve
// real inductions through this same real index and requires each to route to
// itself, and ffmpeg-corpus.test.ts carries that stderr on through core's real
// twin builder. This suite is the near-miss half of the same question.

import { beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import {
  UNSTRUCTURED_REASON,
  matchesPattern,
  matchesStackShape,
  observe,
  type FingerprintEntry,
  type FingerprintIndex,
  type MatchResult,
} from '../src/fingerprint.js';
import { fingerprintsOf } from '../src/gate-fingerprint.js';
import { INDUCE_PREFIX, makeVideo, requireFfmpeg, run, workspace } from './helpers/ffmpeg-cli.js';
import { indexOf, loadFfmpegCorpus } from './helpers/ffmpeg-corpus.js';
import {
  CLI_MUTATION_KINDS,
  LOCAL_KINDS,
  OPERAND_KINDS,
  cliMutate,
  cliMutations,
  type CliMutationKind,
} from './helpers/ffmpeg-mutate.js';
import { catalogedStderr, withLine, type CatalogedStderr } from './helpers/ffmpeg-stderr.js';

/** Mutations drawn per cataloged entry. Seeds 1..N, so a failure reproduces. */
const SEEDS = 240;

let corpus: CorpusSource;
let entries: readonly FingerprintEntry[];
let index: FingerprintIndex;
let captured: readonly CatalogedStderr[];

beforeAll(() => {
  requireFfmpeg();
  corpus = loadFfmpegCorpus();
  entries = fingerprintsOf(corpus);
  index = indexOf(corpus);
  captured = catalogedStderr();
}, 300_000);

/**
 * The oracle: which cataloged entries does this raw text actually justify?
 *
 * A deliberately naive re-derivation of the doc's own rule (every declared
 * facet must match), written straight from Fingerprint Index & Matcher [21]'s
 * Business Rules rather than from its match loop, so a confident answer is
 * checked against something other than the matcher's own bookkeeping.
 */
function justifiedBy(raw: string): readonly string[] {
  const seen = observe(raw);
  return entries
    .filter((entry) => {
      if ((entry.kind ?? 'runtime-error') !== 'runtime-error') return false;
      if (entry.errorClass !== undefined && seen.errorClass !== entry.errorClass) return false;
      if (entry.messagePattern !== undefined) {
        if (seen.message === undefined) return false;
        if (!matchesPattern(entry.messagePattern, seen.message)) return false;
      }
      if (entry.stackShape !== undefined && !matchesStackShape(entry.stackShape, seen.stack)) {
        return false;
      }
      return true;
    })
    .map((entry) => entry.corpusEntryId);
}

interface Trial {
  /** The entry whose real stderr this mutation started from. */
  readonly code: string;
  readonly seed: number;
  readonly kind: CliMutationKind;
  /** The whole real stderr blob, with its cataloged line mutated. */
  readonly raw: string;
  readonly result: MatchResult;
}

/** Every mutation of every cataloged line, in situ in its own real blob. */
function* trials(kinds: readonly CliMutationKind[], count = SEEDS): Generator<Trial> {
  for (const seen of captured) {
    const foreign = captured.filter((other) => other.code !== seen.code).map((other) => other.line);
    for (const mutation of cliMutations(seen.line, foreign, count)) {
      if (!kinds.includes(mutation.kind)) continue;
      const raw = withLine(seen, mutation.text);
      yield {
        code: seen.code,
        seed: mutation.seed,
        kind: mutation.kind,
        raw,
        result: index.match(raw),
      };
    }
  }
}

/** How a failing case names itself, so the seed alone reproduces it. */
const where = (trial: Trial): string =>
  `${trial.code} seed ${String(trial.seed)} (${trial.kind}) on ${JSON.stringify(trial.raw.slice(-200))}`;

describe('an operand a pattern deliberately does not pin may move', () => {
  it('still routes a moved codec name, path, dimension or address to its own entry', () => {
    let matched = 0;
    let degraded = 0;
    for (const trial of trials(OPERAND_KINDS)) {
      if (trial.result.outcome !== 'matched') {
        degraded += 1;
        continue;
      }
      matched += 1;
      expect(trial.result.entry.corpusEntryId, `${where(trial)} resolved to another entry`).toBe(
        trial.code,
      );
    }

    // Both counts matter, and they are lopsided on purpose. 478 of the 480
    // operand mutations stay matched, which is the point: these patterns are
    // not over-fitted to the codec name, path or dimension that provoked them.
    // The other 2 are the generator hitting the one numeral the catalog really
    // does pin (the `2` in `width not divisible by 2`), and they are what keeps
    // this from being a tautology over mutations that changed nothing that
    // mattered.
    expect(matched, 'no operand mutation stayed inside its pattern').toBeGreaterThan(400);
    expect(degraded, 'no operand mutation reached a pinned numeral').toBeGreaterThan(0);
  });
});

describe('damaging the words a pattern does pin degrades, never redirects', () => {
  it('never resolves a mutated cataloged failure to a different entry', () => {
    let seen = 0;
    let degraded = 0;
    for (const trial of trials(LOCAL_KINDS)) {
      seen += 1;
      if (trial.result.outcome !== 'matched') {
        degraded += 1;
        continue;
      }
      expect(trial.result.entry.corpusEntryId, `${where(trial)} resolved to another entry`).toBe(
        trial.code,
      );
    }

    expect(seen, 'no local mutations were generated, the property would be vacuous').toBeGreaterThan(
      1200,
    );
    // A PROPORTION of `seen`, not a magic count: the absolute number of local
    // mutations that land on pinned text depends on how many words the real
    // cataloged line carries, and that count really differs by version
    // (ffmpeg 6.1's real lines are shorter and more direct than 4.4's, verified
    // live: 4.4 degrades ~60% of trials, 6.1 degrades ~39%, both a robust
    // majority and neither remotely vacuous). A fixed count calibrated to one
    // binary's text shape would either be loose on the other or, worse, would
    // have silently started failing here instead of where the real drift is:
    // in the witness capture, which IS version-scoped (ffmpeg-witnesses.ts).
    expect(degraded, 'no local mutation broke its pattern, the property would be vacuous').toBeGreaterThan(
      seen * 0.3,
    );
  });

  it('answers every degraded case with the UNSTRUCTURED twin, verbatim and fixless', () => {
    let seen = 0;
    let checked = 0;
    for (const trial of trials(LOCAL_KINDS)) {
      seen += 1;
      if (trial.result.outcome === 'matched') continue;
      checked += 1;
      expect(trial.result.twin.code, where(trial)).toBe('UNSTRUCTURED');
      expect(trial.result.twin.reason).toBe(UNSTRUCTURED_REASON);
      expect(trial.result.twin.fixes).toEqual([]);
      expect(trial.result.twin.received).toBe(trial.raw);
    }

    // Same proportional reasoning as the test above, over the same trials.
    expect(checked, 'nothing degraded, so no UNSTRUCTURED twin was inspected').toBeGreaterThan(
      seen * 0.3,
    );
  });

  it('agrees with the oracle on every single trial, confident or not', () => {
    let confident = 0;
    for (const trial of trials(LOCAL_KINDS)) {
      const justified = justifiedBy(trial.raw);
      if (trial.result.outcome === 'matched') {
        confident += 1;
        expect(justified, where(trial)).toEqual([trial.result.entry.corpusEntryId]);
      } else {
        expect(justified.length, `${where(trial)} left exactly one justified entry unreturned`).not.toBe(
          1,
        );
      }
    }

    expect(confident, 'nothing stayed inside its pattern, the oracle agreed vacuously').toBeGreaterThan(
      500,
    );
  });
});

describe('text welding two cataloged failures together', () => {
  it('answers only what the welded text really justifies, and UNSTRUCTURED otherwise', () => {
    let none = 0;
    let one = 0;
    let many = 0;
    let elsewhere = 0;
    for (const trial of trials(['splice'])) {
      const justified = justifiedBy(trial.raw);
      if (justified.length === 0) none += 1;
      else if (justified.length === 1) one += 1;
      else many += 1;

      if (trial.result.outcome === 'matched') {
        expect(justified, where(trial)).toEqual([trial.result.entry.corpusEntryId]);
        if (trial.result.entry.corpusEntryId !== trial.code) elsewhere += 1;
        continue;
      }
      expect(justified.length, `${where(trial)} left exactly one justified entry unreturned`).not.toBe(
        1,
      );
      expect(trial.result.twin.code).toBe('UNSTRUCTURED');
      expect(trial.result.twin.fixes).toEqual([]);
    }

    // The generator has to reach all three shapes or the property is a
    // tautology over whichever one it happened to produce.
    expect(none, 'no splice destroyed its pattern').toBeGreaterThan(100);
    expect(one, 'no splice left exactly one cataloged failure standing').toBeGreaterThan(50);
    expect(many, 'no splice carried two cataloged failures at once').toBeGreaterThan(20);
    expect(
      elsewhere,
      'no splice ever carried another entry text, so the redirect hazard was never exercised',
    ).toBeGreaterThan(20);
  });
});

describe('a real stderr carrying two cataloged failures at once', () => {
  it('names both and answers UNSTRUCTURED, rather than picking one fix', () => {
    let pairs = 0;
    for (const first of captured) {
      for (const second of captured) {
        if (first.code >= second.code) continue;
        pairs += 1;
        const raw = `${first.stderr}${second.stderr}`;
        const result = index.match(raw);

        expect(result.outcome, `${first.code} + ${second.code}`).toBe('ambiguous');
        if (result.outcome === 'matched') continue;
        expect(result.twin.code).toBe('UNSTRUCTURED');
        expect(result.twin.fixes).toEqual([]);
        expect(result.twin.accepts).toContain(`ffmpeg#${first.code}`);
        expect(result.twin.accepts).toContain(`ffmpeg#${second.code}`);
        expect(result.twin.accepts).toEqual(result.candidates.map((candidate) => candidate.name));
      }
    }

    expect(pairs).toBe((captured.length * (captured.length - 1)) / 2);
  });
});

describe('a real ffmpeg failure this corpus deliberately does not catalog', () => {
  it('degrades to UNSTRUCTURED with the real text preserved, never to a near twin', () => {
    // Copying h264 into an ogg container: a real, reproducible failure ffmpeg
    // Corpus [32] investigated and deliberately left out (its stderr names no
    // codec and no container, so a fingerprint on it would match a large family
    // of unrelated header failures). Uncataloged is exactly the state CC10
    // governs, so it is induced here rather than imagined.
    const site = workspace();
    try {
      makeVideo(site.path, 'clip.mp4', '64x64');
      const failed = run([...INDUCE_PREFIX, '-i', 'clip.mp4', '-c', 'copy', '-y', 'out.ogg'], site.path);

      expect(failed.status).not.toBe(0);
      expect(failed.stderr).toContain('Unsupported codec id in stream 0');

      const result = index.match(failed.stderr);

      expect(result.outcome).toBe('miss');
      if (result.outcome === 'matched') return;
      expect(result.twin.code).toBe('UNSTRUCTURED');
      expect(result.twin.fixes).toEqual([]);
      expect(result.twin.received).toBe(failed.stderr);
    } finally {
      site.cleanup();
    }
  }, 120_000);
});

describe('the mutation generator is seeded, reproducible and not vacuous', () => {
  const foreignOf = (seen: CatalogedStderr): readonly string[] =>
    captured.filter((other) => other.code !== seen.code).map((other) => other.line);

  it('produces the same mutation for the same seed, so a failure reproduces', () => {
    const seen = captured[0];
    if (seen === undefined) return expect.unreachable('nothing was induced');
    const foreign = foreignOf(seen);

    expect(cliMutate(seen.line, 4242, foreign)).toEqual(cliMutate(seen.line, 4242, foreign));
    expect(cliMutations(seen.line, foreign, 40)).toEqual(cliMutations(seen.line, foreign, 40));
  });

  it('produces every kind, and never a mutation identical to its source line', () => {
    const counts = new Map<CliMutationKind, number>();
    for (const seen of captured) {
      for (const mutation of cliMutations(seen.line, foreignOf(seen), SEEDS)) {
        expect(mutation.text, `${seen.code} seed ${String(mutation.seed)} changed nothing`).not.toBe(
          seen.line,
        );
        counts.set(mutation.kind, (counts.get(mutation.kind) ?? 0) + 1);
      }
    }

    for (const kind of CLI_MUTATION_KINDS) {
      expect(counts.get(kind) ?? 0, `the generator barely produced any ${kind} mutation`).toBeGreaterThan(
        50,
      );
    }
  });
});
