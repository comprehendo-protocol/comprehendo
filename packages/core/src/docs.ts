// Docs Engine [13]: the `docs(query?)` surface.
//
// PACKED-CORPUS ARTIFACT, format version 1. Defined here because this engine
// is the runtime that reads it; Corpus Generator [17] writes it, and Corpus
// Format [28] (Wave 5) may later add an encoding behind the same `packed`
// version number, which exists so a loader can refuse what it cannot read.
// The full shape, with an example, is in the feature doc's Implementation
// Notes; in short, one JSON file carrying
//   comprehendo, packed, provider, index (topic names in menu order), and
//   topics (one entry per index name: the topic.schema.json fields plus a
//   vocabularies_served block with own_terms, translations, task).
//
// The whole corpus is one file, read once. `vocabularies_served` is authoring
// data: it is what the matcher indexes and it never appears in a response, so
// a topic answer stays inside its CC5 [02] budget.
//
// Only two things are touched outside this module: the artifact is read, and
// every lookup is appended to a local file. Nothing in this engine can reach a
// network (CC6 [27]); docs-miss-log.test.ts asserts that structurally, over
// this module AND its one import, because a transitive import is exactly what
// would defeat the guarantee.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { buildAliases, matchTopics, suggest, type Alias } from './docs-vocabulary.js';

export const COMPREHENDO_VERSION = '0.1';
export const PACKED_CORPUS_FORMAT = 1;
export const DEFAULT_LOG_PATH = '.comprehendo/docs-usage.log';

export interface TopicExample {
  readonly title: string;
  readonly code: string;
}

export interface TranslationVocabulary {
  readonly known_tool: string;
  readonly terms: readonly string[];
}

export interface VocabulariesServed {
  readonly own_terms: readonly string[];
  readonly translations: readonly TranslationVocabulary[];
  readonly task: readonly string[];
}

export interface PackedTopic {
  readonly topic: string;
  readonly summary: string;
  readonly signatures?: readonly string[];
  readonly examples?: readonly TopicExample[];
  readonly see_also?: readonly string[];
  readonly vocabularies_served: VocabulariesServed;
}

export interface PackedCorpus {
  readonly comprehendo: string;
  readonly packed: number;
  readonly provider: string;
  readonly index: readonly string[];
  readonly topics: Readonly<Record<string, PackedTopic>>;
}

/** `docs()` with no argument: the menu, never the meal (index.schema.json). */
export interface DocsIndex {
  readonly topics: readonly string[];
}

/** One topic-sized answer (topic.schema.json). */
export interface DocsTopic {
  readonly topic: string;
  readonly summary: string;
  readonly signatures?: readonly string[];
  readonly examples?: readonly TopicExample[];
  readonly see_also?: readonly string[];
}

/** The honest miss (undocumented.schema.json). */
export interface Undocumented {
  readonly comprehendo: string;
  readonly code: 'UNDOCUMENTED';
  readonly query: string;
  readonly nearest: readonly string[];
  readonly source_permitted: true;
}

export type DocsResponse = DocsIndex | DocsTopic | Undocumented;

export interface LookupRecord {
  readonly query: string | null;
  readonly timestamp: string;
  readonly result: 'index' | 'hit' | 'miss';
  readonly topic?: string;
}

export type LookupSink = (record: LookupRecord) => void;

export interface DocsOptions {
  readonly logPath?: string;
  readonly sink?: LookupSink;
  readonly now?: () => Date;
}

export interface LogStats {
  readonly written: number;
  readonly failed: number;
}

export interface DocsSurface {
  (query?: string): DocsResponse;
  logStats(): LogStats;
}

function topicResponse(topic: PackedTopic): DocsTopic {
  return {
    topic: topic.topic,
    summary: topic.summary,
    ...(topic.signatures === undefined ? {} : { signatures: topic.signatures }),
    ...(topic.examples === undefined ? {} : { examples: topic.examples }),
    ...(topic.see_also === undefined ? {} : { see_also: topic.see_also }),
  };
}

const undocumented = (query: string, nearest: readonly string[]): Undocumented => ({
  comprehendo: COMPREHENDO_VERSION,
  code: 'UNDOCUMENTED',
  query,
  nearest,
  source_permitted: true,
});

function assertTopic(name: string, value: unknown): void {
  const topic = value as PackedTopic;
  if (typeof topic?.topic !== 'string' || topic.topic !== name) {
    throw new TypeError(`packed corpus topic "${name}" does not name itself`);
  }
  if (typeof topic.summary !== 'string' || topic.summary.length === 0) {
    throw new TypeError(`packed corpus topic "${name}" carries no summary`);
  }
  const served = topic.vocabularies_served;
  const terms =
    (served?.own_terms?.length ?? 0) +
    (served?.translations?.length ?? 0) +
    (served?.task?.length ?? 0);
  if (terms === 0) {
    throw new TypeError(
      `packed corpus topic "${name}" serves no vocabulary, so nothing could ever reach it`,
    );
  }
}

const isStringIndex = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Reads an in-memory artifact, refusing anything this runtime cannot answer from. */
export function parsePackedCorpus(raw: unknown): PackedCorpus {
  const corpus = raw as PackedCorpus;
  if (typeof corpus?.packed !== 'number') {
    throw new TypeError('a packed corpus must declare its "packed" format version');
  }
  if (corpus.packed !== PACKED_CORPUS_FORMAT) {
    throw new RangeError(
      `unsupported packed corpus format version ${corpus.packed}; ` +
        `this runtime reads version ${PACKED_CORPUS_FORMAT}`,
    );
  }
  if (typeof corpus.comprehendo !== 'string' || typeof corpus.provider !== 'string') {
    throw new TypeError('a packed corpus must declare "comprehendo" and "provider"');
  }
  // `isStringIndex` deliberately returns a plain boolean rather than a type
  // predicate: an `Array.isArray` guard here would narrow the declared element
  // type back to `any` for the rest of this function.
  if (!isStringIndex(corpus.index) || typeof corpus.topics !== 'object' || corpus.topics === null) {
    throw new TypeError('a packed corpus must carry an "index" array and a "topics" map');
  }
  for (const name of corpus.index) {
    if (corpus.topics[name] === undefined) {
      throw new TypeError(`the packed index advertises "${name}", which the artifact does not carry`);
    }
  }
  const advertised = new Set(corpus.index);
  for (const [name, topic] of Object.entries(corpus.topics)) {
    if (!advertised.has(name)) {
      throw new TypeError(`the packed artifact carries "${name}", which its index never advertises`);
    }
    assertTopic(name, topic);
  }
  return corpus;
}

/** The one artifact, read once. This engine never enumerates a folder. */
export function loadPackedCorpus(path: string): PackedCorpus {
  return parsePackedCorpus(JSON.parse(readFileSync(path, 'utf8')) as unknown);
}

/** Append-only local file, one JSON object per line. Never transmitted. */
function fileSink(logPath: string): LookupSink {
  const target = resolve(logPath);
  return (record) => {
    mkdirSync(dirname(target), { recursive: true });
    appendFileSync(target, `${JSON.stringify(record)}\n`, 'utf8');
  };
}

function aliasesOf(corpus: PackedCorpus): Alias[] {
  const topics: PackedTopic[] = [];
  for (const name of corpus.index) {
    const topic = corpus.topics[name];
    if (topic !== undefined) topics.push(topic);
  }
  return buildAliases(topics);
}

export function createDocs(corpus: PackedCorpus, options: DocsOptions = {}): DocsSurface {
  const aliases = aliasesOf(corpus);
  const clock = options.now ?? ((): Date => new Date());
  const sink = options.sink ?? fileSink(options.logPath ?? DEFAULT_LOG_PATH);
  let written = 0;
  let failed = 0;

  // A log this engine cannot write is never a reason not to answer, but a
  // silent failure is how a broken subsystem looks like a quiet week: count it.
  const record = (entry: LookupRecord): void => {
    try {
      sink(entry);
      written += 1;
    } catch {
      failed += 1;
    }
  };

  const lookup = (query?: string): DocsResponse => {
    const timestamp = clock().toISOString();
    if (query === undefined) {
      record({ query: null, timestamp, result: 'index' });
      return { topics: corpus.index };
    }
    const candidates = matchTopics(aliases, query);
    const only = candidates.length === 1 ? corpus.topics[candidates[0] ?? ''] : undefined;
    if (only !== undefined) {
      record({ query, timestamp, result: 'hit', topic: only.topic });
      return topicResponse(only);
    }
    // Ambiguity names its candidates rather than picking one of them.
    const nearest = candidates.length > 1 ? candidates : suggest(aliases, query);
    record({ query, timestamp, result: 'miss' });
    return undocumented(query, nearest);
  };

  return Object.assign(lookup, { logStats: (): LogStats => ({ written, failed }) });
}
