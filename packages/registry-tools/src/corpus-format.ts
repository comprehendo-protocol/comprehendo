// Corpus Format [28]: the corpus file format, and the one artifact it compiles
// to. This module is the surface; `corpus-source.ts` reads, `corpus-validate.ts`
// judges, and both are re-exported here so a consumer imports one module.
//
// TWO FORMATS, ON PURPOSE, AND THIS FILE OWNS THE SECOND ONE
//
// The AUTHORING format (`corpus_authoring: 1`, Corpus Generator [17]) is five
// human-edited files: one topic per markdown file with a small YAML header,
// twins and fixes as JSON beside them. That shape exists for authoring and
// review, and it carries three things no runtime wants: stubs, field
// ownership, and one file per topic.
//
// The PUBLISHED format (`corpus_packed: 1`, defined here) is ONE file,
// `comprehendo.corpus.json`, read once and never walked. `pack` is the compile
// step between them, which is what lets authoring ergonomics and runtime cost
// be optimized separately instead of traded off against each other.
//
// THE RULING THIS COMPONENT OWES (Router & Precedence [22], Known Issues)
//
// 22 shipped a PROVISIONAL on-disk convention for an installed corpus package
// (three files: comprehendo.fingerprints.json, comprehendo.twins.json,
// comprehendo.packed.json, plus an optional `comprehendoCorpus.target` key)
// and recorded that this component owns the real one. The ruling:
//
//   1. ONE artifact, `comprehendo.corpus.json`, carrying all three halves.
//      The doc's Data Model says a single versioned artifact, and three files
//      is three chances for a corpus package to ship half-updated: a
//      fingerprint pointing at a twin code the catalog no longer carries
//      matches and then answers UNSTRUCTURED, which is the silent half-failure
//      an atomic artifact makes impossible.
//   2. `comprehendoCorpus` stays exactly the key 22 spelled, and `target`
//      stays exactly its meaning, so a corpus package still declares what it
//      is a corpus FOR in the one place 22 already looks. `format` and
//      `artifact` are added beside it, so a reader knows which format version
//      it is looking at BEFORE opening the file.
//   3. The docs half is verbatim Docs Engine [13]'s `packed: 1`. It is not
//      re-encoded, so 13's own `parsePackedCorpus` is the acceptance test for
//      it, and 13 needs no migration to read a published corpus's docs.
//
// The one thing this ruling does NOT do is migrate 22's reader, which lives in
// packages/core and is outside this feature's source_files. See the feature
// doc's Known Issues; the artifact is the contract, the reader is core's.
//
// FINGERPRINT BINDING, the load-bearing detail
//
// `router.ts` resolves a match with `builder.twinFor(entry.corpusEntryId)`, so
// a packed fingerprint's `corpusEntryId` is the twin's published CODE, never
// 17's authoring twin `id`. Getting that wrong does not throw: it matches and
// then hands back UNSTRUCTURED. `pack` binds them and a test asserts it.

import { parse, AUTHORING_FILES, AUTHORING_FORMAT, STUB } from './corpus-source.js';
import type {
  CorpusCallSchema,
  CorpusExample,
  CorpusFingerprint,
  CorpusFix,
  CorpusSource,
  CorpusTopic,
  CorpusTranslation,
  CorpusTwin,
  CorpusVocabularies,
} from './corpus-source.js';
import { validate } from './corpus-validate.js';
import { CorpusFormatError } from './corpus-violation.js';
import type { CorpusViolation } from './corpus-violation.js';
import { SPEC_VERSION } from './fingerprint.js';
import type { FingerprintEntry } from './fingerprint-facets.js';

export * from './corpus-source.js';
export * from './corpus-validate.js';
export { parseFrontMatter, FrontMatterError } from './corpus-front-matter.js';
export type { FrontMatter } from './corpus-front-matter.js';

/** The spec version stamped on every artifact. Copy of core's, drift-tested. */
export const COMPREHENDO_VERSION = SPEC_VERSION;

/** Docs Engine [13]'s packed-corpus format version. The docs half is verbatim it. */
export const PACKED_DOCS_FORMAT = 1;

/** This format's own version. A reader that does not know it refuses to guess. */
export const CORPUS_PACKED_FORMAT = 1;

/** The one file a published corpus package carries. Never a directory walk. */
export const CORPUS_ARTIFACT = 'comprehendo.corpus.json';

/** The package.json key a corpus package declares itself with (22's spelling). */
export const CORPUS_DESCRIPTOR_KEY = 'comprehendoCorpus';

/** One topic, exactly as Docs Engine [13] carries it. */
export interface PackedTopic {
  readonly topic: string;
  readonly summary: string;
  readonly signatures?: readonly string[];
  readonly examples?: readonly CorpusExample[];
  readonly see_also?: readonly string[];
  readonly vocabularies_served: CorpusVocabularies;
}

/** The docs half: Docs Engine [13]'s `packed: 1` artifact, unmodified. */
export interface PackedDocs {
  readonly comprehendo: string;
  readonly packed: number;
  readonly provider: string;
  readonly index: readonly string[];
  readonly topics: Readonly<Record<string, PackedTopic>>;
}

/** One cataloged failure, exactly as Twin Builder [12]'s `CatalogEntry`. */
export interface PackedCatalogEntry {
  readonly code: string;
  readonly reason: string;
  readonly fixes: readonly CorpusFix[];
}

/** The twins half: Twin Builder [12]'s `ProviderCatalog`, unmodified. */
export interface PackedCatalog {
  readonly declaredSchema: CorpusCallSchema;
  readonly topics: readonly string[];
  readonly entries: readonly PackedCatalogEntry[];
}

/** The single runtime artifact. Versioned, atomic, read once. */
export interface PackedCorpus {
  readonly comprehendo: string;
  readonly corpus_packed: number;
  /** The target package this corpus is FOR. */
  readonly package: string;
  readonly provider: string;
  /** The target version the corpus was authored against. */
  readonly version: string;
  readonly docs: PackedDocs;
  readonly twins: PackedCatalog;
  /** Fingerprint Index & Matcher [21]'s entries, compiled. */
  readonly fingerprints: readonly FingerprintEntry[];
}

/** What a corpus package puts in its package.json so a reader can route to it. */
export interface CorpusDescriptor {
  readonly target: string;
  readonly format: number;
  readonly artifact: string;
}

export { AUTHORING_FILES, AUTHORING_FORMAT, STUB, parse, validate };

const packedTopic = (topic: CorpusTopic): PackedTopic => ({
  topic: topic.topic,
  summary: topic.summary,
  ...(topic.signatures.length === 0 ? {} : { signatures: [...topic.signatures] }),
  ...(topic.examples.length === 0
    ? {}
    : { examples: topic.examples.map((example) => ({ ...example })) }),
  ...(topic.see_also.length === 0 ? {} : { see_also: [...topic.see_also] }),
  vocabularies_served: {
    own_terms: [...topic.vocabularies.own_terms],
    translations: topic.vocabularies.translations.map(
      (entry: CorpusTranslation): CorpusTranslation => ({
        known_tool: entry.known_tool,
        terms: [...entry.terms],
      }),
    ),
    task: [...topic.vocabularies.task],
  },
});

/**
 * The provider catalog a validated corpus describes, in Twin Builder [12]'s own
 * shape. Exported because it is the seam the two tiers meet at: a corpus this
 * component passes is a catalog core's `createTwinBuilder` accepts, and the
 * suite proves that by running core's real builder over this function's output.
 *
 * A corpus that declares no call schema gets an empty declared surface rather
 * than an invented one. That is not a loophole: `validate` has already refused
 * every `apply` such a corpus carries, so nothing reaches a builder unchecked.
 */
export function catalogOf(corpus: CorpusSource): PackedCatalog {
  return {
    declaredSchema: corpus.declaredSchema ?? { surface: corpus.package, operations: [] },
    topics: corpus.topics.map((topic) => topic.topic),
    entries: corpus.twins.map((twin) => ({
      code: twin.code,
      reason: twin.reason,
      fixes: (corpus.fixes[twin.id] ?? []).map((fix) => ({ ...fix })),
    })),
  };
}

/**
 * One throw site as a compiled fingerprint. `corpusEntryId` is the twin's
 * published CODE, because that is what the router hands back to the twin
 * builder; see this file's header.
 */
const packedFingerprint = (pkg: string, twin: CorpusTwin): FingerprintEntry => {
  const facets: CorpusFingerprint = twin.fingerprint;
  return {
    package: pkg,
    ...(facets.errorClass === undefined ? {} : { errorClass: facets.errorClass }),
    ...(facets.messagePattern === undefined ? {} : { messagePattern: facets.messagePattern }),
    ...(facets.stackShape === undefined ? {} : { stackShape: [...facets.stackShape] }),
    corpusEntryId: twin.code,
    ...(facets.kind === undefined ? {} : { kind: facets.kind }),
  };
};

/**
 * Compile a validated corpus into the single runtime artifact.
 *
 * `validate` runs FIRST, here, rather than by convention at the call site: a
 * corpus that fails validation is never packed, and making that a calling
 * convention would mean exactly one forgetful caller ships an unchecked corpus.
 * Orphaned topics are kept, the same call 17's `pack` makes: a corpus documents
 * concepts, and an export disappearing does not un-write the prose about it.
 */
export function pack(corpus: CorpusSource): PackedCorpus {
  const violations = validate(corpus);
  if (violations.length > 0) {
    throw new CorpusFormatError(
      `the corpus for ${corpus.package} carries ${String(violations.length)} violation(s) and is never packed:`,
      violations,
    );
  }
  return readPackedCorpus({
    comprehendo: COMPREHENDO_VERSION,
    corpus_packed: CORPUS_PACKED_FORMAT,
    package: corpus.package,
    provider: corpus.provider,
    version: corpus.version,
    docs: {
      comprehendo: COMPREHENDO_VERSION,
      packed: PACKED_DOCS_FORMAT,
      provider: corpus.provider,
      index: corpus.topics.map((topic) => topic.topic),
      topics: Object.fromEntries(corpus.topics.map((topic) => [topic.topic, packedTopic(topic)])),
    },
    twins: catalogOf(corpus),
    fingerprints: corpus.twins.map((twin) => packedFingerprint(corpus.package, twin)),
  });
}

/** The package.json block a published corpus declares itself with. */
export const corpusDescriptor = (packed: PackedCorpus): CorpusDescriptor => ({
  target: packed.package,
  format: packed.corpus_packed,
  artifact: CORPUS_ARTIFACT,
});

/** The artifact as one deterministic string: equal corpora, equal bytes. */
export const serializeCorpus = (packed: PackedCorpus): string =>
  `${JSON.stringify(packed, null, 2)}\n`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The docs half, held to the same rules Docs Engine [13]'s own loader applies. */
function readDocs(value: unknown): PackedDocs {
  if (!isRecord(value) || typeof value['packed'] !== 'number') {
    throw new TypeError('a packed corpus must carry a "docs" half declaring its packed version');
  }
  if (value['packed'] !== PACKED_DOCS_FORMAT) {
    throw new RangeError(
      `unsupported packed docs format version ${String(value['packed'])}; ` +
        `this build reads version ${String(PACKED_DOCS_FORMAT)}`,
    );
  }
  const index = value['index'];
  const topics = value['topics'];
  if (!Array.isArray(index) || !isRecord(topics)) {
    throw new TypeError('the docs half must carry an "index" array and a "topics" map');
  }
  for (const name of index) {
    if (topics[String(name)] === undefined) {
      throw new TypeError(`the packed index advertises "${String(name)}", which the artifact does not carry`);
    }
  }
  const advertised = new Set(index.map((name: unknown) => String(name)));
  for (const name of Object.keys(topics)) {
    if (!advertised.has(name)) {
      throw new TypeError(`the packed artifact carries "${name}", which its index never advertises`);
    }
  }
  return value as unknown as PackedDocs;
}

/**
 * Read an artifact, refusing anything this build cannot read WITHOUT guessing.
 *
 * A version this build does not understand raises naming both versions, rather
 * than reading the fields it recognises and quietly dropping the rest: a lossy
 * read of a corpus is a corpus that answers half its questions and never says
 * so, which is worse than no corpus at all.
 */
export function readPackedCorpus(raw: unknown): PackedCorpus {
  if (!isRecord(raw) || typeof raw['corpus_packed'] !== 'number') {
    throw new TypeError('a packed corpus must declare its "corpus_packed" format version');
  }
  if (raw['corpus_packed'] !== CORPUS_PACKED_FORMAT) {
    throw new RangeError(
      `unsupported packed corpus format version ${String(raw['corpus_packed'])}; ` +
        `this build reads version ${String(CORPUS_PACKED_FORMAT)}`,
    );
  }
  if (typeof raw['package'] !== 'string' || typeof raw['provider'] !== 'string') {
    throw new TypeError('a packed corpus must declare "package" and "provider"');
  }
  const twins = raw['twins'];
  if (!isRecord(twins) || !Array.isArray(twins['entries'])) {
    throw new TypeError('a packed corpus must carry a "twins" catalog with an entries array');
  }
  if (!Array.isArray(raw['fingerprints'])) {
    throw new TypeError('a packed corpus must carry a "fingerprints" array, even an empty one');
  }
  readDocs(raw['docs']);
  return raw as unknown as PackedCorpus;
}

export type {
  CorpusCallSchema,
  CorpusExample,
  CorpusFingerprint,
  CorpusFix,
  CorpusSource,
  CorpusTopic,
  CorpusTranslation,
  CorpusTwin,
  CorpusViolation,
  CorpusVocabularies,
};
