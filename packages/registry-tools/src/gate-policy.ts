// RED-GATE STUB, replaced in the implement phase.

export type Adoption = 'high' | 'ordinary';

/** What CI knows about the PR itself, as opposed to the corpus content. */
export interface PullRequestFacts {
  readonly firstTimeCorpus: boolean;
  /** Absent means unknown, and unknown never bot-merges a first-time corpus. */
  readonly targetAdoption?: Adoption;
  readonly touchesCodeowners: boolean;
  readonly touchesApply: boolean;
  readonly docsWordingOnly: boolean;
  readonly ownerApproved: boolean;
  readonly coreApproved: boolean;
}

export interface MergePolicy {
  readonly botMergeEligible: boolean;
  readonly requiresCoreReview: boolean;
  readonly elevatedReview: boolean;
  readonly reasons: readonly string[];
}

export function mergePolicy(
  _facts: PullRequestFacts | undefined,
  _ciGreen: boolean,
  _dangerousApply: boolean,
): MergePolicy {
  throw new Error('MDD skeleton');
}
