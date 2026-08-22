// Corpus Generator [17]: the five-file corpus AUTHORING format, version 1.
//
// This is the human-edited source a corpus is written in. It is NOT the packed
// runtime artifact Docs Engine [13] loads (`packed: 1`); `pack.ts` compiles
// this into that. The two are deliberately different formats because this one
// has to carry three things the runtime format has no slot for, by design:
//
//   1. stubs. Every field a scan cannot fill is marked `status: stub`, and the
//      runtime loader refuses a topic with an empty summary. A stub-bearing
//      artifact is therefore not loadable by construction, which is correct:
//      an unfinished corpus must not be shippable.
//   2. twins and fixes, with the throw-site fingerprints a scan pre-fills.
//   3. field ownership, which is what makes "a re-scan never touches a
//      human-owned field" implementable at all.
//
// The five files, under the corpus root (default `<target>/comprehendo/`):
//
//   manifest.json   provider identity, the scanned target, the package.json
//                   manifest hint a provider pastes into its own manifest
//   index.json      the topic menu, in menu order; order is human-curated,
//                   membership is machine-derived
//   topics/<n>.md   one file per topic: YAML header plus the summary prose,
//                   with worked examples under a `## Examples` heading
//   twins.json      one skeleton per throw site found in the target
//   fixes.json      fixes, keyed by twin id, entirely human-owned
//
// OWNERSHIP, the one rule everything else follows: machine-owned fields are
// regenerated wholesale on every scan; human-owned fields are written only
// while they are still stubs, and never again, even when the underlying code
// changed. That drift is what `diff` reports rather than silently applying.
//
// Both formats are version-gated (`corpus_authoring`, `packed`) so Corpus
// Format [28] (Wave 5) can supersede either without a loader having to guess.

import { COMPREHENDO_VERSION } from '../docs.js';

export { COMPREHENDO_VERSION };

/** The authoring format version. Bumped when a reader could misread an old file. */
export const AUTHORING_FORMAT = 1;

/** The value every unfillable field carries. Greppable on purpose. */
export const STUB = 'status: stub';

/** True when a field still carries what a scan could not know. */
export const isStub = (value: string): boolean => value === STUB;

export type RecordStatus = 'stub' | 'draft' | 'ready';

export type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum';

export interface Translation {
  readonly known_tool: string;
  readonly terms: readonly string[];
}

export interface VocabulariesServed {
  readonly own_terms: readonly string[];
  readonly translations: readonly Translation[];
  readonly task: readonly string[];
}

export interface TopicExample {
  readonly title: string;
  readonly code: string;
}

/**
 * One authored topic. `kind`, `source` and `signatures` are machine-owned;
 * `summary`, `see_also`, `examples` and `vocabularies_served` are human-owned
 * (seeded once from the target's docstrings and export names, then never
 * touched again). `status` and `stub_fields` are derived, never hand-kept.
 */
export interface TopicRecord {
  readonly topic: string;
  readonly kind: SymbolKind;
  readonly source: string;
  readonly signatures: readonly string[];
  readonly summary: string;
  readonly see_also: readonly string[];
  readonly examples: readonly TopicExample[];
  readonly vocabularies_served: VocabulariesServed;
  readonly status: RecordStatus;
  readonly orphaned: boolean;
}

/** What a scan can know about a throw site, and what only a human can. */
export interface TwinFingerprint {
  readonly exception: string;
  readonly message_pattern: string;
  readonly source: string;
  readonly raised_by: string;
}

export interface TwinRecord {
  /** Stable machine identity, line numbers deliberately excluded. */
  readonly id: string;
  /** The provider's published error code. Human-owned: a code cannot change meaning. */
  readonly code: string;
  /** One sentence saying why. Human-owned, and the folklore rule's raw material. */
  readonly reason: string;
  readonly fingerprint: TwinFingerprint;
  /** The corpus topic that explains this failure's territory. Machine-derived. */
  readonly docs: string;
  readonly status: RecordStatus;
  readonly orphaned: boolean;
}

export interface FixRecord {
  readonly title: string;
  readonly docs?: string;
  readonly apply?: unknown;
  readonly confidence?: 'high' | 'likely' | 'guess';
  readonly status: RecordStatus;
}

export interface TargetRecord {
  readonly package: string;
  readonly version: string;
  readonly source: string;
}

export interface AuthoringCorpus {
  readonly provider: string;
  readonly target: TargetRecord;
  readonly manifest_hint: { readonly comprehendo: { readonly version: string; readonly level: number } };
  /** Menu order. Order is human-curated; membership is machine-derived. */
  readonly topics: readonly TopicRecord[];
  readonly twins: readonly TwinRecord[];
  readonly fixes: Readonly<Record<string, readonly FixRecord[]>>;
}

/** One unfilled field, addressable enough for an author to go and write it. */
export interface StubRef {
  readonly file: string;
  readonly record: string;
  readonly field: string;
}

/**
 * The publish-required fields, the only ones stub-tracked. Optional-by-schema
 * fields (see_also, examples, translations, task) are absences, not stubs:
 * marking them would make every corpus permanently unfinished and drain the
 * word "stub" of the meaning the Submission Gate [29] needs from it.
 */
export const topicStubFields = (topic: TopicRecord): string[] =>
  isStub(topic.summary) ? ['summary'] : [];

export const twinStubFields = (twin: TwinRecord): string[] =>
  [isStub(twin.code) ? 'code' : '', isStub(twin.reason) ? 'reason' : ''].filter(
    (field) => field !== '',
  );

export const fixStubFields = (fix: FixRecord): string[] => (isStub(fix.title) ? ['title'] : []);

/**
 * Status is derived from the stub set, with one carve-out: a human who marked
 * a record `ready` keeps that mark until a stub actually reappears. `draft`
 * means machine-complete and human-unreviewed.
 */
export function statusOf(stubs: readonly string[], previous?: RecordStatus): RecordStatus {
  if (stubs.length > 0) return 'stub';
  return previous === 'ready' ? 'ready' : 'draft';
}

/** Every unfilled field in the corpus, in the order an author would meet them. */
export function collectStubs(corpus: AuthoringCorpus): StubRef[] {
  const refs: StubRef[] = [];
  for (const topic of corpus.topics) {
    for (const field of topicStubFields(topic)) {
      refs.push({ file: `topics/${topicFileName(topic.topic)}`, record: topic.topic, field });
    }
  }
  for (const twin of corpus.twins) {
    for (const field of twinStubFields(twin)) {
      refs.push({ file: 'twins.json', record: twin.id, field });
    }
  }
  for (const [id, fixes] of Object.entries(corpus.fixes)) {
    fixes.forEach((fix, position) => {
      for (const field of fixStubFields(fix)) {
        refs.push({ file: 'fixes.json', record: `${id}[${position}]`, field });
      }
    });
  }
  return refs;
}

/**
 * A topic name is whatever the corpus author wants to call it, so the file name
 * is a slug of it, not the name itself. Collisions are not this layer's problem:
 * a scan seeds one topic per exported symbol, and those names are unique.
 */
export function topicFileName(topic: string): string {
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug === '' ? 'topic' : slug}.md`;
}

export const corpusHeader = (provider: string): Record<string, string | number> => ({
  comprehendo: COMPREHENDO_VERSION,
  corpus_authoring: AUTHORING_FORMAT,
  provider,
});
