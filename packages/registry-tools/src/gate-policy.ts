// Submission Gate [29]: the trust ladder, the human layer on top of the
// content checks.
//
// Everything else in this component asks "is this corpus true and safe". This
// module asks the other question: "who is allowed to land it without a human
// looking". Green CI is a PRECONDITION for an automatic merge and never a
// licence for one, which is the whole reason this is a separate decision from
// `pass`.
//
// Every rule here fails CLOSED. An unknown fact is never read as a permissive
// one: no PR facts at all means core review, and an unknown adoption level on
// a first-time corpus is treated as high adoption. The cost of failing closed
// is a human looking at a PR that did not need it; the cost of failing open is
// a corpus for a widely-installed package landing unread.

export type Adoption = 'high' | 'ordinary';

/** What CI knows about the PR itself, as opposed to the corpus content. */
export interface PullRequestFacts {
  /** No corpus for this package exists on main yet. */
  readonly firstTimeCorpus: boolean;
  /** Absent means unknown, and unknown never bot-merges a first-time corpus. */
  readonly targetAdoption?: Adoption;
  readonly touchesCodeowners: boolean;
  /** The diff touches a `fixes[].apply` payload. */
  readonly touchesApply: boolean;
  readonly docsWordingOnly: boolean;
  readonly ownerApproved: boolean;
  readonly coreApproved: boolean;
}

export interface MergePolicy {
  readonly botMergeEligible: boolean;
  readonly requiresCoreReview: boolean;
  /** Owner approval is not enough; a core reviewer has to look. */
  readonly elevatedReview: boolean;
  readonly reasons: readonly string[];
}

/**
 * Whether the merge bot may land this PR.
 *
 * `dangerousApply` comes from the danger lint: a corpus can be entirely
 * truthful about a real destructive operation and still not be something a bot
 * lands, which is why it raises review rather than failing the gate.
 */
/** Why a human has to look, in the order the ladder considers it. */
function reviewReasons(
  facts: PullRequestFacts,
  ciGreen: boolean,
  dangerousApply: boolean,
): readonly string[] {
  const reasons: string[] = [];
  if (facts.touchesCodeowners) {
    reasons.push('the diff changes CODEOWNERS, which always requires core approval');
  }
  if (facts.firstTimeCorpus && facts.targetAdoption !== 'ordinary') {
    reasons.push(
      facts.targetAdoption === 'high'
        ? 'a first-time corpus for a high-adoption package requires core review, never a bot merge'
        : 'a first-time corpus whose adoption CI could not determine is treated as high adoption',
    );
  }
  if (facts.touchesApply) {
    reasons.push('the diff touches fixes[].apply, which gets elevated review');
  }
  if (dangerousApply) {
    reasons.push('the danger lint found a destructive apply, which gets elevated review');
  }
  if (!ciGreen) reasons.push('CI is not green, and no approval substitutes for a passing gate');
  if (!facts.ownerApproved) reasons.push('the corpus owner has not approved this PR');
  return reasons;
}

export function mergePolicy(
  facts: PullRequestFacts | undefined,
  ciGreen: boolean,
  dangerousApply: boolean,
): MergePolicy {
  if (facts === undefined) {
    return Object.freeze({
      botMergeEligible: false,
      requiresCoreReview: true,
      elevatedReview: true,
      reasons: Object.freeze([
        'CI supplied no facts about this PR, so nothing about it is known; an unread PR is never bot-merged',
      ]),
    });
  }
  const reasons = [...reviewReasons(facts, ciGreen, dangerousApply)];

  // A CODEOWNERS change decides who may approve every future PR for a
  // package, so it is the one rule that does not even wait for CI.
  const requiresCoreReview =
    facts.touchesCodeowners || (facts.firstTimeCorpus && facts.targetAdoption !== 'ordinary');
  const elevatedReview = facts.touchesApply || dangerousApply;
  const botMergeEligible =
    ciGreen &&
    facts.ownerApproved &&
    !requiresCoreReview &&
    (!elevatedReview || facts.coreApproved);
  if (elevatedReview && !facts.coreApproved) {
    reasons.push('elevated review is unsatisfied: no core approval on this PR');
  }
  return Object.freeze({
    botMergeEligible,
    requiresCoreReview,
    elevatedReview,
    reasons: Object.freeze(reasons),
  });
}
