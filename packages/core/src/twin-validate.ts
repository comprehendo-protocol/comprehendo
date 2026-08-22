// Twin Builder [12], the gate half: the pure build-time checks CC3 [08] and
// CC7 [09] are made of, extracted from the construction path in `twin.ts`
// because they are the testable part and because one file does one job.
//
// Nothing here allocates a twin or touches an error. Every function is a
// pure value-to-violations transform, which is what lets the conformance kit
// run the SAME code the builder runs, so what CI checks and what a build
// enforces cannot drift apart. `twin.ts` re-exports all of it, so consumers
// still import one module.
//
// The `apply` grammar is LITERAL call data, shaped exactly like the
// provider's own call surface, and the rule is the one the conformance kit
// already encodes: every top-level operator key used in an `apply` must be a
// member of the declared call schema's operations.

import type { DeclaredCallSchema, Fix, ProviderCatalog, Twin } from './twin.js';

/** The code reserved for a failure the corpus has no entry for (RFC 5.1.4). */
export const UNSTRUCTURED_CODE = 'UNSTRUCTURED';

/**
 * The reason an UNSTRUCTURED twin carries. Fixed text on purpose: the raw
 * error is never the primary message (CC3 [08]), and this sentence is what
 * the kit's twin-round-trip fixture asserts verbatim.
 */
export const UNSTRUCTURED_REASON =
  'This failure is not yet in the corpus; the underlying message is preserved verbatim in received, and no fix is being guessed at.';

export type ViolationRule = 'CC3' | 'CC7' | 'CATALOG';

export type ViolationReason =
  | 'schema-escaping-fix'
  | 'unvalidatable-apply'
  | 'empty-apply'
  | 'fix-without-remedy'
  | 'fix-without-title'
  | 'dangling-docs-pointer'
  | 'empty-fixes'
  | 'empty-reason'
  | 'reserved-code'
  | 'duplicate-code'
  | 'unknown-code'
  | 'raw-error-leak'
  | 'raw-error-discarded';

export interface Violation {
  readonly rule: ViolationRule;
  readonly reason: ViolationReason;
  readonly locator: string;
  readonly message: string;
}

/**
 * A provider catalog that does not conform. Raised at builder construction,
 * which is what makes the check a BUILD-time gate: a provider carrying a
 * schema-escaping fix never gets a builder, so it never ships one.
 *
 * Deliberately a plain Error rather than a twinned one: this is a developer
 * error about the provider's own corpus, not a failure surfaced to an agent,
 * and a twin here would need a `code` vocabulary that belongs to the
 * provider, not to this shared builder.
 */
export class TwinCatalogError extends Error {
  readonly violations: readonly Violation[];

  constructor(violations: readonly Violation[]) {
    const detail = violations
      .map((v) => `  ${v.rule} ${v.reason} at ${v.locator}: ${v.message}`)
      .join('\n');
    super(
      `comprehendo: the provider catalog carries ${String(violations.length)} violation(s) and cannot ship:\n${detail}`,
    );
    this.name = 'TwinCatalogError';
    this.violations = Object.freeze([...violations]);
  }
}

export const violation = (
  rule: ViolationRule,
  reason: ViolationReason,
  locator: string,
  message: string,
): Violation => Object.freeze({ rule, reason, locator, message });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The raw error as text, when the raw value carries any. */
export const rawTextOf = (raw: unknown): string | undefined => {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Error) return raw.message;
  if (isRecord(raw) && typeof raw['message'] === 'string') return raw['message'];
  return undefined;
};

/**
 * The top-level operator keys an `apply` expresses, or `null` when the
 * `apply` is not structured call data at all.
 *
 * Top-level only: `{ $match: { created_at: { $gte: x } } }` expresses
 * `$match`, and `$gte` is operand data inside it, not a second operation.
 * `null` is not "no operations", it is "this cannot be checked", which the
 * caller turns into a violation: an opaque string is exactly how corpus text
 * would become a command channel.
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

/**
 * Recurse into a call/stage record's own values looking for a NESTED
 * pipeline, but only under a key the schema explicitly names in
 * `nestedPipelineOperations`. A stage nested there ($facet's per-branch
 * arrays, $lookup/$unionWith's `pipeline`) is just as capable of expressing
 * a write as a top-level one, so its keys count too. Every other nested
 * value, named or not, is left alone: operand data ($match's filter
 * document) is never scanned for keys, because nothing declares it as a
 * nesting operation.
 */
function collectNestedOperations(
  record: Record<string, unknown>,
  nestingKeys: ReadonlySet<string>,
  operations: string[],
): void {
  for (const [key, value] of Object.entries(record)) {
    if (!nestingKeys.has(key)) continue;
    collectPipelineLike(value, nestingKeys, operations);
  }
}

/** A value that might itself be a pipeline (an array of stages) or a record
 * of them ($facet's per-branch shape); collects operator keys from either. */
function collectPipelineLike(
  value: unknown,
  nestingKeys: ReadonlySet<string>,
  operations: string[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isRecord(item)) continue;
      operations.push(...Object.keys(item));
      collectNestedOperations(item, nestingKeys, operations);
    }
    return;
  }
  if (isRecord(value)) {
    // $facet-shaped: an object whose OWN values are pipelines, not a stage
    // itself, so its keys (the branch names) are never collected as
    // operations, only recursed through.
    for (const branch of Object.values(value)) {
      collectPipelineLike(branch, nestingKeys, operations);
    }
  }
}

/** One fix's `apply`, against the provider's declared call schema (CC7 [09]). */
function validateApply(apply: unknown, schema: DeclaredCallSchema, at: string): Violation[] {
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
  const allOperations = [...operations];
  if (nestingKeys.size > 0) {
    const calls = Array.isArray(apply) ? apply : [apply];
    for (const call of calls) {
      if (isRecord(call)) collectNestedOperations(call, nestingKeys, allOperations);
    }
  }
  return allOperations
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

/** One fix against the declared call schema and the corpus index (CC7 [09]). */
function validateFix(
  fix: Fix,
  schema: DeclaredCallSchema,
  topics: readonly string[],
  at: string,
): Violation[] {
  const found: Violation[] = [];
  if (fix.title.trim() === '') {
    found.push(violation('CATALOG', 'fix-without-title', `${at}.title`, 'a fix owes a title'));
  }
  if (fix.apply === undefined && fix.docs === undefined) {
    found.push(
      violation(
        'CC7',
        'fix-without-remedy',
        at,
        `the fix at ${at} carries neither apply nor docs, so it remedies nothing`,
      ),
    );
  }
  if (fix.apply !== undefined) found.push(...validateApply(fix.apply, schema, at));
  if (fix.docs !== undefined && !topics.includes(fix.docs)) {
    found.push(
      violation(
        'CC7',
        'dangling-docs-pointer',
        `${at}.docs`,
        `the fix at ${at} points at the topic "${fix.docs}", which the corpus index does not carry`,
      ),
    );
  }
  return found;
}

/**
 * Every way this catalog fails the contracts, as data. The builder runs this
 * once at construction and refuses to exist if it returns anything, which is
 * what "fails the build, not a runtime check" means here.
 */
export function validateCatalog(catalog: ProviderCatalog): readonly Violation[] {
  const found: Violation[] = [];
  const seen = new Set<string>();
  catalog.entries.forEach((entry, index) => {
    const at = `entries[${index}]`;
    if (entry.code === UNSTRUCTURED_CODE) {
      found.push(
        violation(
          'CC3',
          'reserved-code',
          `${at}.code`,
          `${UNSTRUCTURED_CODE} is reserved for a failure the corpus has no entry for; a cataloged failure owes its own code`,
        ),
      );
    }
    if (seen.has(entry.code)) {
      found.push(
        violation(
          'CATALOG',
          'duplicate-code',
          `${at}.code`,
          `the code ${entry.code} is cataloged twice, and a published code means exactly one thing`,
        ),
      );
    }
    seen.add(entry.code);
    if (entry.reason.trim() === '') {
      found.push(
        violation(
          'CATALOG',
          'empty-reason',
          `${at}.reason`,
          `the cataloged failure ${entry.code} carries no reason, and a twin owes a self-sufficient explanation`,
        ),
      );
    }
    // CC3 [08], at catalog time: an author who pastes the driver's raw text
    // straight into `reason` (rather than leaving it in `received`, where
    // this contract puts it) ships the exact leak this component exists to
    // catch, and it MUST fail here, not only when auditTwin() is run by
    // hand against a constructed Twin. See auditTwin()'s matching check.
    const rawText = rawTextOf(entry.received);
    if (rawText !== undefined && rawText !== '' && entry.reason.includes(rawText)) {
      found.push(
        violation(
          'CC3',
          'raw-error-leak',
          `${at}.reason`,
          `the cataloged failure ${entry.code} surfaces its own received text inside reason; the raw text belongs in received, verbatim, and is never the primary answer`,
        ),
      );
    }
    if (entry.fixes.length === 0) {
      found.push(
        violation(
          'CC3',
          'empty-fixes',
          `${at}.fixes`,
          `the cataloged failure ${entry.code} carries no fix, and a cataloged failure owes at least one`,
        ),
      );
    }
    entry.fixes.forEach((fix, fixIndex) => {
      found.push(
        ...validateFix(fix, catalog.declaredSchema, catalog.topics, `${at}.fixes[${fixIndex}]`),
      );
    });
  });
  return Object.freeze(found);
}

/**
 * The CC3 [08] audit: a twin must never hand back the raw error as its
 * primary message, and must never drop it either. `raw` is the underlying
 * text the provider actually received, when it is known.
 */
export function auditTwin(twin: Twin, raw?: unknown): readonly Violation[] {
  const found: Violation[] = [];
  const rawText = rawTextOf(raw);
  if (rawText !== undefined && rawText !== '' && twin.reason.includes(rawText)) {
    found.push(
      violation(
        'CC3',
        'raw-error-leak',
        'reason',
        'the twin surfaced the underlying raw error text as its primary reason; the raw text belongs in received, verbatim, and is never the answer',
      ),
    );
  }
  if (twin.code === UNSTRUCTURED_CODE && twin.received === undefined) {
    found.push(
      violation(
        'CC3',
        'raw-error-discarded',
        'received',
        'an UNSTRUCTURED twin preserves the raw error in received; this one dropped it, leaving the agent blind',
      ),
    );
  }
  return Object.freeze(found);
}
