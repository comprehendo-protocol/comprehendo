// Registry Website [40]: what the site is allowed to SAY about a corpus.
//
// THE CONTRACT THIS FILE SATISFIES, AND HOW. Submission Gate [29] declares
// `verifyAgainstUpstream` a mandatory integration contract: nothing may be
// marked publishable without it. A website induces nothing and publishes
// nothing, so it never calls that function; what it does instead is make a
// PUBLIC TRUST CLAIM about a corpus somebody else's CI judged, and that claim
// is where the contract bites. Rendering "published, endorsed" beside a corpus
// nobody ever ran against the real package would launder an unverified corpus
// into a badge on comprehendo.dev, which is exactly the threat CC11 [25] names.
//
// So the contract is satisfied TRANSITIVELY, in the same shape Owner
// Endorsement [30] satisfies it: no rung above `community` and no published
// badge is reachable unless the gate ruling being rendered really carries
// `registryTruth` and `folklore` as `pass`. Those are read off the check
// outcomes DIRECTLY, never off the `publishable` summary flag beside them, and
// the constant naming them is Scoped Publisher [31]'s own `UPSTREAM_CHECKS`
// rather than a second copy of the list. A ruling that claims `pass: true`
// beside an unverified corpus buys nothing here.
//
// AND THE TIER IS READ, NEVER DECIDED. Where a verified corpus stands on the
// ladder is `computeEndorsement`'s answer, over the manifest CI really read,
// through Owner Endorsement [30]'s real function. This file contains no
// second opinion about what "endorsed" means and no default that is not
// "community".

import { snapshotOf } from '../../packages/registry-tools/dist/endorsement-manifest.js';
import { computeEndorsement } from '../../packages/registry-tools/dist/endorsement.js';
import { UPSTREAM_CHECKS } from '../../packages/registry-tools/dist/publish.js';
import type { CorpusSource, PackedCorpus } from '../../packages/registry-tools/dist/corpus-format.js';
import type { ManifestSnapshot } from '../../packages/registry-tools/dist/endorsement-manifest.js';
import type { TrustStatus } from '../../packages/registry-tools/dist/endorsement.js';
import type { GateResult } from '../../packages/registry-tools/dist/gate.js';

export type { TrustStatus };

/** What the registry's CI recorded about one corpus directory. */
export interface RegistryRuling {
  readonly gate: GateResult;
  /** The TARGET package's live manifest, exactly as CI read it. */
  readonly manifest?: unknown;
  readonly approvers?: readonly string[];
}

export interface RegistryEntryInput {
  readonly directory: string;
  readonly corpus: CorpusSource;
  readonly packed: PackedCorpus;
  readonly ruling?: RegistryRuling;
}

/** One row of the registry the site renders. */
export interface CorpusListing {
  readonly directory: string;
  readonly package: string;
  readonly provider: string;
  readonly targetVersion: string;
  readonly topics: readonly string[];
  readonly twinCount: number;
  readonly fixCount: number;
  readonly trust: TrustStatus;
  readonly published: boolean;
  readonly verifiedAgainstUpstream: boolean;
  readonly manifestSnapshot: ManifestSnapshot;
  /** Why this row says what it says, one line each, rendered on the page. */
  readonly reasons: readonly string[];
}

/**
 * Everything [29] did NOT settle about this corpus, named check by check.
 * Empty means `verifyAgainstUpstream` really ran and really passed.
 */
function upstreamRefusals(gate: GateResult): readonly string[] {
  const unverified = UPSTREAM_CHECKS.filter((check) => gate.checks[check] !== 'pass');
  if (unverified.length === 0) return Object.freeze([]);
  return Object.freeze([
    `the submission gate reports ${unverified
      .map((check) => `${check} as "${gate.checks[check]}"`)
      .join(' and ')}, so verifyAgainstUpstream did not confirm this corpus against the ` +
      'really-installed package; it is listed as an unpublished community corpus and nothing more',
  ]);
}

const fixCountOf = (corpus: CorpusSource): number =>
  Object.values(corpus.fixes).reduce((total, fixes) => total + fixes.length, 0);

const rowOf = (
  entry: RegistryEntryInput,
  trust: TrustStatus,
  published: boolean,
  verified: boolean,
  manifestSnapshot: ManifestSnapshot,
  reasons: readonly string[],
): CorpusListing =>
  Object.freeze({
    directory: entry.directory,
    package: entry.corpus.package,
    provider: entry.corpus.provider,
    targetVersion: entry.corpus.version,
    topics: Object.freeze(entry.corpus.topics.map((topic) => topic.topic)),
    twinCount: entry.corpus.twins.length,
    fixCount: fixCountOf(entry.corpus),
    trust,
    published,
    verifiedAgainstUpstream: verified,
    manifestSnapshot,
    reasons: Object.freeze([...reasons]),
  });

/**
 * One registry row, and everything the site is allowed to claim in it.
 *
 * Pure, and never throws: this runs inside a generator over data a CI job on
 * another repository produced, and a site build that dies on an odd ruling is
 * a registry nobody can read.
 */
export function listingOf(entry: RegistryEntryInput): CorpusListing {
  const snapshot = snapshotOf(entry.directory, entry.ruling?.manifest ?? null);

  if (entry.ruling === undefined) {
    return rowOf(entry, 'community', false, false, snapshot, [
      'no submission-gate ruling accompanies this corpus, so nothing about it has been verified ' +
        'against the really-installed package and it is listed as an unpublished community corpus',
    ]);
  }

  const { gate } = entry.ruling;
  const refusals = upstreamRefusals(gate);
  if (refusals.length > 0) return rowOf(entry, 'community', false, false, snapshot, refusals);

  if (!gate.pass) {
    return rowOf(entry, 'community', false, true, snapshot, [
      'the submission gate did not pass this corpus, so it is listed at the community tier and ' +
        'is not published',
    ]);
  }

  const record = computeEndorsement({
    gate,
    directory: entry.directory,
    corpus: entry.corpus,
    manifest: snapshot,
    ...(entry.ruling.approvers === undefined ? {} : { approvers: entry.ruling.approvers }),
  });

  return rowOf(entry, record.status, gate.publishable, true, snapshot, record.reasons);
}

/** The whole registry, in a page order that is not disk order. */
export function registryListing(
  entries: readonly RegistryEntryInput[],
): readonly CorpusListing[] {
  return Object.freeze(
    [...entries]
      .sort((left, right) => left.directory.localeCompare(right.directory))
      .map(listingOf),
  );
}
