/**
 * Corpus Generator [17], `comprehendo scan`: the pre-fill verb, and the
 * feature's central must-not (a re-scan never touches a human-owned field).
 *
 * Every test here runs against a real toy target package copied into a temp
 * directory, so what is being scanned is TypeScript a compiler accepts, not a
 * string that happens to look like it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CliError,
  STUB,
  collectStubs,
  corpusPaths,
  readCorpus,
  runInit,
  runScan,
  writeCorpus,
  type AuthoringCorpus,
} from '../src/cli/index.js';
import {
  cleanupWorkspaces,
  makeLocalPackage,
  makeWorkspace,
  snapshot,
  type Workspace,
} from './helpers/toy-corpus.js';

afterEach(cleanupWorkspaces);

const scanned = (workspace: Workspace): AuthoringCorpus => {
  runInit(workspace.options());
  runScan(workspace.options());
  return readCorpus(corpusPaths(workspace.corpus));
};

const topic = (corpus: AuthoringCorpus, name: string): AuthoringCorpus['topics'][number] => {
  const found = corpus.topics.find((entry) => entry.topic === name);
  if (found === undefined) {
    throw new Error(`no topic ${name} in ${corpus.topics.map((entry) => entry.topic).join(', ')}`);
  }
  return found;
};

describe('comprehendo scan, what a machine can know', () => {
  it('writes one topic per exported symbol of the target package', () => {
    const corpus = scanned(makeWorkspace());

    expect(corpus.topics.map((entry) => entry.topic)).toEqual([
      'EncodeOptions',
      'encode',
      'decode',
      'Codec',
      'DEFAULT_CODEC',
      'CodecRegistry',
    ]);
  });

  it('fills signatures from the exported declaration header', () => {
    const corpus = scanned(makeWorkspace());

    expect(topic(corpus, 'encode').signatures).toEqual([
      'function encode(input: string, options?: EncodeOptions): string',
    ]);
    expect(topic(corpus, 'CodecRegistry').signatures).toEqual(['class CodecRegistry']);
    expect(topic(corpus, 'DEFAULT_CODEC').signatures).toEqual(['const DEFAULT_CODEC: Codec']);
    expect(topic(corpus, 'encode').source).toBe('src/encode.ts:11');
    expect(topic(corpus, 'encode').kind).toBe('function');
  });

  it('seeds a DRAFT summary from the docstring above an export', () => {
    const corpus = scanned(makeWorkspace());

    expect(topic(corpus, 'encode').summary).toBe(
      'Encode a payload into the toy wire format: a decimal length prefix, a\ncolon, then the payload itself.',
    );
    expect(topic(corpus, 'encode').status).toBe('draft');
  });

  it("seeds own_terms with the export name, the tool's own vocabulary", () => {
    const corpus = scanned(makeWorkspace());

    expect(topic(corpus, 'encode').vocabularies_served).toEqual({
      own_terms: ['encode'],
      translations: [],
      task: [],
    });
  });

  it('writes one twin skeleton per throw site with the exception type pre-filled', () => {
    const corpus = scanned(makeWorkspace());

    expect(corpus.twins.map((twin) => twin.fingerprint.exception)).toEqual([
      'RangeError',
      'TypeError',
      'SyntaxError',
      'Error',
      'ReferenceError',
    ]);
    expect(corpus.twins[0]?.fingerprint).toEqual({
      exception: 'RangeError',
      message_pattern: 'input must not be empty',
      source: 'src/encode.ts:13',
      raised_by: 'encode',
    });
  });

  it('writes a fix skeleton carrying only the machine-derivable docs pointer', () => {
    const corpus = scanned(makeWorkspace());
    const first = corpus.twins[0]?.id ?? '';

    expect(corpus.fixes[first]).toEqual([{ title: STUB, docs: 'encode', status: 'stub' }]);
  });

  it('records the target package version it scanned', () => {
    const corpus = scanned(makeWorkspace());

    expect(corpus.target).toEqual({ package: 'toy-encoder', version: '1.0.0', source: 'src' });
  });
});

describe('comprehendo scan, what it must not guess', () => {
  it("marks an undocumented export's summary status: stub", () => {
    const workspace = makeWorkspace();
    const corpus = scanned(workspace);

    expect(topic(corpus, 'decode').summary).toBe(STUB);
    expect(topic(corpus, 'decode').status).toBe('stub');
    const file = readFileSync(join(workspace.corpus, 'topics', 'decode.md'), 'utf8');
    expect(file).toContain('status: stub');
    expect(file).toContain('stub_fields:\n  - summary');
  });

  it("marks every twin's code and reason status: stub", () => {
    const corpus = scanned(makeWorkspace());

    expect(corpus.twins.every((twin) => twin.code === STUB && twin.reason === STUB)).toBe(true);
    expect(corpus.twins.every((twin) => twin.status === 'stub')).toBe(true);
  });

  it('reports how many stub fields it left behind', () => {
    const workspace = makeWorkspace();
    const corpus = scanned(workspace);

    const stubs = collectStubs(corpus);
    expect(stubs.length).toBeGreaterThan(0);
    expect(workspace.lines).toContain(`stubs: ${stubs.length}`);
    expect(workspace.lines).toContain('  status: stub  topics/decode.md  decode.summary');
  });
});

describe('comprehendo scan, field ownership on a re-scan', () => {
  it('leaves human-owned fields byte-identical on an unchanged re-scan', () => {
    const workspace = makeWorkspace();
    scanned(workspace);
    const before = snapshot(workspace.corpus);

    runScan(workspace.options());

    expect(snapshot(workspace.corpus)).toEqual(before);
  });

  it('never overwrites a human-written summary, even when the docstring changed', () => {
    const workspace = makeWorkspace();
    const paths = corpusPaths(workspace.corpus);
    const corpus = scanned(workspace);
    writeCorpus(paths, {
      ...corpus,
      topics: corpus.topics.map((entry) =>
        entry.topic === 'encode' ? { ...entry, summary: 'Mine, written by a human.' } : entry,
      ),
    });
    workspace.edit('src/encode.ts', (text) =>
      text.replace('Encode a payload', 'Completely rewritten upstream docstring'),
    );

    runScan(workspace.options());

    expect(topic(readCorpus(paths), 'encode').summary).toBe('Mine, written by a human.');
  });

  it('never overwrites a human-written twin reason, code, or fix', () => {
    const workspace = makeWorkspace();
    const paths = corpusPaths(workspace.corpus);
    const corpus = scanned(workspace);
    const id = corpus.twins[0]?.id ?? '';
    writeCorpus(paths, {
      ...corpus,
      twins: corpus.twins.map((twin) =>
        twin.id === id
          ? { ...twin, code: 'EMPTY_INPUT', reason: 'The encoder has nothing to encode.' }
          : twin,
      ),
      fixes: {
        ...corpus.fixes,
        [id]: [{ title: 'Pass a non-empty payload', docs: 'encode', status: 'ready' }],
      },
    });
    workspace.upgrade('toy-target-next');

    runScan(workspace.options());
    const after = readCorpus(paths);

    expect(after.twins[0]?.code).toBe('EMPTY_INPUT');
    expect(after.twins[0]?.reason).toBe('The encoder has nothing to encode.');
    expect(after.twins[0]?.status).toBe('draft');
    expect(after.fixes[id]).toEqual([
      { title: 'Pass a non-empty payload', docs: 'encode', status: 'ready' },
    ]);
  });

  it('never drops human-added aliases from vocabularies_served', () => {
    const workspace = makeWorkspace();
    const paths = corpusPaths(workspace.corpus);
    const corpus = scanned(workspace);
    writeCorpus(paths, {
      ...corpus,
      topics: corpus.topics.map((entry) =>
        entry.topic === 'encode'
          ? {
              ...entry,
              see_also: ['decode'],
              vocabularies_served: {
                own_terms: ['encode', 'serialize'],
                translations: [{ known_tool: 'protobuf', terms: ['marshal'] }],
                task: ['put a string on the wire'],
              },
            }
          : entry,
      ),
    });

    workspace.upgrade('toy-target-next');
    runScan(workspace.options());
    const after = readCorpus(paths);

    expect(topic(after, 'encode').vocabularies_served).toEqual({
      own_terms: ['encode', 'serialize'],
      translations: [{ known_tool: 'protobuf', terms: ['marshal'] }],
      task: ['put a string on the wire'],
    });
    expect(topic(after, 'encode').see_also).toEqual(['decode']);
  });

  it('regenerates machine-owned signatures when the target code changed', () => {
    const workspace = makeWorkspace();
    const paths = corpusPaths(workspace.corpus);
    scanned(workspace);

    workspace.upgrade('toy-target-next');
    runScan(workspace.options());
    const after = readCorpus(paths);

    expect(topic(after, 'encode').signatures).toEqual([
      'function encode(input: string, codec: string, options?: EncodeOptions): string',
    ]);
    expect(after.target.version).toBe('2.0.0');
  });

  it('adds a topic for a newly exported symbol without disturbing the others', () => {
    const workspace = makeWorkspace();
    const paths = corpusPaths(workspace.corpus);
    scanned(workspace);
    const summaryBefore = topic(readCorpus(paths), 'decode').summary;

    workspace.upgrade('toy-target-next');
    runScan(workspace.options());
    const after = readCorpus(paths);

    expect(after.topics.map((entry) => entry.topic)).toContain('encodeAll');
    // Appended, never re-ordered: menu order is a human curation act.
    expect(after.topics.at(-1)?.topic).toBe('encodeAll');
    expect(topic(after, 'decode').summary).toBe(summaryBefore);
  });

  it("marks a vanished export's topic orphaned rather than deleting human prose", () => {
    const workspace = makeWorkspace();
    const paths = corpusPaths(workspace.corpus);
    const corpus = scanned(workspace);
    writeCorpus(paths, {
      ...corpus,
      topics: corpus.topics.map((entry) =>
        entry.topic === 'Codec' ? { ...entry, summary: 'Hours of human prose about codecs.' } : entry,
      ),
    });

    workspace.upgrade('toy-target-next');
    runScan(workspace.options());
    const after = readCorpus(paths);

    expect(topic(after, 'Codec').orphaned).toBe(true);
    expect(topic(after, 'Codec').summary).toBe('Hours of human prose about codecs.');
    expect(workspace.lines.some((line) => line.includes('orphaned'))).toBe(true);
  });
});

describe('comprehendo scan, preconditions', () => {
  it('refuses to scan a package with no corpus, naming init', () => {
    const workspace = makeWorkspace();

    const scan = (): number => runScan(workspace.options());

    expect(scan).toThrow(CliError);
    expect(scan).toThrow(/comprehendo init/);
  });

  it('serves a local corpus for an internal package through the same code path', () => {
    const target = makeLocalPackage('internal-lookup');
    const lines: string[] = [];
    const options = { target, write: (line: string) => lines.push(line) };

    runInit(options);
    runScan(options);
    const corpus = readCorpus(corpusPaths(join(target, 'comprehendo')));

    expect(corpus.target).toEqual({ package: 'internal-lookup', version: '0.1.0', source: '.' });
    expect(corpus.topics.map((entry) => entry.topic)).toEqual(['lookup']);
    expect(corpus.twins[0]?.fingerprint.exception).toBe('RangeError');
  });
});
