// CC10 Honest Miss [20], enforced against this matcher.
//
// The contract's own words: "Property testing is the enforcement mechanism,
// not example-based fixtures alone: mutate a known error message character by
// character (or field by field) and assert the matcher degrades to
// UNSTRUCTURED rather than confidently returning a nearby wrong twin."
//
// The generator is seeded so a failure reproduces from the seed printed in
// the assertion message. The oracle below is a deliberately naive re-derivation
// over the same corpus, written straight from the doc's rule ("every declared
// facet must match"), so a confident answer is checked against something other
// than the matcher's own bookkeeping.

import { describe, expect, test } from 'vitest';

import {
  buildFingerprintIndex,
  matchesPattern,
  matchesStackShape,
  observe,
  type FingerprintEntry,
  type MatchResult,
} from '../src/fingerprint.js';
import { CORPUS, SAMPLES, caught, errorFor, UNKNOWN_ENCODER, NO_DECODE_DELEGATE } from './helpers/corpus.js';
import { mutate, mutations, type MutationKind } from './helpers/mutate.js';

const index = buildFingerprintIndex(CORPUS);

/** The oracle: which corpus entries does this raw error fully justify? */
function fullMatches(raw: unknown): readonly FingerprintEntry[] {
  const seen = observe(raw);
  return CORPUS.filter((entry) => {
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
  });
}

/** Every mutation of every cataloged sample message, seeded 1..count. */
function* corpusMutations(
  count: number,
  kinds?: readonly MutationKind[],
): Generator<{ seed: number; kind: MutationKind; raw: Error; expected: string; result: MatchResult }> {
  for (const sample of SAMPLES) {
    for (const mutation of mutations(sample.message, count)) {
      if (kinds !== undefined && !kinds.includes(mutation.kind)) continue;
      const raw = errorFor(sample, mutation.text);
      yield {
        seed: mutation.seed,
        kind: mutation.kind,
        raw,
        expected: sample.entry.corpusEntryId,
        result: index.match(raw),
      };
    }
  }
}

/** No confident answer for any entry other than the one that was mutated. */
function assertNeverAWrongTwin(kinds: readonly MutationKind[], count = 120): number {
  let seen = 0;
  for (const trial of corpusMutations(count, kinds)) {
    seen += 1;
    if (trial.result.outcome !== 'matched') continue;
    expect(
      trial.result.entry.corpusEntryId,
      `seed ${trial.seed} (${trial.kind}) on ${JSON.stringify(trial.raw.message)} resolved to the wrong entry`,
    ).toBe(trial.expected);
  }
  expect(seen, `no ${kinds.join('/')} mutations were generated, the property would be vacuous`).toBeGreaterThan(10);
  return seen;
}

describe('mutated cataloged messages never produce a confident wrong twin', () => {
  test('character substitutions never resolve to an entry other than the mutated one', () => {
    expect(assertNeverAWrongTwin(['substitute'])).toBeGreaterThan(10);
  });

  test('truncations never resolve to an entry other than the mutated one', () => {
    expect(assertNeverAWrongTwin(['truncate'])).toBeGreaterThan(10);
  });

  test('insertions and deletions never resolve to an entry other than the mutated one', () => {
    expect(assertNeverAWrongTwin(['insert', 'delete', 'transpose'])).toBeGreaterThan(10);
  });

  test('a message mutated past its pattern degrades to UNSTRUCTURED, never to a twin', () => {
    let degraded = 0;
    for (const trial of corpusMutations(200)) {
      if (fullMatches(trial.raw).length > 0) continue;
      degraded += 1;
      expect(
        trial.result.outcome,
        `seed ${trial.seed} (${trial.kind}) on ${JSON.stringify(trial.raw.message)} must not resolve`,
      ).not.toBe('matched');
      if (trial.result.outcome === 'matched') continue;
      expect(trial.result.twin.code).toBe('UNSTRUCTURED');
      expect(trial.result.twin.fixes).toEqual([]);
      expect(trial.result.twin.received).toBe(trial.raw.message);
    }
    expect(degraded, 'no mutation broke its pattern, the property would be vacuous').toBeGreaterThan(50);
  });
});

describe('field permutation degrades honestly', () => {
  const permuted = caught(
    UNKNOWN_ENCODER.errorClass ?? '',
    "no decode delegate for this image format 'HEIC'",
  );

  test('one entry class with another entry message resolves to UNSTRUCTURED', () => {
    const result = index.match(permuted);

    expect(result.outcome).toBe('miss');
    if (result.outcome === 'matched') return;
    expect(result.twin.code).toBe('UNSTRUCTURED');
  });

  test('a permuted input names the entries that were considered and rejected', () => {
    const result = index.match(permuted);

    if (result.outcome === 'matched') return expect.unreachable('a permutation must not resolve');
    expect(result.twin.accepts).toContain(`${UNKNOWN_ENCODER.package}#${UNKNOWN_ENCODER.corpusEntryId}`);
    expect(result.twin.accepts).toContain(
      `${NO_DECODE_DELEGATE.package}#${NO_DECODE_DELEGATE.corpusEntryId}`,
    );
    const rejected = result.candidates.find(
      (candidate) => candidate.name === `${NO_DECODE_DELEGATE.package}#${NO_DECODE_DELEGATE.corpusEntryId}`,
    );
    expect(rejected?.matched).toEqual(['messagePattern']);
    expect(rejected?.rejectedOn).toEqual(['errorClass']);
  });
});

describe('every degraded result stays honest about coverage', () => {
  test('across the whole mutation corpus, no result is a twin for an entry whose facets did not all match', () => {
    let confident = 0;
    for (const trial of corpusMutations(200)) {
      const justified = fullMatches(trial.raw);
      if (trial.result.outcome === 'matched') {
        confident += 1;
        expect(justified.map((entry) => entry.corpusEntryId), `seed ${trial.seed}`).toEqual([
          trial.result.entry.corpusEntryId,
        ]);
      } else {
        expect(justified.length, `seed ${trial.seed} left exactly one justified entry unreturned`).not.toBe(1);
      }
    }
    expect(confident, 'no mutation stayed inside its pattern, the property would be vacuous').toBeGreaterThan(0);
  });

  test('any result with a facet still matching names at least one candidate', () => {
    let named = 0;
    for (const trial of corpusMutations(200)) {
      if (trial.result.outcome === 'matched') continue;
      if (trial.result.candidates.length === 0) continue;
      named += 1;
      expect(trial.result.twin.accepts, `seed ${trial.seed} degraded without naming candidates`).toEqual(
        trial.result.candidates.map((candidate) => candidate.name),
      );
      expect(trial.result.candidates.every((candidate) => candidate.matched.length > 0)).toBe(true);
    }
    expect(named, 'no degraded result carried candidates, the property would be vacuous').toBeGreaterThan(50);
  });
});

describe('the mutation generator is deterministic', () => {
  test('the same seed produces the same mutations, so a failure reproduces', () => {
    const message = SAMPLES[0]?.message ?? '';

    expect(mutate(message, 4242)).toEqual(mutate(message, 4242));
    expect(mutations(message, 25)).toEqual(mutations(message, 25));
    expect(mutations(message, 25)[7]).not.toEqual(mutations(message, 25)[8]);
  });
});
