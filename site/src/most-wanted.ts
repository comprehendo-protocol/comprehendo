// Registry Website [40]: the most-wanted list, ranked.
//
// WHERE DEMAND COMES FROM, AND WHERE IT NEVER COMES FROM. The ranking is
// reaction counts on explicit issues somebody opened on purpose, and nothing
// else. CC6 [27] forbids telemetry outright, so there is no miss-log
// aggregation, no query collection and no visitor counting anywhere in this
// feature: the only input is public data a person deliberately published by
// clicking a thumb on a public issue tracker.
//
// A pull request is not a request: it is a submission, and it goes through
// Submission Gate [29]. A closed issue is not open demand. Both are dropped
// here rather than in the fetch, so the rule is testable without a network.

/** One issue as this site reads it, projected from the GitHub issues payload. */
export interface IssueRecord {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: string;
  readonly upvotes: number;
  readonly totalReactions: number;
  readonly isPullRequest: boolean;
  readonly labels: readonly string[];
}

/** One request on the rendered list. */
export interface CorpusRequest {
  readonly rank: number;
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly upvotes: number;
  readonly totalReactions: number;
}

/**
 * What the site has to render.
 *
 * `unavailable` is a third outcome on purpose, for the reason Submission Gate
 * [29] gives `not-run` one: an issue tracker that could not be read is not an
 * empty demand list, and collapsing the two would let a 404 render as "nobody
 * has asked for anything".
 */
export type MostWantedList =
  | {
      readonly kind: 'ok';
      readonly repository: string;
      readonly requests: readonly CorpusRequest[];
    }
  | { readonly kind: 'unavailable'; readonly repository: string; readonly reason: string };

/**
 * The ranking: most reacted-to first, oldest issue first among equals.
 *
 * Pure and total. A request nobody has reacted to is kept and ranked last,
 * because zero is a real reading of demand and dropping it would quietly
 * rewrite the list into "requests that have already caught on".
 */
export function rankRequests(issues: readonly IssueRecord[]): readonly CorpusRequest[] {
  const open = issues.filter((issue) => !issue.isPullRequest && issue.state === 'open');
  const ordered = [...open].sort(
    (left, right) =>
      right.upvotes - left.upvotes ||
      right.totalReactions - left.totalReactions ||
      left.number - right.number,
  );
  return Object.freeze(
    ordered.map((issue, at) =>
      Object.freeze({
        rank: at + 1,
        number: issue.number,
        title: issue.title,
        url: issue.url,
        upvotes: issue.upvotes,
        totalReactions: issue.totalReactions,
      }),
    ),
  );
}
