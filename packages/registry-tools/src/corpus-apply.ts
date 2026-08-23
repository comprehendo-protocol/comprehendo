// Corpus Format [28], the CC7 [09] fence: is this fix's `apply` inside the
// provider's own declared call schema?
//
// Split out of `corpus-validate.ts` at the size gate, the same way core splits
// `twin.ts` from `twin-validate.ts` and this package splits `fingerprint.ts`
// from `fingerprint-facets.ts`, and for the same reason: the apply grammar is
// the security-critical, purely testable part, so it is the part that gets its
// own file rather than living inside a walk over records.
//
// "Corpus text is data, never instructions" is the whole rule. An `apply` is
// LITERAL call data shaped exactly like the provider's own call surface, and
// every top-level operator key it uses must be a member of the declared
// schema's operations. Anything that cannot be read as literal call data is a
// violation, never a shrug: an opaque string is exactly how a compromised
// corpus would smuggle a command past a gate that only checked what it could
// parse.
//
// This is a second implementation of the rule core enforces in
// `validateCatalog`, deliberately (registry-tools takes no runtime import from
// core). `corpus-validate.test.ts` runs core's REAL gate over the same corpus
// and asserts the two agree, so the duplication is held, not hoped over.

import type { CorpusCallSchema } from './corpus-source.js';
import { violation, type CorpusViolation } from './corpus-violation.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The top-level operator keys an `apply` expresses, or `null` when the `apply`
 * is not structured call data at all.
 *
 * Top-level only: `{ $match: { created_at: { $gte: x } } }` expresses `$match`,
 * and `$gte` is operand data inside it, not a second operation. `null` is not
 * "no operations", it is "this cannot be checked", which the caller turns into
 * a violation.
 */
export function applyOperations(apply: unknown): readonly string[] | null {
  if (Array.isArray(apply)) {
    const operations: string[] = [];
    for (const call of apply) {
      if (!isRecord(call)) return null;
      operations.push(...Object.keys(call));
    }
    return operations;
  }
  if (isRecord(apply)) return Object.keys(apply);
  return null;
}

/** A value that might itself be a pipeline, or an object of them ($facet). */
function collectPipelineLike(
  value: unknown,
  nestingKeys: ReadonlySet<string>,
  operations: string[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      operations.push(...Object.keys(item));
      collectNested(item, nestingKeys, operations);
    }
    return;
  }
  if (isRecord(value)) {
    for (const branch of Object.values(value)) collectPipelineLike(branch, nestingKeys, operations);
  }
}

/**
 * Recurse into a stage's values ONLY under a key the schema names in
 * `nestedPipelineOperations`. A stage nested there ($facet's per-branch arrays,
 * $lookup's `pipeline`) is just as capable of expressing a write as a top-level
 * one, so its keys count too. Everything else is operand data (a $match filter
 * document) and is never scanned for keys, because nothing declares it as a
 * nesting operation, so an operand key can never be mistaken for an operation.
 */
function collectNested(
  stage: Record<string, unknown>,
  nestingKeys: ReadonlySet<string>,
  operations: string[],
): void {
  for (const [key, value] of Object.entries(stage)) {
    if (nestingKeys.has(key)) collectPipelineLike(value, nestingKeys, operations);
  }
}

/**
 * One fix's `apply`, against the provider's declared call schema.
 *
 * A corpus that declares NO call schema and still carries an `apply` is
 * refused, not waved through: an apply nobody can check is not an apply that is
 * safe, and the authoring format has a slot for the schema precisely so this
 * case has an answer other than a guess.
 */
export function validateApply(
  apply: unknown,
  schema: CorpusCallSchema | undefined,
  at: string,
): CorpusViolation[] {
  if (schema === undefined) {
    return [
      violation(
        'CC7',
        'undeclared-call-schema',
        `${at}.apply`,
        `the fix at ${at} carries an apply, and this corpus declares no call schema for it to stay inside; ` +
          'an apply nobody can check is not an apply that is safe',
      ),
    ];
  }
  const operations = applyOperations(apply);
  if (operations === null) {
    return [
      violation(
        'CC7',
        'unvalidatable-apply',
        `${at}.apply`,
        `the fix at ${at} expresses its apply as something other than literal call data for ${schema.surface}, so it cannot be checked against the declared schema at all`,
      ),
    ];
  }
  if (operations.length === 0) {
    return [
      violation(
        'CC7',
        'empty-apply',
        `${at}.apply`,
        `the fix at ${at} expresses no operation, so there is nothing for an agent to apply`,
      ),
    ];
  }
  const nestingKeys = new Set(schema.nestedPipelineOperations ?? []);
  const all = [...operations];
  if (nestingKeys.size > 0) {
    for (const call of Array.isArray(apply) ? apply : [apply]) {
      if (isRecord(call)) collectNested(call, nestingKeys, all);
    }
  }
  return all
    .filter((operation) => !schema.operations.includes(operation))
    .map((operation) =>
      violation(
        'CC7',
        'schema-escaping-fix',
        `${at}.apply`,
        `the fix at ${at} expresses ${operation}, an operation the provider never declared: ${schema.surface} declares only ${schema.operations.join(', ')}`,
      ),
    );
}
