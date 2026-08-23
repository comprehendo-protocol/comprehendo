// Corpus Format [28]: a target package can now be authored against more than
// one major release of the tool it wraps, because a wrapped CLI (unlike a
// library the registry publishes itself) changes its own wording on its own
// schedule. This module is the one place that decides whether an installed
// binary's version string falls inside a declared range.
//
// TWO SPECIFIER SHAPES, ONE FUNCTION. `>=4.4 <5` is a RANGE: every comparator,
// space-separated, ALL must hold. A bare `4.4.2` with no comparator is an
// EXACT specifier, the old single-pin meaning `target.version` always had:
// authored against exactly this build, nothing else. Mixing the two forms in
// one specifier is refused rather than guessed at.
//
// Deliberately not semver: ffmpeg publishes MAJOR.MINOR.PATCH with no
// pre-release or build-metadata grammar a range needs to reason about, and a
// generic parser here would accept forms this project has never seen a real
// version string use.

/** One release number, as three integers. Undefined when the text has none. */
export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * The leading `N.N.N` (or `N.N`, patch defaulting to 0) anywhere in the text.
 * Handles both a bare version (`4.4.2`) and a full banner line (`ffmpeg
 * version 6.1.1-3ubuntu5 Copyright ...`), because `requireFfmpeg`'s real
 * output is the banner and this is what every caller actually has in hand.
 */
export function parseVersion(text: string): ParsedVersion | undefined {
  const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text);
  if (match === null) return undefined;
  return Object.freeze({
    major: Number(match[1]),
    minor: match[2] === undefined ? 0 : Number(match[2]),
    patch: match[3] === undefined ? 0 : Number(match[3]),
  });
}

const cmp = (a: ParsedVersion, b: ParsedVersion): number =>
  a.major - b.major || a.minor - b.minor || a.patch - b.patch;

type Comparator = '>=' | '<=' | '>' | '<' | '=';

const OPS: Readonly<Record<Comparator, (order: number) => boolean>> = Object.freeze({
  '>=': (order) => order >= 0,
  '<=': (order) => order <= 0,
  '>': (order) => order > 0,
  '<': (order) => order < 0,
  '=': (order) => order === 0,
});

/** A range clause the format cannot parse. Never a silent "does not match". */
export class VersionRangeError extends Error {
  public override readonly name = 'VersionRangeError';
}

interface Clause {
  readonly op: Comparator;
  readonly at: ParsedVersion;
}

function parseClause(token: string): Clause {
  const match = /^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/.exec(token);
  if (match === null) {
    throw new VersionRangeError(`"${token}" is not a version clause (a version, or >=/<=/>/</= plus one)`);
  }
  const op = (match[1] as Comparator | undefined) ?? '=';
  const at = parseVersion(match[2] ?? '');
  if (at === undefined) {
    throw new VersionRangeError(`"${token}" names no readable version`);
  }
  return Object.freeze({ op, at });
}

/**
 * The installed binary matches none of a corpus's declared `target.versions`
 * ranges. A DIFFERENT finding than drift (Fix 3, Upstream Watch [34]): drift
 * means a supported binary stopped matching its own locked witnesses; this
 * means the binary was never a supported target to begin with. Both fail
 * loudly; only this one names the ranges the corpus actually declares.
 */
export class UnsupportedVersionError extends Error {
  public override readonly name = 'UnsupportedVersionError';
}

/**
 * The first range in `ranges` that `version` satisfies, or the refusal
 * naming every range that was tried, when none does. Callers that resolve a
 * witness set, a lock range, or a gate's per-major behavior all share this
 * one selection rule, so "which range does this binary belong to" is
 * answered once.
 */
export function resolveVersion(ranges: readonly string[], version: string): string {
  const found = ranges.find((range) => matchesRange(range, version));
  if (found === undefined) {
    throw new UnsupportedVersionError(
      `${version} matches none of the declared version ranges (${ranges.join(', ')})`,
    );
  }
  return found;
}

/**
 * Whether `version` (a bare version or a banner line `parseVersion` can read)
 * satisfies `spec`, a space-separated AND of comparator clauses (`>=4.4 <5`)
 * or a single bare version (`4.4.2`, exact match, the old `target.version`
 * meaning). Refuses a spec it cannot parse; never matches a version it
 * cannot parse either, since "no version" and "does not match" are the same
 * fact from a range's point of view.
 */
export function matchesRange(spec: string, version: string): boolean {
  const observed = parseVersion(version);
  if (observed === undefined) return false;
  const clauses = spec
    .trim()
    .split(/\s+/)
    .filter((token) => token !== '')
    .map(parseClause);
  if (clauses.length === 0) {
    throw new VersionRangeError('a version specifier is never empty');
  }
  return clauses.every((clause) => OPS[clause.op](cmp(observed, clause.at)));
}
