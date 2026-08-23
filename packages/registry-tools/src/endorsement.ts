// Owner Endorsement [30]: the middle rung of the trust ladder, computed.
//
// A package owner who will not (yet) go native can still bless a community
// corpus, through the one channel only the true owner controls: their own
// published manifest. Two forms, the owner's choice, and this function is
// where either one becomes a value Config Loader [23]'s `require` knob can
// read. Endorsement is ADDITIVE TRUST, never a veto: nothing here can stop a
// corpus publishing, and the type says so, because there is no field a
// publisher could read as a refusal. A mismatch means unendorsed, and the
// community tier keeps evolving.
//
// EVERY RUNG ABOVE COMMUNITY RESTS ON [29]'s VERIFICATION. This component
// never calls `verifyAgainstUpstream` itself; it reads a gate result that
// already carries its outcome, and refuses every rung above `community`
// unless the gate really passed AND `registryTruth` really reads `pass`. That
// second check is not redundant with the first by accident of today's code:
// it is read directly off the check so that a caller handing this function a
// ruling with `pass: true` and an unverified corpus still buys nothing. That
// is [29]'s mandatory contract, satisfied transitively, by gating on an
// already-complete result rather than re-running the work; the test named
// "refuses endorsement when verifyAgainstUpstream never ran" is the proof.
//
// THE TOP RUNG IS READ, NEVER AWARDED. `native` is recorded when the live
// manifest carries Manifest Wiring [15]'s own declaration, because that is
// the package saying it speaks Comprehendo itself, in the same manifest and
// through the same credential. It is not something a corpus can earn.

import type { CorpusSource } from './corpus-format.js';
import { corpusDigest, readPin } from './endorsement-digest.js';
import { approvingDelegate } from './endorsement-owners.js';
import type { ManifestSnapshot } from './endorsement-manifest.js';
import type { GateResult } from './gate.js';

export type { ManifestSnapshot, NativeDeclaration } from './endorsement-manifest.js';

/**
 * The ladder, lowest rung first. The same three rungs Config Loader [23]'s
 * `TRUST_LEVELS` spells; core cannot be imported from here (the dependency
 * direction is one-way and the packages install independently), so a test
 * asserts the two agree rather than a comment promising it.
 */
export const TRUST_LADDER = Object.freeze(['community', 'endorsed', 'native'] as const);

export type TrustStatus = (typeof TRUST_LADDER)[number];

/** Which of the owner's two channels granted the endorsement. */
export type EndorsedBy = 'sha256-match' | 'owner-approval';

export interface EndorsementInput {
  /** [29]'s ruling on this PR. No rung above community is reachable without it. */
  readonly gate: GateResult;
  /** The registry directory, which exact-matches the target package name. */
  readonly directory: string;
  readonly corpus: CorpusSource;
  /** The TARGET package's live manifest, read by `readTargetManifest`. */
  readonly manifest: ManifestSnapshot;
  /** Who really approved the corpus PR, scheme-qualified identities. */
  readonly approvers?: readonly string[];
}

/**
 * Where a corpus release stands, and why. Carries no publishability field of
 * any kind: whether a corpus may publish is [29]'s ruling and this component
 * has no channel into it.
 */
export interface EndorsementRecord {
  readonly package: string;
  readonly corpusVersion: string;
  readonly status: TrustStatus;
  readonly endorsedBy?: EndorsedBy;
  readonly manifestSnapshot: ManifestSnapshot;
  /** The sha256 really computed over the submitted content, when it packs. */
  readonly digest?: string;
  /** Every reason this landed where it did, one line each, for the PR comment. */
  readonly reasons: readonly string[];
}

/** What the gate did NOT settle, if anything. Empty means the corpus is verified. */
function gateRefusals(gate: GateResult): readonly string[] {
  const refusals: string[] = [];
  if (gate.checks.registryTruth !== 'pass') {
    refusals.push(
      `the submission gate reports registryTruth as "${gate.checks.registryTruth}", so verifyAgainstUpstream ` +
        'did not confirm this corpus against the really-installed package and no rung above community is available',
    );
  }
  if (!gate.pass) {
    refusals.push(
      'the submission gate did not pass this PR, and endorsement is read on top of a passing gate, never instead of one',
    );
  }
  return refusals;
}

/** Does the live manifest actually belong to the package this corpus is FOR? */
function identityRefusals(input: EndorsementInput): readonly string[] {
  const { declaredName } = input.manifest;
  if (declaredName === undefined) {
    return [
      `no live manifest could be read for "${input.directory}", so nothing its owner may have declared has been seen`,
      ...input.manifest.problems,
    ];
  }
  if (declaredName !== input.directory) {
    return [
      `the manifest read for "${input.directory}" declares itself "${declaredName}"; an endorsement is only ever ` +
        'read out of the manifest of the package the corpus is FOR',
    ];
  }
  return [];
}

interface Granted {
  readonly by: EndorsedBy;
  readonly reason: string;
}

/** The pin: exact content, the owner's strongest and release-coupled claim. */
function pinGrant(
  declared: string,
  digest: string | undefined,
  reasons: string[],
): Granted | undefined {
  const pin = readPin(declared);
  if (pin.hex === undefined) {
    if (pin.problem !== undefined) reasons.push(pin.problem);
    return undefined;
  }
  if (digest === undefined) {
    reasons.push(
      `the live manifest pins ${pin.hex}, and the submitted corpus produced no artifact to compare it against`,
    );
    return undefined;
  }
  if (pin.hex !== digest) {
    reasons.push(
      `the live manifest pins ${pin.hex} and the submitted corpus content hashes to ${digest}; ` +
        'the corpus is unendorsed, which withholds nothing but the endorsement',
    );
    return undefined;
  }
  return {
    by: 'sha256-match',
    reason: `the live manifest pins ${pin.hex}, which is exactly the content submitted`,
  };
}

/** The delegation: a named delegate's approval, with no republish per update. */
function ownerGrant(input: EndorsementInput, reasons: string[]): Granted | undefined {
  const delegation = approvingDelegate({
    owners: input.manifest.owners,
    approvers: input.approvers,
  });
  if (!delegation.approved) {
    reasons.push(...delegation.reasons);
    return undefined;
  }
  return { by: 'owner-approval', reason: delegation.reasons[0] ?? 'a named delegate approved this PR' };
}

const record = (
  input: EndorsementInput,
  status: TrustStatus,
  reasons: readonly string[],
  digest: string | undefined,
  endorsedBy?: EndorsedBy,
): EndorsementRecord =>
  Object.freeze({
    package: input.corpus.package,
    corpusVersion: input.corpus.version,
    status,
    ...(endorsedBy === undefined ? {} : { endorsedBy }),
    manifestSnapshot: input.manifest,
    ...(digest === undefined ? {} : { digest }),
    reasons: Object.freeze([...reasons]),
  });

/**
 * Where this corpus release stands on the trust ladder.
 *
 * Pure, and never throws: a CI step that crashes on an odd manifest is a
 * submission channel that stops accepting corpora, and every input here comes
 * off a disk somebody else controls. The order is the doc's: the pin is the
 * stronger claim and is read first, delegation answers when the pin is absent
 * or stale, and neither is reachable at all until the gate has verified the
 * corpus against the real package.
 */
export function computeEndorsement(input: EndorsementInput): EndorsementRecord {
  const reading = corpusDigest(input.corpus);
  const digest = reading.digest;
  const reasons: string[] = reading.problem === undefined ? [] : [reading.problem];

  const refused = [...gateRefusals(input.gate), ...identityRefusals(input)];
  if (refused.length > 0) return record(input, 'community', [...reasons, ...refused], digest);

  if (input.manifest.native !== undefined) {
    return record(
      input,
      'native',
      [
        ...reasons,
        `the live manifest of "${input.directory}" declares Comprehendo ${input.manifest.native.version} ` +
          `at level ${String(input.manifest.native.level)}, so the package speaks it itself`,
      ],
      digest,
    );
  }

  const granted =
    (input.manifest.corpus === undefined
      ? undefined
      : pinGrant(input.manifest.corpus, digest, reasons)) ?? ownerGrant(input, reasons);

  if (granted === undefined) return record(input, 'community', reasons, digest);
  return record(input, 'endorsed', [granted.reason], digest, granted.by);
}
