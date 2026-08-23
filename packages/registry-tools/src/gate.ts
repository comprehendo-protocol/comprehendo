// Submission Gate [29]: the check logic every registry corpus PR runs through.
//
// WHAT THIS FILE IS, AND WHAT IT IS NOT. The doc describes a CI job on
// `comprehendo-protocol/registry`. The job (the workflow file, CODEOWNERS, the
// merge bot) lives in THAT repository, which is not this one; what lives here
// is the thing the job imports and runs. That split is deliberate: a workflow
// file committed into this repo would never fire, and a check nobody can run
// locally is a check nobody debugs. See the feature doc's Known Issues, which
// records the boundary rather than leaving it implied.
//
// ONE DISCIPLINE FOR BOTH TIERS. There is no tier parameter anywhere in
// `GateInput`, and that is the enforcement, not an omission: the Operator's own
// native corpus and a community sidecar corpus are the same kind of value here,
// so no code path can special-case either.
//
// NOTHING PASSES BY DEFAULT. Every check has three outcomes, and the third is
// `not-run`. A gate handed no upstream verification has not verified the
// corpus against reality, a gate handed no CC5 meter has not measured it, and
// in both cases `pass` is false with the reason named. That is also how this
// feature's own mandatory integration contract is enforced structurally rather
// than by convention: `verifyAgainstUpstream` is not optional, so a caller who
// skips it cannot get a publishable result out of this function.

import { CorpusFormatError, pack, validate } from './corpus-format.js';
import type { CorpusViolation, CorpusViolationReason } from './corpus-format.js';
import type { FingerprintIndex } from './fingerprint.js';
import { budgetFindings, type BudgetMeter } from './gate-budget.js';
import { buildIndex, fingerprintFindings } from './gate-fingerprint.js';
import { folkloreFindings, registryTruthFindings } from './gate-folklore.js';
import { dangerLintFindings, injectionLintFindings, loopLintFindings } from './gate-lints.js';
import { mergePolicy, type MergePolicy, type PullRequestFacts } from './gate-policy.js';
import {
  GATE_CHECKS,
  finding,
  renderFinding,
  type CheckOutcome,
  type GateCheck,
  type GateFinding,
  type SubmissionCorpus,
} from './gate-result.js';
import { telemetryFindings } from './gate-telemetry.js';
import type { UpstreamVerification } from './gate-upstream.js';

export interface GateInput {
  readonly prId: string;
  readonly corpora: readonly SubmissionCorpus[];
  /** Corpora already on main: their fingerprints share ONE index with the PR's. */
  readonly published?: readonly SubmissionCorpus[];
  /** What `verifyAgainstUpstream` really observed, one entry per directory. */
  readonly upstream?: readonly UpstreamVerification[];
  readonly measure?: BudgetMeter;
  readonly pr?: PullRequestFacts;
}

export interface GateResult {
  readonly prId: string;
  readonly checks: Readonly<Record<GateCheck, CheckOutcome>>;
  readonly pass: boolean;
  /** Only a submission that passed every check may be packed and published. */
  readonly publishable: boolean;
  readonly violations: readonly string[];
  readonly findings: readonly GateFinding[];
  readonly merge: MergePolicy;
  /** The one compiled index, built from every corpus, when it builds at all. */
  readonly index: FingerprintIndex | undefined;
}

/**
 * Corpus Format [28]'s reasons, sorted into this gate's check names. The rules
 * are 28's and are not re-implemented here; what this table does is answer
 * "which check does an author see this under", which is a reporting decision,
 * not a second gate.
 */
const SCHEMA_BOUND: readonly CorpusViolationReason[] = Object.freeze([
  'schema-escaping-fix',
  'unvalidatable-apply',
  'empty-apply',
  'undeclared-call-schema',
  'fix-without-remedy',
]);

const checkFor = (violation: CorpusViolation): GateCheck =>
  violation.reason === 'dangling-docs-pointer'
    ? 'docsPointerIntegrity'
    : SCHEMA_BOUND.includes(violation.reason)
      ? 'schemaBoundFix'
      : 'corpusFormat';

/** 28's REAL `validate`, reported under this gate's names. */
const formatFindings = (submission: SubmissionCorpus): readonly GateFinding[] =>
  validate(submission.source).map((violation) =>
    finding(
      checkFor(violation),
      submission.directory,
      violation.locator,
      `${violation.rule} ${violation.reason}: ${violation.message}`,
    ),
  );

/** The budget half, which needs an artifact and a meter, and says when it has neither. */
function budgetOf(
  submission: SubmissionCorpus,
  measure: BudgetMeter | undefined,
  notRun: Set<GateCheck>,
): readonly GateFinding[] {
  if (measure === undefined) {
    notRun.add('budget');
    return [
      finding(
        'budget',
        submission.directory,
        'docs',
        'no CC5 budget meter was supplied, so this corpus was never measured; a gate that cannot measure never reports a corpus as fitting',
      ),
    ];
  }
  try {
    return budgetFindings(pack(submission.source), submission.directory, measure);
  } catch (error) {
    if (!(error instanceof CorpusFormatError)) throw error;
    notRun.add('budget');
    return [
      finding(
        'budget',
        submission.directory,
        'docs',
        'this corpus does not validate, so it packs into no artifact and there was nothing to measure; fix the corpus violations first',
      ),
    ];
  }
}

/** The two checks that exist only if the gate really ran against the package. */
function truthOf(
  submission: SubmissionCorpus,
  verification: UpstreamVerification | undefined,
  notRun: Set<GateCheck>,
): readonly GateFinding[] {
  if (verification !== undefined) {
    return [
      ...registryTruthFindings(submission, verification),
      ...folkloreFindings(submission, verification),
    ];
  }
  notRun.add('registryTruth');
  notRun.add('folklore');
  const why =
    'no verifyAgainstUpstream result was supplied for this corpus, so nothing was installed, nothing was induced, and no claim it makes has been checked against the real package';
  return [
    finding('registryTruth', submission.directory, 'verifyAgainstUpstream', why),
    finding(
      'folklore',
      submission.directory,
      'verifyAgainstUpstream',
      `${why}; the folklore rule ships nothing a test did not provoke`,
    ),
  ];
}

/** Every check, on every corpus in the PR, in one pass. */
export function runSubmissionGate(input: GateInput): GateResult {
  const published = input.published ?? [];
  const notRun = new Set<GateCheck>();
  const findings: GateFinding[] = [...fingerprintFindings(input.corpora, published)];

  for (const submission of input.corpora) {
    findings.push(
      ...formatFindings(submission),
      ...loopLintFindings(submission),
      ...dangerLintFindings(submission),
      ...injectionLintFindings(submission),
      ...telemetryFindings(submission),
      ...truthOf(
        submission,
        (input.upstream ?? []).find((entry) => entry.directory === submission.directory),
        notRun,
      ),
      ...budgetOf(submission, input.measure, notRun),
    );
  }

  const failed = new Set(findings.map((found) => found.check));
  const checks = Object.fromEntries(
    GATE_CHECKS.map((check): [GateCheck, CheckOutcome] => [
      check,
      notRun.has(check) ? 'not-run' : failed.has(check) ? 'fail' : 'pass',
    ]),
  ) as Record<GateCheck, CheckOutcome>;

  const pass = GATE_CHECKS.every((check) => checks[check] === 'pass');
  let index: FingerprintIndex | undefined;
  try {
    index = buildIndex(input.corpora, published);
  } catch {
    // The reason is already a fingerprintLint finding; a refusal to compile is
    // reported once, as a check result, never twice as a thrown error too.
    index = undefined;
  }
  return Object.freeze({
    prId: input.prId,
    checks: Object.freeze(checks),
    pass,
    publishable: pass,
    violations: Object.freeze(findings.map(renderFinding)),
    findings: Object.freeze(findings),
    merge: mergePolicy(input.pr, pass, findings.some((found) => found.check === 'dangerLint')),
    index,
  });
}
