// Cold-Agent Benchmark [38]: version-range matching, duplicated from
// Corpus Format [28]'s real `packages/registry-tools/src/version-range.ts`
// for the same build-boundary reason `cold-agent-apply.ts` duplicates
// `applyToArgv`: a `scripts/` module loads packages from their built
// `dist/`, never from another package's `src/`, so the real implementation
// is not importable from here at all. GUARDED, not just copied:
// `packages/registry-tools/test/cold-agent-benchmark.test.ts` asserts this
// produces the identical answer as the real module on every range this
// suite actually declares, so a divergence in either one goes red.
//
// Deliberately the small subset this file needs (does a version fall in a
// declared range) and nothing the real module's fuller grammar covers that
// nothing here uses.

/** One release number, as three integers. */
export interface ParsedVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** The leading `N.N.N` (or fewer parts) anywhere in the text. */
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

function parseClause(token: string): { readonly op: Comparator; readonly at: ParsedVersion } {
  const match = /^(>=|<=|>|<|=)?\s*(\d+(?:\.\d+){0,2})$/.exec(token);
  const op = (match?.[1] as Comparator | undefined) ?? '=';
  const at = match === null ? undefined : parseVersion(match[2] ?? '');
  if (at === undefined) throw new Error(`"${token}" is not a version clause`);
  return Object.freeze({ op, at });
}

/** Whether `version` satisfies `spec`, a space-separated AND of clauses. */
export function matchesRange(spec: string, version: string): boolean {
  const observed = parseVersion(version);
  if (observed === undefined) return false;
  const clauses = spec
    .trim()
    .split(/\s+/)
    .filter((token) => token !== '')
    .map(parseClause);
  return clauses.length > 0 && clauses.every((clause) => OPS[clause.op](cmp(observed, clause.at)));
}
