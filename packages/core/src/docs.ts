// Docs Engine [13]: the `docs(query?)` surface. RED-GATE STUB, no behaviour.
// Every export throws so each Phase 4 test fails on its own assertion rather
// than the whole file failing to import.

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

export interface DocsIndex {
  readonly topics: readonly string[];
}

export interface DocsTopic {
  readonly topic: string;
  readonly summary: string;
  readonly signatures?: readonly string[];
  readonly examples?: readonly TopicExample[];
  readonly see_also?: readonly string[];
}

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

const notImplemented = (): never => {
  throw new Error('docs engine not implemented');
};

export function parsePackedCorpus(_raw: unknown): PackedCorpus {
  return notImplemented();
}

export function loadPackedCorpus(_path: string): PackedCorpus {
  return notImplemented();
}

export function createDocs(_corpus: PackedCorpus, _options?: DocsOptions): DocsSurface {
  return notImplemented();
}
