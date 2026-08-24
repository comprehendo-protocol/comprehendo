// Corpus Discovery CLI [NN]: `comprehendo add <pkg>`, the consumer-side verb
// none of this project's other four verbs are (`init`/`scan`/`diff`/`pack`
// all work on a corpus AUTHOR's own target, never touch the network, and
// stay inside @comprehendo/core where CC6 No Telemetry [27] requires zero
// network code). This is the one place a consumer or an agent asks, on
// their own explicit invocation, "is there a comprehendo corpus for the
// package I'm holding" and gets it installed if so.
//
// Off by default, one shot, nothing silent: this never runs unless someone
// typed `comprehendo add`, checks exactly one registry entry, and only
// mutates the consumer's own project (a real `npm install`) when `--install`
// was passed explicitly. The reserved `comprehendo.json` remote-refresh
// layer's own security fence (MDs/comprehendo-spec.md SS9.1: "off by
// default... explicitly opt-in... fetches carry nothing outbound except the
// corpus version") is the template this verb follows, for the same reason:
// the one thing worse than no network capability is a quiet one.

import { corpusPackageName } from '../../registry-tools/dist/publish.js';

import { installCorpusPackage, type Installer } from './installer.js';
import { lookupCorpusPackage, type Fetcher, type RegistryLookup } from './registry-lookup.js';

export interface AddOptions {
  /** The TARGET package a corpus would be FOR, e.g. `zod` or `@modelcontextprotocol/sdk`. */
  readonly target: string;
  /** Actually run `npm install --save-dev` once the corpus is confirmed to exist. */
  readonly install: boolean;
  readonly json: boolean;
  readonly write: (line: string) => void;
}

export interface AddDeps {
  readonly fetcher: Fetcher;
  readonly installer: Installer;
  readonly cwd: string;
}

export interface AddResult {
  readonly target: string;
  /** The flattened `@comprehendo/<...>` name Scoped Publisher [31] would have published this corpus under. */
  readonly corpus: string;
  readonly lookup: RegistryLookup;
  readonly installed?: { readonly ok: boolean; readonly detail: string };
}

/**
 * `found` with no `--install`: 0, the check itself is the whole job asked
 * for. `found` with `--install` that failed: 2, an operational problem the
 * caller can retry (network, npm itself). `not-found`: 1, mirroring `diff`'s
 * own convention that an expected, non-error "nothing here" answer is not
 * success but is not a crash either. `error` (the registry itself could not
 * be reached or answered oddly): 2, same bucket as an install failure, both
 * are "try again", neither is "no corpus exists".
 */
function exitCodeFor(result: AddResult): number {
  if (result.lookup.outcome === 'not-found') return 1;
  if (result.lookup.outcome === 'error') return 2;
  if (result.installed !== undefined && !result.installed.ok) return 2;
  return 0;
}

function report(options: AddOptions, result: AddResult): void {
  const lookup = result.lookup;
  if (lookup.outcome === 'found') {
    options.write(`found ${lookup.name}@${lookup.version}`);
    if (result.installed === undefined) {
      options.write(`next: npm install --save-dev ${lookup.name}`);
    } else if (result.installed.ok) {
      options.write(result.installed.detail);
    } else {
      options.write(`install failed: ${result.installed.detail}`);
    }
    return;
  }
  if (lookup.outcome === 'not-found') {
    options.write(`no comprehendo corpus published for ${result.target} (checked ${lookup.name})`);
    // Doc 40's own known_issues already flags the most-wanted list's real
    // GitHub target as 404ing today; pointing there is honest about intent,
    // not a claim the demand-signal loop is wired up yet.
    options.write('nothing published yet: https://comprehendo.dev/most-wanted tracks demand for one');
    return;
  }
  options.write(`comprehendo: could not check the registry for ${lookup.name}: ${lookup.detail}`);
}

/** The whole verb: one real registry lookup, one optional real install, never more than asked. */
export async function runAdd(options: AddOptions, deps: AddDeps): Promise<number> {
  const corpus = corpusPackageName(options.target);
  const lookup = await lookupCorpusPackage(corpus, deps.fetcher);
  const installed =
    lookup.outcome === 'found' && options.install
      ? installCorpusPackage(lookup.name, deps.cwd, deps.installer)
      : undefined;
  const result: AddResult = {
    target: options.target,
    corpus,
    lookup,
    ...(installed === undefined ? {} : { installed }),
  };
  if (options.json) {
    options.write(JSON.stringify(result, null, 2));
  } else {
    report(options, result);
  }
  return exitCodeFor(result);
}
