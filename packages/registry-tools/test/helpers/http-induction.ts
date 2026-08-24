// Generalized from `process-induction.ts`'s own doc comment: ffmpeg spawns a
// CLI binary and reads stderr; openai-python spawns a script and reads
// stderr; `@modelcontextprotocol/sdk`'s OAuth authorization-server router
// (corpora/mcp-oauth) is neither, its real failures are HTTP responses from
// a real, in-process server. Same evidence standard, third real shape: the
// real target, running for real, matched through Fingerprint Index &
// Matcher [21]'s REAL index built from the corpus's own twins.json.
//
// Reuses `process-induction.ts`'s `VersionedCapture` shape rather than
// duplicating it: "the exit status a spawn really returned" and "the HTTP
// status a real response really carried" are the same idea, one integer a
// witness's own real run either matched or did not. Everything else here
// (an async request instead of a sync spawn, no argv/workspace/env-isolation
// concerns a real HTTP client does not have) is genuinely a different shape
// and is not force-fit into the process helper.

import { parse } from '../../src/corpus-format.js';
import type { CorpusSource } from '../../src/corpus-format.js';
import { fingerprintsOf } from '../../src/gate-fingerprint.js';
import { buildFingerprintIndex } from '../../src/fingerprint.js';
import type { FingerprintIndex } from '../../src/fingerprint.js';
import type { TruthFailure, UpstreamVerification } from '../../src/gate-upstream.js';
import { matchesRange } from '../../src/version-range.js';
import type { VersionedCapture } from './process-induction.js';

export type { VersionedCapture } from './process-induction.js';

/** The corpus, read by Corpus Format [28]'s REAL parser. Never a typed double. */
export const loadCorpus = (corpusDir: string): CorpusSource => parse(corpusDir);

/** The corpus's own compiled index, through Fingerprint Index & Matcher [21]'s REAL builder. */
export const indexOf = (corpus: CorpusSource): FingerprintIndex =>
  buildFingerprintIndex(fingerprintsOf(corpus));

/** What one real HTTP round trip really returned. */
export interface HttpResponse {
  readonly status: number;
  readonly text: string;
}

/** How one cataloged failure is really provoked against the real, running target. */
export interface HttpWitness {
  /** The twin `code` this run must produce, per the corpus. */
  readonly code: string;
  /** One real HTTP round trip against the real server this corpus documents. */
  readonly request: (baseUrl: string) => Promise<HttpResponse>;
  /** Real captures, one per declared range this witness has been re-run against. */
  readonly captures: readonly VersionedCapture[];
}

/** The version-scoped capture for one witness against the target really installed. */
export function captureFor(witness: HttpWitness, installedVersion: string): VersionedCapture {
  const found = witness.captures.find((capture) => matchesRange(capture.versions, installedVersion));
  if (found === undefined) {
    const ranges = witness.captures.map((capture) => capture.versions).join(', ');
    throw new Error(
      `${installedVersion} matches none of ${witness.code}'s declared capture ranges (${ranges}); ` +
        'this witness has never been re-run against this major',
    );
  }
  return found;
}

export interface Induced {
  readonly code: string;
  readonly status: number;
  /** The status the real, version-scoped capture recorded, for the caller's own assertion. */
  readonly expectedStatus: number;
  readonly text: string;
  readonly outcome: string;
  readonly matched: string;
}

/** Induce one cataloged failure out of the real, running target and route its response. */
export async function induceOne(
  witness: HttpWitness,
  index: FingerprintIndex,
  baseUrl: string,
  installedVersion: string,
): Promise<Induced> {
  const capture = captureFor(witness, installedVersion);
  const response = await witness.request(baseUrl);
  const match = index.match(response.text);
  return {
    code: witness.code,
    status: response.status,
    expectedStatus: capture.status,
    text: response.text,
    outcome: match.outcome,
    matched: match.outcome === 'matched' ? match.entry.corpusEntryId : '',
  };
}

/** Why this run did not settle the entry, or `undefined` when it did. */
function routeInduction(
  code: string,
  status: number,
  text: string,
  expectedStatus: number,
  index: FingerprintIndex,
): TruthFailure | undefined {
  if (status !== expectedStatus) {
    return {
      kind: 'not-inducible',
      at: code,
      detail:
        `the witness for ${code} really returned HTTP ${String(status)}, ` +
        `the real capture for the installed target recorded ${String(expectedStatus)}`,
    };
  }
  const match = index.match(text);
  if (match.outcome !== 'matched') {
    return {
      kind: match.outcome === 'ambiguous' ? 'misrouted' : 'not-inducible',
      at: code,
      detail: `the response this witness really produced routed as ${match.outcome}`,
    };
  }
  if (match.entry.corpusEntryId !== code) {
    return {
      kind: 'misrouted',
      at: code,
      detail: `the failure this witness really provoked matches ${match.entry.corpusEntryId}`,
    };
  }
  return undefined;
}

/** The real, running target's version string (whatever the caller resolved it to). */
export type VersionProbe = () => string;

/**
 * Every claim this corpus makes, checked against the real, running target, as
 * the `UpstreamVerification` the gate reads. Same evidence standard as
 * `verifyAgainstUpstream` and `process-induction.ts#induceAll`: a twin whose
 * induction did not reproduce, or whose failure routed elsewhere, comes back
 * as a named failure, never a silent omission. No fix-retry loop here (the
 * process-shaped helper's own `ProcessFix` concept): every fix this corpus
 * declares is a runbook, not a resolving call, see corpora/mcp-oauth/README.md.
 */
export async function induceAll(
  corpus: CorpusSource,
  directory: string,
  witnesses: readonly HttpWitness[],
  baseUrl: string,
  version: VersionProbe,
): Promise<UpstreamVerification> {
  const index = indexOf(corpus);
  const installedVersion = version();
  const inducedCodes: string[] = [];
  const failures: TruthFailure[] = [];

  for (const twin of corpus.twins) {
    const witness = witnesses.find((entry) => entry.code === twin.code);
    if (witness === undefined) {
      failures.push({
        kind: 'unrunnable-witness',
        at: twin.code,
        detail: `no inducing invocation is supplied for ${twin.code}`,
      });
      continue;
    }
    const capture = captureFor(witness, installedVersion);
    const response = await witness.request(baseUrl);
    const routed = routeInduction(twin.code, response.status, response.text, capture.status, index);
    if (routed !== undefined) {
      failures.push(routed);
      continue;
    }
    inducedCodes.push(twin.code);
  }

  return Object.freeze({
    directory,
    package: corpus.package,
    resolved: Object.freeze({ name: directory, version: installedVersion }),
    inducedCodes: Object.freeze(inducedCodes),
    verifiedFixes: Object.freeze([]),
    failures: Object.freeze(failures),
  });
}
