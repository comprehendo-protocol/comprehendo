// Owner Endorsement [30]: `comprehendo: { owners: ["github:name"] }`, the
// delegation half.
//
// The pin couples endorsement to a release: every corpus update needs a
// republish to move it. Delegation is the owner's other option, and it costs
// one declaration for good: the people named in the live manifest have their
// approvals on a corpus PR counted as owner review from then on, with no
// package release per corpus update. Only a real publish credential can put a
// name in that list, which is the attack this tier deletes.
//
// WHAT IS HERE AND WHAT IS NOT. This is the decision, whole: given the
// identities the manifest declares and the identities that really approved the
// PR, is a named delegate among them. Where the approver list comes FROM is a
// GitHub API call belonging to the registry repo's CI job, on the far side of
// the boundary [29] already drew (this repository is not
// `comprehendo-protocol/registry`, and a workflow committed here would never
// fire). `githubApprovers` is that boundary's one adapter, and it does the
// only thing that can be done honestly without the API: qualify a login into
// the scheme the manifest spells.
//
// EVERY RULE FAILS CLOSED, the same way `gate-policy.ts`'s ladder does. An
// identity that cannot be read is never read as a permissive one, and an
// identity with no scheme cannot be read: "octocat" names a login on some
// provider, and which provider is exactly the question. The cost of failing
// closed is an owner rewriting one manifest line; the cost of failing open is
// a stranger's approval counting as the owner's.

/** The one identity scheme the manifest form in the doc spells. */
export const GITHUB_SCHEME = 'github';

export interface DelegationInput {
  /** The identities the LIVE manifest declares. Absent means no delegation. */
  readonly owners: readonly string[] | undefined;
  /** The identities that really approved the corpus PR, scheme-qualified. */
  readonly approvers: readonly string[] | undefined;
}

export interface Delegation {
  readonly approved: boolean;
  /** Which declared identity approved, when one did. */
  readonly delegate?: string;
  /** Why it landed where it did, one line each, PR-comment ready. */
  readonly reasons: readonly string[];
}

/**
 * An identity, comparable. A scheme is required: the provider is half the
 * identity, and a login on its own is a name, not a person. Case is folded
 * because the identity providers this addresses fold it themselves.
 */
const identity = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.indexOf(':');
  if (at <= 0 || at === trimmed.length - 1) return undefined;
  return trimmed;
};

const delegation = (
  approved: boolean,
  reasons: readonly string[],
  delegate?: string,
): Delegation =>
  Object.freeze({
    approved,
    ...(delegate === undefined ? {} : { delegate }),
    reasons: Object.freeze([...reasons]),
  });

/**
 * Qualify bare GitHub logins into the form the manifest declares, leaving an
 * already-qualified identity alone. This is what a CI job does with the logins
 * the reviews API hands it; it is deliberately the ONLY thing this component
 * does with a bare login, because guessing a scheme is the failure this whole
 * module is shaped to avoid.
 */
export const githubApprovers = (logins: readonly string[]): readonly string[] =>
  Object.freeze(
    logins.map((login) =>
      login.includes(':') ? login : `${GITHUB_SCHEME}:${login}`,
    ),
  );

/**
 * Is a delegate the owner named among the people who really approved this PR?
 *
 * Returns the declared identity as the manifest spelled it, not the approver's
 * spelling, so the record names the thing the owner actually wrote.
 */
export function approvingDelegate(input: DelegationInput): Delegation {
  const declared = input.owners ?? [];
  if (declared.length === 0) {
    return delegation(false, [
      'the live manifest declares no "comprehendo.owners", so no approval on this PR counts as owner review',
    ]);
  }
  const reasons: string[] = [];
  const named = new Map<string, string>();
  for (const owner of declared) {
    const read = identity(owner);
    if (read === undefined) {
      reasons.push(
        `the declared owner "${String(owner)}" carries no identity scheme (for example "${GITHUB_SCHEME}:name"), so it names nobody`,
      );
      continue;
    }
    named.set(read, typeof owner === 'string' ? owner : read);
  }
  const approvers = input.approvers ?? [];
  if (approvers.length === 0) {
    reasons.push('nobody approved this PR, so there is no approval to read as owner review');
    return delegation(false, reasons);
  }
  for (const approver of approvers) {
    const read = identity(approver);
    if (read === undefined) {
      reasons.push(
        `the approver "${String(approver)}" carries no identity scheme, so it cannot be matched to a declared owner`,
      );
      continue;
    }
    const owner = named.get(read);
    if (owner !== undefined) {
      return delegation(
        true,
        [`${owner} is named in the live manifest's "comprehendo.owners" and approved this PR`],
        owner,
      );
    }
  }
  reasons.push(
    'nobody who approved this PR is named in the live manifest\'s "comprehendo.owners"',
  );
  return delegation(false, reasons);
}
