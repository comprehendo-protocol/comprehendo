// Corpus Format [28]: version-range matching, the mechanism version-scoped
// witnesses and locks resolve against. Pure, no real binary needed here; the
// real binaries are exercised in ffmpeg-induction.test.ts and
// ffmpeg-upstream-watch.test.ts, which feed this module their real banners.

import { describe, expect, it } from 'vitest';

import {
  UnsupportedVersionError,
  VersionRangeError,
  matchesRange,
  parseVersion,
  resolveVersion,
} from '../src/version-range.js';

describe('parseVersion reads the leading N.N.N out of real banner text', () => {
  it('reads a bare version', () => {
    expect(parseVersion('4.4.2')).toEqual({ major: 4, minor: 4, patch: 2 });
  });

  it('reads a real ffmpeg banner line, distro suffix and all', () => {
    expect(parseVersion('ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023')).toEqual({
      major: 6,
      minor: 1,
      patch: 1,
    });
    expect(
      parseVersion('ffmpeg version 4.4.2-0ubuntu0.22.04.1 Copyright (c) 2000-2021'),
    ).toEqual({ major: 4, minor: 4, patch: 2 });
  });

  it('defaults a missing patch to 0', () => {
    expect(parseVersion('ffmpeg version 8')).toEqual({ major: 8, minor: 0, patch: 0 });
  });

  it('reads nothing out of text with no version', () => {
    expect(parseVersion('not a version at all')).toBeUndefined();
  });
});

describe('matchesRange, the AND of comparator clauses', () => {
  it('matches a real 4.4.2 banner against the 4.x range', () => {
    expect(matchesRange('>=4.4 <5', 'ffmpeg version 4.4.2-0ubuntu0.22.04.1')).toBe(true);
  });

  it('matches a real 6.1.1 banner against the 6.x range', () => {
    expect(matchesRange('>=6 <8', 'ffmpeg version 6.1.1-3ubuntu5')).toBe(true);
  });

  it('refuses a 4.4.2 banner against the 6.x range, and vice versa', () => {
    expect(matchesRange('>=6 <8', 'ffmpeg version 4.4.2-0ubuntu0.22.04.1')).toBe(false);
    expect(matchesRange('>=4.4 <5', 'ffmpeg version 6.1.1-3ubuntu5')).toBe(false);
  });

  it('excludes a hypothetical 5.x binary from both declared ranges', () => {
    expect(matchesRange('>=4.4 <5', 'ffmpeg version 5.0.0')).toBe(false);
    expect(matchesRange('>=6 <8', 'ffmpeg version 5.0.0')).toBe(false);
  });

  it('excludes a hypothetical 8.x binary, the range is a real ceiling not a floor', () => {
    expect(matchesRange('>=6 <8', 'ffmpeg version 8.0.0')).toBe(false);
  });

  it('a bare version is the old exact-pin meaning: matches only that build line', () => {
    expect(matchesRange('4.4.2', 'ffmpeg version 4.4.2-0ubuntu0.22.04.1')).toBe(true);
    expect(matchesRange('4.4.2', 'ffmpeg version 4.4.3-0ubuntu0.22.04.1')).toBe(false);
    expect(matchesRange('4.4.2', 'ffmpeg version 4.4.20')).toBe(false);
  });

  it('every clause in a multi-clause spec must hold, not just one', () => {
    expect(matchesRange('>=4.4 <5', 'ffmpeg version 4.3.9')).toBe(false);
    expect(matchesRange('>=4.4 <5', 'ffmpeg version 5.0.0')).toBe(false);
    expect(matchesRange('>=4.4 <5', 'ffmpeg version 4.9.9')).toBe(true);
  });

  it('never matches a version it cannot parse', () => {
    expect(matchesRange('>=4.4 <5', 'no version here')).toBe(false);
  });

  it('refuses a specifier it cannot parse, naming the token', () => {
    expect(() => matchesRange('~4.4', '4.4.2')).toThrow(VersionRangeError);
    expect(() => matchesRange('', '4.4.2')).toThrow(VersionRangeError);
    expect(() => matchesRange('   ', '4.4.2')).toThrow(VersionRangeError);
  });
});

describe('resolveVersion picks the declared range a binary belongs to', () => {
  const RANGES = Object.freeze(['>=4.4 <5', '>=6 <8']);

  it('resolves the 4.x range for a real 4.4.2 banner', () => {
    expect(resolveVersion(RANGES, 'ffmpeg version 4.4.2-0ubuntu0.22.04.1')).toBe('>=4.4 <5');
  });

  it('resolves the 6.x range for a real 6.1.1 banner', () => {
    expect(resolveVersion(RANGES, 'ffmpeg version 6.1.1-3ubuntu5')).toBe('>=6 <8');
  });

  it('refuses a binary in the declared gap (a hypothetical 5.x), naming the ranges tried', () => {
    expect(() => resolveVersion(RANGES, 'ffmpeg version 5.0.0')).toThrow(UnsupportedVersionError);
    expect(() => resolveVersion(RANGES, 'ffmpeg version 5.0.0')).toThrow(/>=4\.4 <5, >=6 <8/);
  });

  it('refuses a binary above every declared ceiling', () => {
    expect(() => resolveVersion(RANGES, 'ffmpeg version 9.0.0')).toThrow(UnsupportedVersionError);
  });
});
