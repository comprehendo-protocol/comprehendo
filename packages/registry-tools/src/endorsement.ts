// RED-GATE STUB, replaced in the implement phase.

import type { CorpusSource } from './corpus-format.js';
import type { GateResult } from './gate.js';
import type { ManifestSnapshot } from './endorsement-manifest.js';

export const TRUST_LADDER = Object.freeze(['community', 'endorsed', 'native'] as const);

export type TrustStatus = (typeof TRUST_LADDER)[number];

export type EndorsedBy = 'sha256-match' | 'owner-approval';

export interface EndorsementInput {
  readonly gate: GateResult;
  readonly directory: string;
  readonly corpus: CorpusSource;
  readonly manifest: ManifestSnapshot;
  readonly approvers?: readonly string[];
}

export interface EndorsementRecord {
  readonly package: string;
  readonly corpusVersion: string;
  readonly status: TrustStatus;
  readonly endorsedBy?: EndorsedBy;
  readonly manifestSnapshot: ManifestSnapshot;
  readonly digest?: string;
  readonly reasons: readonly string[];
}

export function computeEndorsement(_input: EndorsementInput): EndorsementRecord {
  throw new Error('MDD skeleton');
}
