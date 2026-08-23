// Registry Website [40]: the real GitHub issues read, at BUILD time.
//
// WHERE THIS SITS RELATIVE TO CC6 [27]. The no-telemetry contract is about what
// crosses the wire on behalf of a USER: nothing does, in either tier, and the
// site this module feeds ships no script, so a visitor's browser contacts
// nobody. What happens here is a generator on a build machine reading a public
// issue tracker over HTTPS, which is why this file lives in `site/` and not in
// `packages/`: CC6's structural scan covers `packages/core/src` and
// `packages/registry-tools/src`, and neither of them may ever import a network
// module. Nothing in this directory is imported by either package.
//
// NOTHING IS TRUSTED AND NOTHING THROWS. The repository name is checked against
// a fixed pattern and then path-encoded, never interpolated into a pattern. The
// response is projected field by field, and an entry missing a field the list
// needs is dropped by name rather than guessed at. Every failure, including a
// repository that does not exist, comes back as the `unavailable` list, because
// a build that dies on somebody else's outage is a site that cannot be rebuilt.

import { rankRequests } from './most-wanted.ts';
import type { IssueRecord, MostWantedList } from './most-wanted.ts';

/** `owner/name`, the only shape this module will put in a URL path. */
const REPOSITORY = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

const API = 'https://api.github.com';

export interface GithubIssuesQuery {
  /** `owner/name`. Never interpolated into a pattern, only into a path. */
  readonly repository: string;
  /** Only issues carrying this label count as explicit corpus requests. */
  readonly label?: string;
  /** Optional credential, read from the environment by the caller. */
  readonly token?: string;
  /** The real `fetch` by default; a caller may hand in another one. */
  readonly fetchImpl?: typeof fetch;
  readonly userAgent?: string;
  readonly perPage?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The one URL this module ever asks for. */
export function issuesUrl(query: GithubIssuesQuery): string {
  if (!REPOSITORY.test(query.repository)) {
    throw new Error(
      `"${query.repository}" is not a repository: the most-wanted source is spelled owner/name`,
    );
  }
  const [owner = '', name = ''] = query.repository.split('/');
  const search = new URLSearchParams({
    state: 'open',
    per_page: String(query.perPage ?? 100),
    sort: 'created',
    direction: 'asc',
  });
  if (query.label !== undefined && query.label !== '') search.set('labels', query.label);
  return `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues?${search.toString()}`;
}

const labelsOf = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return Object.freeze([]);
  const names = value.flatMap((label) => {
    if (typeof label === 'string') return [label];
    if (isRecord(label) && typeof label['name'] === 'string') return [label['name']];
    return [];
  });
  return Object.freeze(names);
};

const countOf = (reactions: unknown, key: string): number => {
  if (!isRecord(reactions)) return 0;
  const count = reactions[key];
  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
};

/**
 * The issues payload, projected to what the list needs.
 *
 * Pure, so the projection is testable without a network and so the live suite
 * can run this exact function over bytes GitHub really sent.
 */
export function issueRecordsOf(payload: unknown): readonly IssueRecord[] {
  if (!Array.isArray(payload)) return Object.freeze([]);
  const records = payload.flatMap((entry): IssueRecord[] => {
    if (!isRecord(entry)) return [];
    const number = entry['number'];
    const title = entry['title'];
    const url = entry['html_url'];
    if (typeof number !== 'number' || !Number.isInteger(number)) return [];
    if (typeof title !== 'string' || typeof url !== 'string') return [];
    return [
      Object.freeze({
        number,
        title,
        url,
        state: typeof entry['state'] === 'string' ? entry['state'] : 'open',
        upvotes: countOf(entry['reactions'], '+1'),
        totalReactions: countOf(entry['reactions'], 'total_count'),
        isPullRequest: 'pull_request' in entry,
        labels: labelsOf(entry['labels']),
      }),
    ];
  });
  return Object.freeze(records);
}

const unavailable = (repository: string, reason: string): MostWantedList =>
  Object.freeze({ kind: 'unavailable' as const, repository, reason });

/** What a response that is not a list of issues says about itself. */
function refusalOf(response: Response, repository: string): MostWantedList {
  if (response.status === 404) {
    return unavailable(
      repository,
      `GitHub answered 404 Not Found for ${repository}: no such repository, or its issues are not public`,
    );
  }
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
    return unavailable(
      repository,
      `GitHub rate-limited this build (403, x-ratelimit-remaining 0) before it could read ${repository}`,
    );
  }
  return unavailable(repository, `GitHub answered ${String(response.status)} ${response.statusText} for ${repository}`);
}

/**
 * The most-wanted list, read live.
 *
 * Never throws: every failure is the `unavailable` list carrying the reason,
 * which the page then states out loud. A build that could not read the tracker
 * says so on the page rather than rendering an empty list that reads as "nobody
 * wants anything".
 */
export async function fetchCorpusRequests(query: GithubIssuesQuery): Promise<MostWantedList> {
  let url: string;
  try {
    url = issuesUrl(query);
  } catch (error) {
    return unavailable(query.repository, error instanceof Error ? error.message : String(error));
  }

  const call = query.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': query.userAgent ?? 'comprehendo-site',
  };
  if (query.token !== undefined && query.token !== '') {
    headers['authorization'] = `Bearer ${query.token}`;
  }

  let response: Response;
  try {
    response = await call(url, { headers, redirect: 'follow' });
  } catch (error) {
    return unavailable(
      query.repository,
      `the issue tracker could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) return refusalOf(response, query.repository);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return unavailable(
      query.repository,
      `GitHub answered ${String(response.status)} with something that is not JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return Object.freeze({
    kind: 'ok' as const,
    repository: query.repository,
    requests: rankRequests(issueRecordsOf(payload)),
  });
}
