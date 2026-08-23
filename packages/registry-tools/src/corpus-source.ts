// Corpus Format [28], the reading half: `parse`, a file tree in, a structured
// corpus out.
//
// This is the ONLY module in this component that touches a filesystem, and
// nothing downstream of it ever does: `validate` and `pack` are pure functions
// of the value this returns. That split is what lets the format's must-not
// hold, that runtime code never walks a corpus directory, because the walk is
// a build-time step whose whole output is one artifact.
//
// The tree it reads is the five-file AUTHORING corpus Corpus Generator [17]
// writes (`corpus_authoring: 1`); the artifact `pack` emits is a different,
// separately versioned format. See corpus-format.ts for why the two are not
// the same shape.
//
// The one judgment it repeats from 17: `status` and `stub_fields` in the files
// are DERIVED bookkeeping, never trusted. A hand-edited corpus claiming it
// carries no stubs while a field still reads `status: stub` is exactly the
// corpus a submission gate exists to catch, so the values are what count.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { CorpusFormatError } from './corpus-violation.js';
import { FrontMatterError, parseFrontMatter } from './corpus-front-matter.js';

/** The authoring format version this component reads. Matches 17's writer. */
export const AUTHORING_FORMAT = 1;

/** The value every field a scan could not fill carries. 17's sentinel. */
export const STUB = 'status: stub';

/** The five files a corpus source tree is made of, in read order. */
export const AUTHORING_FILES = Object.freeze([
  'manifest.json',
  'index.json',
  'topics',
  'twins.json',
  'fixes.json',
] as const);

/** The provider's own already-shipped call surface, the CC7 [09] gate's input. */
export interface CorpusCallSchema {
  readonly surface: string;
  readonly operations: readonly string[];
  /** Declared operations whose value may itself embed another pipeline. */
  readonly nestedPipelineOperations?: readonly string[];
}

export interface CorpusTranslation {
  readonly known_tool: string;
  readonly terms: readonly string[];
}

export interface CorpusVocabularies {
  readonly own_terms: readonly string[];
  readonly translations: readonly CorpusTranslation[];
  readonly task: readonly string[];
}

export interface CorpusExample {
  readonly title: string;
  readonly code: string;
}

export interface CorpusTopic {
  readonly topic: string;
  /** The path index.json advertises, relative to the corpus root. */
  readonly file: string;
  readonly summary: string;
  readonly signatures: readonly string[];
  readonly examples: readonly CorpusExample[];
  readonly see_also: readonly string[];
  readonly vocabularies: CorpusVocabularies;
  readonly orphaned: boolean;
  /** Every topic this FILE declares. More than one is a format violation. */
  readonly declaredTopics: readonly string[];
}

/**
 * A throw site, already translated into Fingerprint Index & Matcher [21]'s
 * facet vocabulary. 17 spells a throw site `{exception, message_pattern}`
 * because that is what a scanner sees; 21 spells the same facets
 * `{errorClass, messagePattern}` because that is what a matcher checks.
 * Translating between them is this format's job: doing it at runtime would put
 * a rename in the hot path of every caught error, forever.
 */
export interface CorpusFingerprint {
  readonly errorClass?: string;
  readonly messagePattern?: string;
  readonly stackShape?: readonly string[];
  readonly kind?: 'runtime-error' | 'static-pattern';
}

export interface CorpusTwin {
  /** 17's stable authoring identity. Never what the runtime resolves against. */
  readonly id: string;
  /** The provider's published error code, and the runtime's lookup key. */
  readonly code: string;
  readonly reason: string;
  readonly docs: string;
  readonly orphaned: boolean;
  readonly fingerprint: CorpusFingerprint;
  /** The raw throw-site text, kept for the CC3 [08] leak check. */
  readonly rawText: string;
}

export interface CorpusFix {
  readonly title: string;
  readonly apply?: unknown;
  readonly docs?: string;
  readonly confidence?: 'high' | 'likely' | 'guess';
}

export interface CorpusSource {
  readonly provider: string;
  /** The target package this corpus is FOR. */
  readonly package: string;
  /**
   * The target version it was authored against. Deprecated display field:
   * `versions` is the field range-matching (upstream-watch, gate induction)
   * actually resolves against. Kept populated (the first `versions` entry,
   * or the literal `target.version` when the manifest only carries that
   * older single-pin form) so an existing reader is never handed nothing.
   */
  readonly version: string;
  /**
   * Every version range this corpus is authored against, e.g.
   * `[">=4.4 <5", ">=6 <8"]`. A manifest carrying only the old
   * `target.version` single pin reads as a one-entry EXACT-match set
   * (`[version]`), the literal meaning that field always had: authored
   * against exactly this build, matched via `version-range.ts`'s bare-
   * version form, never widened into a range nobody declared.
   */
  readonly versions: readonly string[];
  readonly declaredSchema?: CorpusCallSchema;
  /** Menu order, exactly as index.json carries it. */
  readonly topics: readonly CorpusTopic[];
  readonly twins: readonly CorpusTwin[];
  /** Keyed by twin id, in author order (most-likely-first). */
  readonly fixes: Readonly<Record<string, readonly CorpusFix[]>>;
  /** Files under topics/ that no index entry advertises. */
  readonly strayTopicFiles: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** One corpus file as JSON, or a refusal naming the file. Never a lossy read. */
function readJson(root: string, file: string): Record<string, unknown> {
  const path = join(root, file);
  if (!existsSync(path)) {
    throw new CorpusFormatError(`the corpus at ${root} carries no ${file}`);
  }
  try {
    return record(JSON.parse(readFileSync(path, 'utf8')));
  } catch (cause) {
    throw new CorpusFormatError(`${file} is not readable JSON: ${(cause as Error).message}`);
  }
}

function readVocabularies(value: unknown): CorpusVocabularies {
  const served = record(value);
  const translations = Array.isArray(served['translations']) ? served['translations'] : [];
  return Object.freeze({
    own_terms: Object.freeze(list(served['own_terms'])),
    translations: Object.freeze(
      translations.map((entry) =>
        Object.freeze({
          known_tool: text(record(entry)['known_tool']),
          terms: Object.freeze(list(record(entry)['terms'])),
        }),
      ),
    ),
    task: Object.freeze(list(served['task'])),
  });
}

const EXAMPLE = /^### (.+?)\r?\n+```[a-z]*\r?\n([\s\S]*?)```/gm;

/** The prose is the summary; anything under `## Examples` is worked examples. */
function readBody(body: string): { summary: string; examples: CorpusExample[] } {
  const [prose = '', rest = ''] = body.split(/^## Examples\s*$/m);
  const summary = prose.trim();
  return {
    // 17 writes an unfilled summary as an HTML comment carrying the sentinel;
    // both spellings mean the same unwritten field.
    summary: summary === '<!-- status: stub -->' || summary === '' ? STUB : summary,
    examples: [...rest.matchAll(EXAMPLE)].map((match) =>
      Object.freeze({
        title: (match[1] ?? '').trim(),
        code: (match[2] ?? '').replace(/\s+$/, ''),
      }),
    ),
  };
}

function readTopic(root: string, entry: Record<string, unknown>): CorpusTopic {
  const name = text(entry['topic']);
  const file = text(entry['file'], `topics/${name}.md`);
  const path = join(root, file);
  if (!existsSync(path)) {
    throw new CorpusFormatError(`index.json advertises ${file}, which the corpus does not carry`);
  }
  let front;
  try {
    front = parseFrontMatter(readFileSync(path, 'utf8'));
  } catch (cause) {
    if (!(cause instanceof FrontMatterError)) throw cause;
    throw new CorpusFormatError(`${file} has a malformed YAML front matter header: ${cause.message}`);
  }
  const { summary, examples } = readBody(front.body);
  return Object.freeze({
    topic: text(front.header['topic'], name),
    file,
    summary,
    signatures: Object.freeze(list(front.header['signatures'])),
    examples: Object.freeze(examples),
    see_also: Object.freeze(list(front.header['see_also'])),
    vocabularies: readVocabularies(front.header['vocabularies_served']),
    orphaned: entry['orphaned'] === true,
    declaredTopics: front.declaredTopics,
  });
}

const facetKind = (value: unknown): CorpusFingerprint['kind'] =>
  value === 'static-pattern' || value === 'runtime-error' ? value : undefined;

/** An authoring throw site, in 21's facet vocabulary. Absent facets stay absent. */
function readFingerprint(value: unknown): { fingerprint: CorpusFingerprint; rawText: string } {
  const raw = record(value);
  const errorClass = text(raw['exception']);
  const messagePattern = text(raw['message_pattern']);
  const stackShape = list(raw['stack_shape']);
  const kind = facetKind(raw['kind']);
  return {
    fingerprint: Object.freeze({
      ...(errorClass === '' || errorClass === STUB ? {} : { errorClass }),
      ...(messagePattern === '' || messagePattern === STUB ? {} : { messagePattern }),
      ...(stackShape.length === 0 ? {} : { stackShape: Object.freeze(stackShape) }),
      ...(kind === undefined ? {} : { kind }),
    }),
    rawText: messagePattern,
  };
}

function readTwins(file: Record<string, unknown>): CorpusTwin[] {
  const twins = Array.isArray(file['twins']) ? file['twins'] : [];
  return twins.map((value) => {
    const entry = record(value);
    const { fingerprint, rawText } = readFingerprint(entry['fingerprint']);
    return Object.freeze({
      id: text(entry['id']),
      code: text(entry['code'], STUB),
      reason: text(entry['reason'], STUB),
      docs: text(entry['docs']),
      orphaned: entry['orphaned'] === true,
      fingerprint,
      rawText,
    });
  });
}

const confidenceOf = (value: unknown): CorpusFix['confidence'] =>
  value === 'high' || value === 'likely' || value === 'guess' ? value : undefined;

function readFixes(file: Record<string, unknown>): Record<string, readonly CorpusFix[]> {
  const fixes: Record<string, readonly CorpusFix[]> = {};
  for (const [id, value] of Object.entries(record(file['fixes']))) {
    fixes[id] = Object.freeze(
      (Array.isArray(value) ? value : []).map((raw) => {
        const entry = record(raw);
        const confidence = confidenceOf(entry['confidence']);
        return Object.freeze({
          title: text(entry['title'], STUB),
          ...(entry['apply'] === undefined ? {} : { apply: entry['apply'] }),
          ...(typeof entry['docs'] === 'string' ? { docs: entry['docs'] } : {}),
          ...(confidence === undefined ? {} : { confidence }),
        });
      }),
    );
  }
  return fixes;
}

/** The provider's declared call surface, when the corpus carries one. */
function readDeclaredSchema(value: unknown): CorpusCallSchema | undefined {
  if (!isRecord(value)) return undefined;
  const nested = list(value['nested_pipeline_operations']);
  return Object.freeze({
    surface: text(value['surface']),
    operations: Object.freeze(list(value['operations'])),
    ...(nested.length === 0 ? {} : { nestedPipelineOperations: Object.freeze(nested) }),
  });
}

/**
 * The target's version range set, from `target.versions` (the current form)
 * or `target.version` (the deprecated single pin, read as a one-entry EXACT
 * set). Additive-compatible per the RFC rule: an old manifest with only
 * `version` still parses, unchanged in meaning.
 */
function readVersions(target: Record<string, unknown>): readonly string[] {
  const versions = list(target['versions']);
  if (versions.length > 0) return Object.freeze(versions);
  const single = text(target['version']);
  return single === '' ? Object.freeze([]) : Object.freeze([single]);
}

/** Topic files on disk that no index entry advertises. */
function strayTopicFiles(root: string, advertised: ReadonlySet<string>): string[] {
  const directory = join(root, 'topics');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `topics/${entry.name}`)
    .filter((file) => !advertised.has(file))
    .sort();
}

/**
 * Read a corpus source tree into a structured corpus.
 *
 * Refuses, naming the file, anything that stops it reading at all: a missing
 * or unparseable file, an authoring format version this build does not
 * understand, a topic file the index advertises and the disk lacks. Everything
 * else, every way a readable corpus can still be wrong, is `validate`'s job
 * and comes back as data, because a submission gate has to report all of it at
 * once rather than one refusal per CI run.
 */
export function parse(corpusDir: string): CorpusSource {
  const manifest = readJson(corpusDir, 'manifest.json');
  const version = manifest['corpus_authoring'];
  if (version !== AUTHORING_FORMAT) {
    throw new CorpusFormatError(
      `corpus_authoring ${String(version)} at ${join(corpusDir, 'manifest.json')}; ` +
        `this build reads version ${String(AUTHORING_FORMAT)}`,
    );
  }
  const index = readJson(corpusDir, 'index.json');
  const target = record(manifest['target']);
  const entries = Array.isArray(index['topics']) ? index['topics'] : [];
  const topics = entries.map((entry) => readTopic(corpusDir, record(entry)));
  const declaredSchema = readDeclaredSchema(manifest['declared_schema']);

  const versions = readVersions(target);
  return Object.freeze({
    provider: text(manifest['provider']),
    package: text(target['package'], text(manifest['provider'])),
    version: text(target['version'], versions[0] ?? ''),
    versions,
    ...(declaredSchema === undefined ? {} : { declaredSchema }),
    topics: Object.freeze(topics),
    twins: Object.freeze(readTwins(readJson(corpusDir, 'twins.json'))),
    fixes: Object.freeze(readFixes(readJson(corpusDir, 'fixes.json'))),
    strayTopicFiles: Object.freeze(
      strayTopicFiles(corpusDir, new Set(topics.map((topic) => topic.file))),
    ),
  });
}
