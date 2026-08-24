// Corpus Discovery CLI [NN]: `comprehendo docs <pkg> [query]`, the one-shot
// reference lookup a consumer or an agent runs against whatever is ALREADY
// installed under `node_modules/@comprehendo/`. No network anywhere in this
// module (that boundary belongs to `registry-lookup.ts`/`add.ts` alone,
// which is why `add` and `docs` are two separate verbs, not one): this
// reads the local corpus tree exactly the way `discoverInstalledCorpora`
// (Router & Precedence [22]) already does for the runtime router, wires it
// through `createRouter`, and prints the real `docs(pkg, query)` answer.
//
// The whole reason this verb exists rather than "write a two-line script
// that imports comprehendo": an agent about to guess at an unfamiliar or
// fast-moving package's API needs the check to cost less than the guess, or
// it will not make the check. One command, no script to author, is the
// entire point.

import { buildFingerprintIndex } from '../../registry-tools/dist/fingerprint.js';
import { createRouter, discoverInstalledCorpora } from '../../core/dist/index.js';
import type { DocsResponse } from '../../core/dist/index.js';

export interface DocsVerbOptions {
  /** The package the agent is holding, e.g. `zod` or `@modelcontextprotocol/sdk`. */
  readonly target: string;
  /** A specific question; omitted asks for the topic index. */
  readonly query?: string;
  readonly json: boolean;
  readonly write: (line: string) => void;
}

export interface DocsVerbDeps {
  /** The consuming project root: the directory whose `node_modules` is read. */
  readonly root: string;
}

/**
 * `DocsIndex`/`DocsTopic` carry no discriminant field of their own (only
 * `Undocumented` does, `code: 'UNDOCUMENTED'`), so the three response
 * shapes are told apart the same structural way `docs.ts`'s own callers do,
 * by which fields are actually present, never by a `.code` check that
 * would not type-narrow correctly against the other two.
 */
const isUndocumented = (response: DocsResponse): response is Extract<DocsResponse, { code: 'UNDOCUMENTED' }> =>
  'code' in response && response.code === 'UNDOCUMENTED';

const isIndex = (response: DocsResponse): response is Extract<DocsResponse, { topics: readonly string[] }> =>
  'topics' in response;

/**
 * A real answer (index or topic) existed, 0. `Undocumented`: no installed
 * corpus answered (never installed for this package, or this specific
 * query has no matching topic), 1, mirroring `add`'s own found/not-found
 * convention, so a script chaining `comprehendo docs` can branch on the
 * exit code the same way it already can for `add`.
 */
const exitCodeFor = (response: DocsResponse): 0 | 1 => (isUndocumented(response) ? 1 : 0);

function renderText(target: string, response: DocsResponse, write: (line: string) => void): void {
  if (isUndocumented(response)) {
    write(`no installed comprehendo corpus answers this for ${target}${response.query === '' ? '' : ` ("${response.query}")`}`);
    if (response.nearest.length > 0) {
      write(`nearest topics: ${response.nearest.join(', ')}`);
    }
    write(`try: comprehendo add ${target} --install`);
    return;
  }
  if (isIndex(response)) {
    write(`${target}: ${String(response.topics.length)} topic(s)`);
    for (const topic of response.topics) write(`  ${topic}`);
    return;
  }
  write(`${target} :: ${response.topic}`);
  write(response.summary);
  for (const example of response.examples ?? []) {
    write('');
    write(`### ${example.title}`);
    write(example.code);
  }
}

/** The whole verb: real local discovery, real router, one real answer. */
export function runDocs(options: DocsVerbOptions, deps: DocsVerbDeps): number {
  const environment = discoverInstalledCorpora({ root: deps.root, buildIndex: buildFingerprintIndex });
  const router = createRouter(environment);
  const response = router.docs(options.target, options.query);

  if (options.json) {
    options.write(JSON.stringify({ target: options.target, query: options.query ?? null, response }));
  } else {
    renderText(options.target, response, options.write);
  }
  return exitCodeFor(response);
}
