// Submission Gate [29]: the fingerprint lint.
//
// Fingerprint Index & Matcher [21] already refuses to build an index carrying a
// collision, naming the packages, and its doc records that this gate is the CI
// wrapper around that refusal. So this module compiles nothing of its own: it
// hands 21's REAL `buildFingerprintIndex` every corpus in the PR plus every
// corpus already on main, as ONE index, the same way Router & Precedence [22]
// combines installed corpora at runtime. One index is the point. Per-corpus
// indexes are individually clean by construction, and the failure they cannot
// see is exactly the one that matters: a fingerprint two corpora both claim,
// which at runtime is an ambiguity the router answers UNSTRUCTURED to.
//
// `fingerprintsOf` duplicates the one mapping Corpus Format [28] makes inside
// `pack` (a twin's PUBLISHED CODE is the `corpusEntryId`, never 17's authoring
// id), because `pack` refuses a corpus that does not validate and a collision
// has to stay visible in a corpus that fails some unrelated rule. The duplicate
// is held by an agreement test asserting it equals `pack().fingerprints` for a
// real corpus, the same treatment this package gives every other duplicated
// shape.

import type { CorpusSource } from './corpus-source.js';
import {
  FingerprintCollisionError,
  FingerprintIndexError,
  buildFingerprintIndex,
  buildStaticPatternIndex,
} from './fingerprint.js';
import type { FingerprintIndex } from './fingerprint.js';
import type { FingerprintEntry } from './fingerprint-facets.js';
import { finding, type GateFinding, type SubmissionCorpus } from './gate-result.js';

/** One corpus's throw sites as compiled fingerprint entries. */
export function fingerprintsOf(corpus: CorpusSource): readonly FingerprintEntry[] {
  return Object.freeze(
    corpus.twins.map((twin) => {
      const facets = twin.fingerprint;
      return Object.freeze({
        package: corpus.package,
        ...(facets.errorClass === undefined ? {} : { errorClass: facets.errorClass }),
        ...(facets.messagePattern === undefined ? {} : { messagePattern: facets.messagePattern }),
        ...(facets.stackShape === undefined ? {} : { stackShape: Object.freeze([...facets.stackShape]) }),
        corpusEntryId: twin.code,
        ...(facets.kind === undefined ? {} : { kind: facets.kind }),
      });
    }),
  );
}

/** Which submitted corpus a package name belongs to, for attributing a finding. */
const ownersOf = (
  corpora: readonly SubmissionCorpus[],
  packages: readonly string[],
): readonly string[] => {
  const owned = corpora
    .filter((submission) => packages.includes(submission.source.package))
    .map((submission) => submission.directory);
  return owned.length === 0 ? corpora.map((submission) => submission.directory) : owned;
};

/**
 * The two indices the whole registry compiles to (one per `FingerprintKind`,
 * `fingerprint.ts`'s own `buildIndexOfKind` split), or every reason either
 * does not build. `published` carries the corpora already on main, so a PR
 * colliding with a corpus it never touched is caught in the PR rather than
 * at publish time. A `runtime-error` fingerprint and a `static-pattern`
 * fingerprint sharing literal text is never itself a finding here, they are
 * checked in separate indices by construction (see `buildIndexOfKind`'s own
 * doc); this lint's job is catching a collision WITHIN one kind, across
 * corpora.
 */
export function fingerprintFindings(
  corpora: readonly SubmissionCorpus[],
  published: readonly SubmissionCorpus[] = [],
): readonly GateFinding[] {
  const found: GateFinding[] = [];
  try {
    buildIndex(corpora, published);
  } catch (error) {
    found.push(...explain(error, corpora));
  }
  try {
    buildStaticPatternIndexAcross(corpora, published);
  } catch (error) {
    found.push(...explain(error, corpora));
  }
  return Object.freeze(found);
}

/** The compiled runtime-error index, for a submission that passed the lint. */
export function buildIndex(
  corpora: readonly SubmissionCorpus[],
  published: readonly SubmissionCorpus[] = [],
): FingerprintIndex {
  return buildFingerprintIndex(
    [...corpora, ...published].flatMap((submission) => [...fingerprintsOf(submission.source)]),
  );
}

/** The compiled static-pattern index, for a submission that passed the lint. */
export function buildStaticPatternIndexAcross(
  corpora: readonly SubmissionCorpus[],
  published: readonly SubmissionCorpus[] = [],
): FingerprintIndex {
  return buildStaticPatternIndex(
    [...corpora, ...published].flatMap((submission) => [...fingerprintsOf(submission.source)]),
  );
}

function explain(error: unknown, corpora: readonly SubmissionCorpus[]): GateFinding[] {
  if (error instanceof FingerprintCollisionError) {
    return error.collisions.flatMap((collision) =>
      ownersOf(corpora, collision.packages).map((directory) =>
        finding(
          'fingerprintLint',
          directory,
          collision.fingerprint,
          `${collision.entries.join(' and ')} (package${collision.packages.length > 1 ? 's' : ''} ${collision.packages.join(', ')}) declare the same fingerprint; the registry index never picks one`,
        ),
      ),
    );
  }
  if (error instanceof FingerprintIndexError) {
    return error.defects.map((defect) =>
      finding(
        'fingerprintLint',
        ownersOf(corpora, [defect.at.split('#')[0] ?? ''])[0] ?? '',
        defect.at,
        defect.detail,
      ),
    );
  }
  throw error;
}
