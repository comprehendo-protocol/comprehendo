// Corpus Format [28]: `parse`, against a corpus Corpus Generator [17] wrote.
//
// Every assertion below is checked against the tree 17's own `runInit` and
// `runScan` produced on a real disk, never against a fixture typed to agree
// with this package's parser. The helper's header says why.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { AUTHORING_FORMAT, CorpusFormatError, parse } from '../src/corpus-format.js';
import { authoredTree, completeCorpus, readJsonFile, scratch, writeJsonFile } from './helpers/authored-corpus.js';

const trees: (() => void)[] = [];

const authored = async (complete = true): Promise<Awaited<ReturnType<typeof authoredTree>>> => {
  const tree = await authoredTree();
  trees.push(tree.cleanup);
  if (complete) await completeCorpus(tree);
  return tree;
};

afterEach(() => {
  while (trees.length > 0) trees.pop()?.();
});

describe('parse reads the five-file corpus shape Corpus Generator [17] produces', () => {
  it('reads the provider, the target package and the target version off manifest.json', async () => {
    const tree = await authored();

    const corpus = parse(tree.corpus);

    expect(corpus.provider).toBe('toy-encoder');
    expect(corpus.package).toBe('toy-encoder');
    expect(corpus.version).toBe('1.0.0');
  });

  it('reads the topics in the index.json menu order, with their file names', async () => {
    const tree = await authored();

    const corpus = parse(tree.corpus);

    const index = readJsonFile(tree.paths.index)['topics'] as { topic: string; file: string }[];
    expect(corpus.topics.map((topic) => topic.topic)).toEqual(index.map((entry) => entry.topic));
    expect(corpus.topics.map((topic) => topic.file)).toEqual(index.map((entry) => entry.file));
  });

  it('reads each topic body as its summary and its YAML header as its metadata', async () => {
    const tree = await authored();

    const encode = parse(tree.corpus).topics.find((topic) => topic.topic === 'encode');

    const file = readFileSync(join(tree.corpus, 'topics', 'encode.md'), 'utf8');
    expect(encode?.summary).toBe(
      'What encode does, in one topic-sized answer.',
    );
    expect(file).toContain(encode?.summary ?? '<unset>');
    expect(encode?.signatures).toEqual(['function encode(input: string): string']);
    expect(encode?.vocabularies.own_terms).toEqual(['encode']);
    expect(encode?.orphaned).toBe(false);
  });

  it('reads the twins with their throw-site fingerprints translated to index facets', async () => {
    const tree = await authored();

    const corpus = parse(tree.corpus);

    const written = readJsonFile(tree.paths.twins)['twins'] as Record<string, unknown>[];
    expect(corpus.twins.map((twin) => twin.id)).toEqual(written.map((twin) => String(twin['id'])));
    const first = corpus.twins[0];
    expect(first?.code).toBe('TOY_0_RANGEERROR');
    expect(first?.docs).toBe('encode');
    // 17 spells a throw site `{exception, message_pattern}`; Fingerprint Index
    // & Matcher [21] spells the same facets `{errorClass, messagePattern}`.
    // Translating between the two is this format's job, not the runtime's.
    expect(first?.fingerprint.errorClass).toBe('RangeError');
    expect(first?.fingerprint.messagePattern).toBe('input must not be empty');
  });

  it('reads fixes.json keyed by twin id, in the author order', async () => {
    const tree = await authored();

    const corpus = parse(tree.corpus);

    const id = corpus.twins[0]?.id ?? '';
    expect(corpus.fixes[id]?.[0]?.title).toBe('Pass a non-empty payload');
    expect(corpus.fixes[id]?.[0]?.docs).toBe('encode');
  });

  it('reads the declared call schema, the slot CC7 [09] checks an apply against', async () => {
    const tree = await authored();

    const corpus = parse(tree.corpus);

    expect(corpus.declaredSchema?.surface).toBe('toy-encoder');
    expect(corpus.declaredSchema?.operations).toEqual(['encode', 'decode']);
  });

  it('derives a stub from the value, never from the stub_fields the file claims', async () => {
    const tree = await authored(false);
    // A scanned, unfinished corpus: 17 marked what it could not fill. Nothing
    // about the parse trusts the file's own bookkeeping.
    const twins = readJsonFile(tree.paths.twins);
    const written = twins['twins'] as Record<string, unknown>[];
    written.forEach((twin) => {
      twin['stub_fields'] = [];
      twin['status'] = 'ready';
    });
    writeJsonFile(tree.paths.twins, twins);

    const corpus = parse(tree.corpus);

    expect(corpus.twins[0]?.code).toBe('status: stub');
    expect(corpus.twins[0]?.reason).toBe('status: stub');
  });

  it('records every topic file under topics/ that no index entry advertises', async () => {
    const tree = await authored();
    writeFileSync(
      join(tree.corpus, 'topics', 'left-behind.md'),
      '---\ntopic: left-behind\n---\n\nNobody advertises this.\n',
      'utf8',
    );

    expect(parse(tree.corpus).strayTopicFiles).toEqual(['topics/left-behind.md']);
  });

  it('records every topic a topic file declares, so one-topic-per-file is checkable', async () => {
    const tree = await authored();
    const path = join(tree.corpus, 'topics', 'encode.md');
    writeFileSync(
      path,
      `${readFileSync(path, 'utf8')}\n---\ntopic: smuggled\nkind: function\n---\n\nA second topic in one file.\n`,
      'utf8',
    );

    const encode = parse(tree.corpus).topics.find((topic) => topic.topic === 'encode');

    expect(encode?.declaredTopics).toEqual(['encode', 'smuggled']);
  });

  it('does not read a `---` line inside a fenced code block as a second topic', async () => {
    const tree = await authored();
    const path = join(tree.corpus, 'topics', 'encode.md');
    writeFileSync(
      path,
      `${readFileSync(path, 'utf8')}\n## Examples\n\n### front matter\n\n\`\`\`\n---\ntopic: not-a-topic\n---\n\`\`\`\n`,
      'utf8',
    );

    const encode = parse(tree.corpus).topics.find((topic) => topic.topic === 'encode');

    expect(encode?.declaredTopics).toEqual(['encode']);
  });
});

describe('parse refuses what it cannot read, naming the file', () => {
  it('refuses a directory that carries no corpus at all', () => {
    const { path, cleanup } = scratch();
    trees.push(cleanup);

    expect(() => parse(path)).toThrow(CorpusFormatError);
    expect(() => parse(path)).toThrow(/manifest\.json/);
  });

  it('refuses an authoring format version it does not understand, never a lossy read', async () => {
    const tree = await authored();
    const manifest = readJsonFile(tree.paths.manifest);
    writeJsonFile(tree.paths.manifest, { ...manifest, corpus_authoring: AUTHORING_FORMAT + 1 });

    expect(() => parse(tree.corpus)).toThrow(
      new RegExp(`corpus_authoring ${String(AUTHORING_FORMAT + 1)}`),
    );
  });

  it('refuses a topic file the index advertises and the disk does not carry', async () => {
    const tree = await authored();
    rmSync(join(tree.corpus, 'topics', 'encode.md'));

    expect(() => parse(tree.corpus)).toThrow(/topics\/encode\.md/);
  });

  it('refuses a topic file with no YAML front matter, naming the file', async () => {
    const tree = await authored();
    writeFileSync(join(tree.corpus, 'topics', 'encode.md'), 'No header at all.\n', 'utf8');

    expect(() => parse(tree.corpus)).toThrow(/topics\/encode\.md/);
  });

  it('refuses a corpus file that is not readable JSON, naming the file', async () => {
    const tree = await authored();
    writeFileSync(tree.paths.fixes, '{ not json', 'utf8');

    expect(() => parse(tree.corpus)).toThrow(/fixes\.json/);
  });

  it('reads a corpus whose topics/ directory does not exist yet without crashing', () => {
    const { path, cleanup } = scratch();
    trees.push(cleanup);
    const header = { comprehendo: '0.1', corpus_authoring: AUTHORING_FORMAT, provider: 'bare' };
    mkdirSync(path, { recursive: true });
    writeJsonFile(join(path, 'manifest.json'), {
      ...header,
      target: { package: 'bare', version: '0.0.0', source: 'src' },
    });
    writeJsonFile(join(path, 'index.json'), { ...header, topics: [] });
    writeJsonFile(join(path, 'twins.json'), { ...header, twins: [] });
    writeJsonFile(join(path, 'fixes.json'), { ...header, fixes: {} });

    const corpus = parse(path);

    expect(corpus.topics).toEqual([]);
    expect(corpus.strayTopicFiles).toEqual([]);
  });
});
