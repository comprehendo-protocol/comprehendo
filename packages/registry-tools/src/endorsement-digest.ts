// Owner Endorsement [30]: the sha256 pin, and what it is a hash OF.
//
// `comprehendo: { corpus: "<sha256>" }` is the owner's strongest claim, so the
// hash under it is a real sha256 from `node:crypto` and nothing weaker. The
// suite checks the primitive against two digests the world already publishes
// (the empty string, and the literal "comprehendo"), because a hash function
// that only ever agrees with itself proves nothing about being sha256.
//
// WHAT GETS HASHED, and why it is not the source tree. The pin names a corpus
// RELEASE, and the release is Corpus Format [28]'s packed artifact: one
// deterministic string, versioned, atomic, and the exact bytes a consumer's
// runtime loads. The five-file authoring tree is the wrong subject on three
// counts. It carries authoring-only state (`status: draft`) that never ships;
// it has no canonical byte form, so hashing it would mean inventing a
// directory-walk and line-ending convention here, a second format nobody
// declared; and an owner cannot inspect what they are pinning without cloning
// the registry repo, whereas the artifact is what they can download. 28
// already made the guarantee this needs, in one line: equal corpora, equal
// bytes. See JUDGMENT-30-owner-endorsement.md, call 2.
//
// `node:crypto` is a Node builtin with no network reach and is not on CC6
// [27]'s forbidden list (`gate-telemetry.ts`, NETWORK_MODULES); hashing is the
// one thing this component adds to that surface, and it stays local.

import { createHash } from 'node:crypto';

import { CorpusFormatError, pack, serializeCorpus } from './corpus-format.js';
import type { CorpusSource, PackedCorpus } from './corpus-format.js';

/** A sha256 digest, rendered the one way this component compares them. */
export const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The prefix an owner may write in front of the digest, and which is optional. */
const SHA256_PREFIX = 'sha256:';

/**
 * What hashing a submission found. A corpus that does not pack has no digest
 * and says why, because a thrown error here would make an unendorsable corpus
 * indistinguishable from a crash in the endorsement step.
 */
export interface DigestReading {
  readonly digest?: string;
  readonly problem?: string;
}

/** What the owner's declared pin turned out to be, or why it could not be read. */
export interface PinReading {
  readonly hex?: string;
  readonly problem?: string;
}

/** sha256 over UTF-8 bytes, hex. The primitive, checkable against known values. */
export const sha256Hex = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** The digest of a packed corpus: the artifact's own serialized bytes, hashed. */
export const packedDigest = (packed: PackedCorpus): string => sha256Hex(serializeCorpus(packed));

/**
 * The digest of a submitted corpus source tree, by way of the artifact it
 * packs into. `pack` validates first (28's own rule, not a calling
 * convention), so a corpus carrying violations reports the reason rather than
 * hashing a half-formed artifact into a number that would look authoritative.
 */
export function corpusDigest(corpus: CorpusSource): DigestReading {
  try {
    return Object.freeze({ digest: packedDigest(pack(corpus)) });
  } catch (error) {
    if (!(error instanceof CorpusFormatError)) throw error;
    return Object.freeze({
      problem:
        `this corpus carries ${String(error.violations.length)} violation(s), so it packs into no ` +
        'artifact and there is no content for a pin to match',
    });
  }
}

/**
 * Read what the live manifest declared under `comprehendo.corpus`.
 *
 * Anything that is not a sha256 is REPORTED and endorses nothing. That is not
 * pedantry about formatting: the conformance kit's forward-compat fixture
 * shows the same key carrying a corpus PACKAGE NAME, which names content
 * without fixing it, and reading a name as a match would hand out endorsement
 * for whatever that name resolves to today. Case is folded because a hex
 * digest is the same digest either way; nothing else is.
 */
export function readPin(declared: unknown): PinReading {
  if (typeof declared !== 'string') {
    return Object.freeze({
      problem: `the "comprehendo.corpus" pin must be a sha256 string, got ${typeof declared}`,
    });
  }
  const trimmed = declared.trim();
  const bare = trimmed.toLowerCase().startsWith(SHA256_PREFIX)
    ? trimmed.slice(SHA256_PREFIX.length)
    : trimmed;
  const hex = bare.toLowerCase();
  if (!SHA256_HEX.test(hex)) {
    return Object.freeze({
      problem: `the "comprehendo.corpus" pin "${trimmed}" is not a sha256 digest, so it pins no content`,
    });
  }
  return Object.freeze({ hex });
}
