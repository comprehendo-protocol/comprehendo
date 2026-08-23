// Scoped Publisher [31]: the decision to publish a corpus as
// `@comprehendo/<pkg>`, and the payload that decision assembles.
//
// WHAT THIS FILE IS, AND WHAT IT IS NOT. The doc describes a publish that
// happens from CI on merged main in `comprehendo-protocol/registry`, which is
// not this repository. The same split Submission Gate [29] drew applies here:
// what lives in THAT repo is the workflow line that holds the token and runs
// the actual publish; what lives here is the decision that workflow has to ask
// first, and the payload it would publish. Nothing in this file transmits
// anything, opens a socket, spawns a process, or signs anything. The feature
// doc's Known Issues records exactly where that line falls, rather than
// leaving it implied.
//
// NOTHING PUBLISHES BY DEFAULT. `publishDecision` hands back a record only
// when every one of these holds, and hands back every reason it did not
// otherwise (see `publish-refusal.ts`, which owns the refusals):
//
//   1. The gate run really passed, INCLUDING the two checks that only exist
//      when 29's `verifyAgainstUpstream` really ran. This feature's
//      `satisfies_contracts` entry is that rule, and it is enforced by reading
//      the check outcomes, not the `publishable` flag beside them.
//   2. The gate run is about THIS corpus, not some other green run.
//   3. The trigger is the merge, on the publish branch, at a real commit sha.
//   4. The corpus still packs through 28's REAL `pack`, which validates first.
//
// THERE IS NO HUMAN-INVOKABLE PATH, and that is a property of the ARGUMENTS
// rather than a runtime check this module could make: the only way to obtain a
// `GateResult` is to have really run the gate over a really installed package,
// and a library function cannot ask who called it. The other half of the rule,
// "only CI holds a publish token", is credentials and workflow configuration
// in the registry repo, and is recorded as such in the feature doc.

import {
  CORPUS_ARTIFACT,
  CorpusFormatError,
  corpusDescriptor,
  pack,
  serializeCorpus,
} from './corpus-format.js';
import type { CorpusDescriptor, CorpusSource, PackedCorpus } from './corpus-format.js';
import type { GateResult } from './gate.js';
import { artifactHash, attestationOf } from './publish-provenance.js';
import type { ProvenanceAttestation } from './publish-provenance.js';
import { bindingRefusals, gateRefusals, refusal, triggerRefusals } from './publish-refusal.js';
import type { PublishRefusal, PublishTrigger } from './publish-refusal.js';

export {
  PUBLISH_EVENT,
  PUBLISH_REF,
  UPSTREAM_CHECKS,
  bindingRefusals,
  gateRefusals,
  triggerRefusals,
} from './publish-refusal.js';
export type {
  PublishRefusal,
  PublishRefusalReason,
  PublishTrigger,
} from './publish-refusal.js';
export { artifactHash, attestationOf } from './publish-provenance.js';
export type { AttestedGateRun, ProvenanceAttestation } from './publish-provenance.js';

/** The npm scope every registry corpus is published under. */
export const PUBLISH_SCOPE = '@comprehendo';

export interface PublishRequest {
  readonly corpus: CorpusSource;
  /**
   * The result of really running 29's `runSubmissionGate`. There is no other
   * way into this function, deliberately: a publish argument list that does
   * not include a gate run cannot be assembled at all.
   */
  readonly gateResult: GateResult;
  /** The scoped package's OWN version, which CI reads off the corpus package. */
  readonly version: string;
  readonly trigger: PublishTrigger;
}

/** The one file a corpus package ships, and its exact bytes. */
export interface PublishArtifact {
  readonly filename: string;
  readonly contents: string;
}

/** The package.json the scoped corpus package publishes with. */
export interface PublishManifest {
  readonly name: string;
  readonly version: string;
  readonly files: readonly string[];
  /**
   * 28's `CORPUS_DESCRIPTOR_KEY`, spelled literally because a computed key is
   * not a type. `publish.test.ts` asserts the two agree, the same treatment
   * every other framework-imposed duplication in this repo gets.
   */
  readonly comprehendoCorpus: CorpusDescriptor;
}

/** The doc's Data Model, plus the payload the record is a record OF. */
export interface PublishRecord {
  readonly package: string;
  readonly version: string;
  readonly packedArtifactHash: string;
  readonly gateResult: GateResult;
  readonly provenanceAttestation: ProvenanceAttestation;
  readonly artifact: PublishArtifact;
  readonly descriptor: CorpusDescriptor;
  readonly manifest: PublishManifest;
}

export interface PublishRefused {
  readonly permitted: false;
  readonly refusals: readonly PublishRefusal[];
}

export interface PublishPermitted {
  readonly permitted: true;
  readonly record: PublishRecord;
}

export type PublishDecision = PublishRefused | PublishPermitted;

const refused = (refusals: readonly PublishRefusal[]): PublishRefused =>
  Object.freeze({ permitted: false, refusals: Object.freeze([...refusals]) });

/**
 * The scoped package a target publishes under.
 *
 * A scoped target cannot be spelled `@comprehendo/@acme/widgets`, so its scope
 * is flattened into the name. The truth stays readable either way: the
 * descriptor's `target` carries the real package name, and that is the field
 * core's `router-discovery.ts` reads FIRST, precisely for this case.
 */
export const corpusPackageName = (target: string): string =>
  `${PUBLISH_SCOPE}/${target.replace(/^@/, '').replace(/\//g, '__')}`;

/** The whole payload, assembled from the corpus that just passed the gate. */
function recordOf(request: PublishRequest, packed: PackedCorpus): PublishRecord {
  const name = corpusPackageName(packed.package);
  const contents = serializeCorpus(packed);
  const hash = artifactHash(contents);
  const descriptor = corpusDescriptor(packed);
  return Object.freeze({
    package: name,
    version: request.version,
    packedArtifactHash: hash,
    gateResult: request.gateResult,
    provenanceAttestation: attestationOf({
      package: name,
      version: request.version,
      target: packed.package,
      artifactHash: hash,
      trigger: request.trigger,
      gateResult: request.gateResult,
    }),
    artifact: Object.freeze({ filename: CORPUS_ARTIFACT, contents }),
    descriptor: Object.freeze({ ...descriptor }),
    manifest: Object.freeze({
      name,
      version: request.version,
      files: Object.freeze([CORPUS_ARTIFACT]),
      comprehendoCorpus: Object.freeze({ ...descriptor }),
    }),
  });
}

/**
 * Whether this corpus may be published, and the payload if it may.
 *
 * Never throws: a refusal is data, so CI reports every reason at once instead
 * of one per re-run, exactly as 29 reports its findings.
 */
export function publishDecision(request: PublishRequest): PublishDecision {
  const refusals = [
    ...gateRefusals(request.gateResult),
    ...bindingRefusals(request.corpus, request.gateResult),
    ...triggerRefusals(request.trigger, request.version),
  ];
  if (refusals.length > 0) return refused(refusals);

  let packed: PackedCorpus;
  try {
    packed = pack(request.corpus);
  } catch (error) {
    if (!(error instanceof CorpusFormatError)) throw error;
    return refused([
      refusal(
        'unpackable-corpus',
        `this corpus does not pack, so there are no bytes to publish: ${error.message}`,
      ),
    ]);
  }
  return Object.freeze({ permitted: true, record: recordOf(request, packed) });
}
