// RED-GATE STUB, replaced in the implement phase.

import type { CorpusSource, PackedCorpus } from './corpus-format.js';

export const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface DigestReading {
  readonly digest?: string;
  readonly problem?: string;
}

export interface PinReading {
  readonly hex?: string;
  readonly problem?: string;
}

export function sha256Hex(_text: string): string {
  throw new Error('MDD skeleton');
}

export function packedDigest(_packed: PackedCorpus): string {
  throw new Error('MDD skeleton');
}

export function corpusDigest(_corpus: CorpusSource): DigestReading {
  throw new Error('MDD skeleton');
}

export function readPin(_declared: unknown): PinReading {
  throw new Error('MDD skeleton');
}
