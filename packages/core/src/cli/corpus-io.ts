// Corpus Generator [17]: reading and writing the five authoring files.
//
// Nothing in this module decides anything; it is the serializer for the shapes
// format.ts declares. The one judgment call it does make is that `stub_fields`
// is DERIVED on write and recomputed on read, never trusted from the file: a
// hand-edited corpus whose stub list disagrees with its actual values would
// otherwise report itself finished while carrying a stub.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { CliError } from './errors.js';
import {
  AUTHORING_FORMAT,
  COMPREHENDO_VERSION,
  STUB,
  corpusHeader,
  fixStubFields,
  statusOf,
  topicFileName,
  topicStubFields,
  twinStubFields,
  type AuthoringCorpus,
  type FixRecord,
  type RecordStatus,
  type SymbolKind,
  type TopicExample,
  type TopicRecord,
  type TwinRecord,
  type VocabulariesServed,
} from './format.js';
import { joinFrontMatter, parseYaml, splitFrontMatter, type YamlValue } from './front-matter.js';

export interface CorpusPaths {
  readonly root: string;
  readonly manifest: string;
  readonly index: string;
  readonly topics: string;
  readonly twins: string;
  readonly fixes: string;
}

export const defaultCorpusRoot = (targetRoot: string): string => join(targetRoot, 'comprehendo');

export const corpusPaths = (root: string): CorpusPaths => ({
  root,
  manifest: join(root, 'manifest.json'),
  index: join(root, 'index.json'),
  topics: join(root, 'topics'),
  twins: join(root, 'twins.json'),
  fixes: join(root, 'fixes.json'),
});

export const corpusExists = (paths: CorpusPaths): boolean => existsSync(paths.index);

const STUB_BODY = '<!-- status: stub -->';
const EXAMPLE = /^### (.+?)\r?\n+```[a-z]*\r?\n([\s\S]*?)```/gm;

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const readJson = (path: string): Record<string, unknown> => {
  if (!existsSync(path)) throw new CliError(`corpus file missing: ${path}`);
  try {
    return record(JSON.parse(readFileSync(path, 'utf8')));
  } catch (cause) {
    throw new CliError(`corpus file is not readable JSON: ${path}`, 2, { cause });
  }
};

const writeJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

function readVocabularies(value: unknown): VocabulariesServed {
  const served = record(value);
  const translations = Array.isArray(served['translations']) ? served['translations'] : [];
  return {
    own_terms: list(served['own_terms']),
    translations: translations.map((entry) => ({
      known_tool: text(record(entry)['known_tool']),
      terms: list(record(entry)['terms']),
    })),
    task: list(served['task']),
  };
}

function readBody(body: string): { summary: string; examples: TopicExample[] } {
  const [prose = '', rest = ''] = body.split(/^## Examples\s*$/m);
  const summary = prose.trim();
  const examples = [...rest.matchAll(EXAMPLE)].map((match) => ({
    title: (match[1] ?? '').trim(),
    code: (match[2] ?? '').replace(/\s+$/, ''),
  }));
  return { summary: summary === STUB_BODY || summary === '' ? STUB : summary, examples };
}

function writeBody(topic: TopicRecord): string {
  const summary = topic.summary === STUB ? STUB_BODY : topic.summary;
  if (topic.examples.length === 0) return `${summary}\n`;
  const examples = topic.examples
    .map((example) => `### ${example.title}\n\n\`\`\`\n${example.code}\n\`\`\`\n`)
    .join('\n');
  return `${summary}\n\n## Examples\n\n${examples}`;
}

function readTopicFile(path: string, orphaned: boolean): TopicRecord {
  if (!existsSync(path)) throw new CliError(`corpus topic file missing: ${path}`);
  const { header, body } = splitFrontMatter(readFileSync(path, 'utf8'));
  const front = record(parseYaml(header));
  const { summary, examples } = readBody(body);
  const partial = {
    topic: text(front['topic']),
    kind: text(front['kind'], 'const') as SymbolKind,
    source: text(front['source'], STUB),
    signatures: list(front['signatures']),
    summary,
    see_also: list(front['see_also']),
    examples,
    vocabularies_served: readVocabularies(front['vocabularies_served']),
    orphaned,
  };
  const previous = text(front['status']) as RecordStatus;
  return { ...partial, status: statusOf(topicStubFields({ ...partial, status: 'stub' }), previous) };
}

const topicHeader = (topic: TopicRecord): YamlValue => ({
  topic: topic.topic,
  status: topic.status,
  stub_fields: topicStubFields(topic),
  kind: topic.kind,
  source: topic.source,
  signatures: [...topic.signatures],
  see_also: [...topic.see_also],
  vocabularies_served: {
    own_terms: [...topic.vocabularies_served.own_terms],
    translations: topic.vocabularies_served.translations.map((entry) => ({
      known_tool: entry.known_tool,
      terms: [...entry.terms],
    })),
    task: [...topic.vocabularies_served.task],
  },
});

function readTwins(path: string): TwinRecord[] {
  const file = readJson(path);
  const twins = Array.isArray(file['twins']) ? file['twins'] : [];
  return twins.map((raw) => {
    const entry = record(raw);
    const fingerprint = record(entry['fingerprint']);
    const partial = {
      id: text(entry['id']),
      code: text(entry['code'], STUB),
      reason: text(entry['reason'], STUB),
      docs: text(entry['docs']),
      orphaned: entry['orphaned'] === true,
      fingerprint: {
        exception: text(fingerprint['exception'], STUB),
        message_pattern: text(fingerprint['message_pattern']),
        source: text(fingerprint['source'], STUB),
        raised_by: text(fingerprint['raised_by']),
      },
    };
    const previous = text(entry['status']) as RecordStatus;
    return { ...partial, status: statusOf(twinStubFields({ ...partial, status: 'stub' }), previous) };
  });
}

function readFixes(path: string): Record<string, FixRecord[]> {
  const file = readJson(path);
  const fixes: Record<string, FixRecord[]> = {};
  for (const [id, value] of Object.entries(record(file['fixes']))) {
    fixes[id] = (Array.isArray(value) ? value : []).map((raw) => {
      const entry = record(raw);
      const partial = {
        title: text(entry['title'], STUB),
        ...(typeof entry['docs'] === 'string' ? { docs: entry['docs'] } : {}),
        ...(entry['apply'] === undefined ? {} : { apply: entry['apply'] }),
      };
      const previous = text(entry['status']) as RecordStatus;
      return {
        ...partial,
        status: statusOf(fixStubFields({ ...partial, status: 'stub' }), previous),
      };
    });
  }
  return fixes;
}

/** Reads a corpus from disk. Refuses a format version this build cannot read. */
export function readCorpus(paths: CorpusPaths): AuthoringCorpus {
  const manifest = readJson(paths.manifest);
  const version = manifest['corpus_authoring'];
  if (version !== AUTHORING_FORMAT) {
    throw new CliError(
      `corpus authoring format ${String(version)} at ${paths.manifest}; ` +
        `this build writes version ${AUTHORING_FORMAT}`,
    );
  }
  const index = readJson(paths.index);
  const target = record(manifest['target']);
  const hint = record(record(manifest['manifest_hint'])['comprehendo']);
  const entries = Array.isArray(index['topics']) ? index['topics'] : [];
  return {
    provider: text(manifest['provider']),
    target: {
      package: text(target['package']),
      version: text(target['version']),
      source: text(target['source'], 'src'),
    },
    manifest_hint: {
      comprehendo: {
        version: text(hint['version'], COMPREHENDO_VERSION),
        level: typeof hint['level'] === 'number' ? hint['level'] : 1,
      },
    },
    topics: entries.map((raw) => {
      const entry = record(raw);
      const file = text(entry['file'], `topics/${topicFileName(text(entry['topic']))}`);
      return readTopicFile(join(paths.root, file), entry['orphaned'] === true);
    }),
    twins: readTwins(paths.twins),
    fixes: readFixes(paths.fixes),
  };
}

/** One markdown file per topic, and nothing left over from a previous write. */
function writeTopicFiles(paths: CorpusPaths, corpus: AuthoringCorpus): string[] {
  mkdirSync(paths.topics, { recursive: true });
  const written: string[] = [];
  const kept = new Set<string>();
  for (const topic of corpus.topics) {
    const name = topicFileName(topic.topic);
    kept.add(name);
    writeFileSync(
      join(paths.topics, name),
      joinFrontMatter(topicHeader(topic), writeBody(topic)),
      'utf8',
    );
    written.push(`topics/${name}`);
  }
  // A topic file whose index entry is gone would otherwise linger and be read
  // back on the next scan as a topic nobody advertises.
  for (const stale of readdirSync(paths.topics)) {
    if (!kept.has(stale)) rmSync(join(paths.topics, stale));
  }
  return written;
}

/** Writes the whole corpus. Returns the files written, relative to the root. */
export function writeCorpus(paths: CorpusPaths, corpus: AuthoringCorpus): string[] {
  const header = corpusHeader(corpus.provider);
  writeJson(paths.manifest, {
    ...header,
    target: corpus.target,
    manifest_hint: corpus.manifest_hint,
  });
  writeJson(paths.index, {
    ...header,
    topics: corpus.topics.map((topic) => ({
      topic: topic.topic,
      file: `topics/${topicFileName(topic.topic)}`,
      status: topic.status,
      orphaned: topic.orphaned,
    })),
  });
  const written = ['manifest.json', 'index.json', 'topics/', ...writeTopicFiles(paths, corpus)];
  writeJson(paths.twins, {
    ...header,
    twins: corpus.twins.map((twin) => ({
      id: twin.id,
      status: twin.status,
      stub_fields: twinStubFields(twin),
      code: twin.code,
      reason: twin.reason,
      docs: twin.docs,
      orphaned: twin.orphaned,
      fingerprint: twin.fingerprint,
    })),
  });
  writeJson(paths.fixes, {
    ...header,
    fixes: Object.fromEntries(
      Object.entries(corpus.fixes).map(([id, fixes]) => [
        id,
        fixes.map((fix) => ({ ...fix, status: fix.status, stub_fields: fixStubFields(fix) })),
      ]),
    ),
  });
  written.push('twins.json', 'fixes.json');
  return written;
}
