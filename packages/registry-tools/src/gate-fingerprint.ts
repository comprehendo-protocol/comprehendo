// RED-GATE STUB, replaced in the implement phase.

import type { CorpusSource } from './corpus-source.js';
import type { FingerprintEntry } from './fingerprint-facets.js';
import type { GateFinding, SubmissionCorpus } from './gate-result.js';

export function fingerprintsOf(_corpus: CorpusSource): readonly FingerprintEntry[] {
  throw new Error('MDD skeleton');
}

export function fingerprintFindings(
  _corpora: readonly SubmissionCorpus[],
): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}
