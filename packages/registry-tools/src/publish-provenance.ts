// Scoped Publisher [31]: what produced these exact bytes.
//
// WHAT THIS RECORD HONESTLY IS. It ties the exact artifact bytes (by sha256 of
// what Corpus Format [28]'s `serializeCorpus` produced) to the exact merged
// commit and the exact gate run that permitted them. Every field is something
// this process really computed or was really told by the runner, and the hash
// is over the bytes actually being published, not over a re-derivation of them.
//
// WHAT IT IS NOT. It is not a signature. No SLSA provenance statement is
// signed, no sigstore certificate is issued, and no npm `--provenance`
// attestation is produced, because all three need a real CI OIDC identity and
// a real registry, neither of which exists in this repository (the same
// boundary Submission Gate [29] drew for its own CI job). The record says that
// itself, in the `signed` field, rather than leaving a reader to assume the
// stronger claim. When the registry repo's workflow gains a real identity, the
// signed statement is built AROUND this record; it does not replace it.

import { createHash } from 'node:crypto';

import { CORPUS_ARTIFACT } from './corpus-format.js';
import type { CheckOutcome, GateCheck } from './gate-result.js';
import type { GateResult } from './gate.js';
import type { PublishTrigger } from './publish-refusal.js';

/** The gate run that permitted a publish, as the attestation carries it. */
export interface AttestedGateRun {
  readonly prId: string;
  readonly checks: Readonly<Record<GateCheck, CheckOutcome>>;
  readonly pass: boolean;
  readonly publishable: boolean;
}

export interface ProvenanceAttestation {
  /** This record's own format version. */
  readonly attestation: number;
  readonly package: string;
  readonly version: string;
  /** The package the corpus is FOR, which is not the package it ships as. */
  readonly target: string;
  readonly artifact: string;
  readonly artifactHash: string;
  readonly repository: string;
  readonly ref: string;
  readonly commit: string;
  readonly mergedAt: string;
  readonly runId?: string;
  readonly gate: AttestedGateRun;
  /**
   * Always false, and a field rather than a silence: this record is data about
   * an artifact, not a cryptographic attestation of it. See this file's header.
   */
  readonly signed: false;
}

export interface AttestationInput {
  /** The scoped package name the artifact publishes as. */
  readonly package: string;
  readonly version: string;
  /** The target package the corpus is FOR. */
  readonly target: string;
  readonly artifactHash: string;
  readonly trigger: PublishTrigger;
  readonly gateResult: GateResult;
}

/** The artifact bytes, hashed. A real digest over the real published bytes. */
export const artifactHash = (contents: string): string =>
  `sha256:${createHash('sha256').update(contents, 'utf8').digest('hex')}`;

/** The record of what produced these bytes, frozen with them. */
export function attestationOf(input: AttestationInput): ProvenanceAttestation {
  const { trigger, gateResult } = input;
  return Object.freeze({
    attestation: 1,
    package: input.package,
    version: input.version,
    target: input.target,
    artifact: CORPUS_ARTIFACT,
    artifactHash: input.artifactHash,
    repository: trigger.repository,
    ref: trigger.ref,
    commit: trigger.commit,
    mergedAt: trigger.mergedAt,
    ...(trigger.runId === undefined ? {} : { runId: trigger.runId }),
    gate: Object.freeze({
      prId: gateResult.prId,
      checks: gateResult.checks,
      pass: gateResult.pass,
      publishable: gateResult.publishable,
    }),
    signed: false,
  });
}
