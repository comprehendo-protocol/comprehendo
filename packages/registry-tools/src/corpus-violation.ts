// Corpus Format [28]: what a refusal IS, in one place.
//
// Every check in this component reports the same shape, and the shape is data
// rather than an exception, because Submission Gate [29] renders the whole list
// into one PR comment. A corpus author fixing one finding per CI run is how a
// submission channel dies.
//
// THE REASON VOCABULARY IS CORE'S VOCABULARY, ON PURPOSE. The native tier
// enforces the same contracts in `validateCatalog`
// (packages/core/src/twin-validate.ts) and reports these exact reason strings.
// registry-tools takes no runtime import from core (the packages install
// independently, and a `../../core/src` import from `src/` breaks rootDir), so
// the rule is implemented twice; keeping the vocabulary identical is what lets
// `corpus-validate.test.ts` run core's REAL gate over the same corpus and
// assert this one reports every reason it does. A renamed reason here turns
// that test red instead of letting the two tiers drift apart quietly.

export type CorpusViolationRule = 'CC3' | 'CC7' | 'CATALOG' | 'FORMAT';

export type CorpusViolationReason =
  // core's own vocabulary, held to it by the agreement test
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
  | 'raw-error-leak'
  // this format's own, which the native tier has no occasion to check
  | 'undeclared-call-schema'
  | 'one-topic-per-file'
  | 'two-topics-one-file'
  | 'stray-topic-file'
  | 'duplicate-topic'
  | 'stub-field'
  | 'topic-without-summary'
  | 'topic-without-vocabulary'
  | 'unmatchable-fingerprint'
  | 'orphan-fix';

export interface CorpusViolation {
  readonly rule: CorpusViolationRule;
  readonly reason: CorpusViolationReason;
  /** Where in the corpus, addressable enough for an author to go and fix it. */
  readonly locator: string;
  readonly message: string;
}

export const violation = (
  rule: CorpusViolationRule,
  reason: CorpusViolationReason,
  locator: string,
  message: string,
): CorpusViolation => Object.freeze({ rule, reason, locator, message });

/**
 * A corpus that cannot be READ at all, or one that was asked to be packed
 * while it still fails validation. Carries the violations as data, not only
 * inside its message, because a CI wrapper renders them and a human reads them.
 */
export class CorpusFormatError extends Error {
  readonly violations: readonly CorpusViolation[];

  constructor(message: string, violations: readonly CorpusViolation[] = []) {
    const detail = violations
      .map((found) => `  ${found.rule} ${found.reason} at ${found.locator}: ${found.message}`)
      .join('\n');
    super(detail === '' ? message : `${message}\n${detail}`);
    this.name = 'CorpusFormatError';
    this.violations = Object.freeze([...violations]);
  }
}
