// Fingerprint Index & Matcher [21], the matcher.
//
// Precision-first: a match must satisfy every facet the entry declares, and
// more than one surviving candidate is an ambiguity, never a ranked guess
// (the doc's "no heuristic drift"). The CC10 [20] property test lives in
// cc10-honest-miss.property.test.ts; these are the example-based cases.

import { describe, expect, test } from 'vitest';

import { buildFingerprintIndex, buildStaticPatternIndex, matchesPattern } from '../src/fingerprint.js';
import { CORPUS, ZOD_PARSE_UNGUARDED, caught } from './helpers/corpus.js';

const index = buildFingerprintIndex(CORPUS);
const patterns = buildStaticPatternIndex(CORPUS);

/** The ENOENT both @comprehendo/ffmpeg and @comprehendo/sharp fully match. */
const ambiguous = (): Error =>
  caught('Error', "ENOENT: no such file or directory, open '/in/clip.mp4'");

describe('a confident match needs every declared facet', () => {
  test('an error matching one entry on all its declared facets returns that entry', () => {
    const result = index.match(caught('FFmpegError', "Unknown encoder 'libx265'"));

    expect(result.outcome).toBe('matched');
    if (result.outcome !== 'matched') return;
    expect(result.entry.corpusEntryId).toBe('UNKNOWN_ENCODER');
    expect(result.entry.package).toBe('@comprehendo/ffmpeg');
  });

  test('an error-class hit with a message miss is not a match', () => {
    const result = index.match(caught('FFmpegError', 'Unknown encoder libx265'));

    expect(result.outcome).toBe('miss');
    expect(result.candidates.map((candidate) => candidate.name)).toContain(
      '@comprehendo/ffmpeg#UNKNOWN_ENCODER',
    );
  });

  test('message patterns match literal segments with wildcards, anchored end to end', () => {
    expect(matchesPattern("Unknown encoder '*'", "Unknown encoder 'libx265'")).toBe(true);
    expect(matchesPattern("Unknown encoder '*'", "ffmpeg: Unknown encoder 'libx265'")).toBe(false);
    expect(matchesPattern("Unknown encoder '*'", "Unknown encoder 'libx265' (fatal)")).toBe(false);
    expect(matchesPattern('exact', 'exact')).toBe(true);
    expect(matchesPattern('exact', 'exactly')).toBe(false);
    expect(matchesPattern('a*b*c', 'a__b__c')).toBe(true);
    expect(matchesPattern('a*b*c', 'a__c__b')).toBe(false);
  });

  test('a stack shape matches its frame markers in order; out-of-order frames do not match', () => {
    const frames = [
      'run (/app/node_modules/ffmpeg/lib/run.js:41:11)',
      'spawn (/app/node_modules/ffmpeg/lib/spawn.js:12:3)',
    ];
    const inOrder = index.match(
      caught('FFmpegError', 'Invalid argument: -crf must be between 0 and 51', frames),
    );
    const reversed = index.match(
      caught('FFmpegError', 'Invalid argument: -crf must be between 0 and 51', [...frames].reverse()),
    );

    expect(inOrder.outcome).toBe('matched');
    expect(reversed.outcome).toBe('miss');
    expect(reversed.candidates[0]?.rejectedOn).toEqual(['stackShape']);
    expect(reversed.candidates[0]?.matched).toEqual(['errorClass', 'messagePattern']);
  });

  test('stderr text with no class and no stack matches on message pattern alone', () => {
    const stderrIndex = buildFingerprintIndex([
      {
        package: '@comprehendo/ffmpeg',
        messagePattern: "Unknown encoder '*'",
        corpusEntryId: 'UNKNOWN_ENCODER',
      },
    ]);
    const result = stderrIndex.match("Unknown encoder 'libx265'");

    expect(result.outcome).toBe('matched');
    // The class-carrying corpus cannot confirm a class it never saw, so the
    // same stderr text is a miss there rather than a guess.
    expect(index.match("Unknown encoder 'libx265'").outcome).toBe('miss');
  });
});

describe('an ambiguous match degrades to UNSTRUCTURED with candidates named', () => {
  test('two entries matching every declared facet return UNSTRUCTURED, not either twin', () => {
    const result = index.match(ambiguous());

    expect(result.outcome).toBe('ambiguous');
    if (result.outcome === 'matched') return;
    expect(result.twin.code).toBe('UNSTRUCTURED');
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((candidate) => candidate.rejectedOn.length === 0)).toBe(true);
  });

  test('the UNSTRUCTURED twin names both candidates as package#entry', () => {
    const result = index.match(ambiguous());

    if (result.outcome === 'matched') return expect.unreachable('ambiguity must not resolve');
    expect(result.twin.accepts).toEqual([
      '@comprehendo/ffmpeg#INPUT_MISSING',
      '@comprehendo/sharp#INPUT_MISSING',
    ]);
  });

  test('the UNSTRUCTURED twin preserves the raw message verbatim in received and guesses no fix', () => {
    const raw = ambiguous();
    const result = index.match(raw);

    if (result.outcome === 'matched') return expect.unreachable('ambiguity must not resolve');
    expect(result.twin.received).toBe(raw.message);
    expect(result.twin.fixes).toEqual([]);
    expect(result.twin.reason).toContain('no fix is being guessed at');
    expect(Object.isFrozen(result.twin)).toBe(true);
  });
});

describe('a miss is honest about what was considered', () => {
  test('a near miss names the candidates that were considered and rejected', () => {
    const result = index.match(caught('FFmpegError', "Unknown encoder 'libx265"));

    expect(result.outcome).toBe('miss');
    if (result.outcome === 'matched') return;
    expect(result.twin.accepts).toEqual([
      '@comprehendo/ffmpeg#INVALID_ARGUMENT',
      '@comprehendo/ffmpeg#UNKNOWN_ENCODER',
    ]);
  });

  test('each candidate reports the facets it matched and the facets it was rejected on', () => {
    const result = index.match(caught('FFmpegError', "Unknown encoder 'libx265"));
    const candidate = result.candidates.find(
      (each) => each.name === '@comprehendo/ffmpeg#UNKNOWN_ENCODER',
    );

    expect(candidate?.matched).toEqual(['errorClass']);
    expect(candidate?.rejectedOn).toEqual(['messagePattern']);
  });

  test('an input with nothing close returns UNSTRUCTURED with no candidates named', () => {
    const result = index.match(caught('SomethingElseError', 'the disk went away'));

    expect(result.outcome).toBe('miss');
    if (result.outcome === 'matched') return;
    expect(result.candidates).toEqual([]);
    expect(result.twin.accepts).toBeUndefined();
    expect(result.twin.received).toBe('the disk went away');
  });
});

describe('the static-pattern kind has its own separate index, never this one', () => {
  // Fixed: `buildFingerprintIndex` (the runtime-error index) used to carry
  // EVERY entry regardless of kind and filter at match time; a static-pattern
  // entry now never enters this index's `.entries` at all (`fingerprint.ts`'s
  // `buildIndexOfKind`), a stronger guarantee than "filtered at match time",
  // and the one `buildStaticPatternIndex` (below) actually indexes it into.
  test('a static-pattern entry declared in the same corpus never enters this index', () => {
    expect(index.entries.some((entry) => entry.kind === 'static-pattern')).toBe(false);
  });

  test('a caught runtime error never matches a static-pattern entry, and never makes one ambiguous', () => {
    const result = index.match(caught('ZodError', 'expected string, received number: invalid_type'));

    expect(result.outcome).toBe('miss');
    expect(result.candidates).toEqual([]);
  });
});

describe('buildStaticPatternIndex: the genuinely separate index static-pattern entries live in', () => {
  test('carries the static-pattern entry and none of the runtime-error ones', () => {
    expect(patterns.entries).toHaveLength(1);
    expect(patterns.entries[0]?.corpusEntryId).toBe(ZOD_PARSE_UNGUARDED.corpusEntryId);
  });

  // The raw text handed to `.match()` here is a SOURCE-CODE snippet, not a
  // caught error's message: `observe()`/`judge()` are pure text-facet
  // checks either way (errorClass against a name-like field, messagePattern
  // against the raw text), so the same shape works for both, and this is
  // the one call site where that generality is actually exercised for a
  // second, genuinely different kind of "raw".
  test('matches a source snippet naming the pattern, the same errorClass+messagePattern facets a runtime index checks', () => {
    const result = patterns.match(
      caught('ZodError', 'schema.parse(input) // invalid_type: no try/catch around this call'),
    );

    expect(result.outcome).toBe('matched');
    if (result.outcome !== 'matched') return;
    expect(result.entry.corpusEntryId).toBe('PARSE_UNGUARDED');
  });

  test('a near-miss snippet, structurally similar but not the cataloged pattern, does not match', () => {
    const result = patterns.match(caught('ZodError', 'schema.safeParse(input) // handled explicitly'));

    expect(result.outcome).toBe('miss');
  });
});
