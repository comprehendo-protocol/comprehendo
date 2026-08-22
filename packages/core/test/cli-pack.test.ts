/**
 * Corpus Generator [17], `comprehendo pack`: the bridge from this feature's
 * five-file authoring format to the packed runtime artifact Docs Engine [13]
 * defined and reads.
 *
 * The round trip is the point. These tests do not re-implement 13's rules;
 * they run the emitted artifact through 13's own loader and 13's own docs
 * surface, so "17 emits what 13 reads" is checked rather than asserted.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createDocs, loadPackedCorpus } from '../src/docs.js';
import {
  CliError,
  corpusPaths,
  packCorpus,
  readCorpus,
  runInit,
  runPack,
  runScan,
  writeCorpus,
} from '../src/cli/index.js';
import { cleanupWorkspaces, fillEveryStub, makeWorkspace, type Workspace } from './helpers/toy-corpus.js';

afterEach(cleanupWorkspaces);

/** A corpus a human has finished: every stub filled, ready to publish. */
function finished(): Workspace {
  const workspace = makeWorkspace();
  runInit(workspace.options());
  runScan(workspace.options());
  fillEveryStub(workspace.corpus);
  workspace.lines.length = 0;
  return workspace;
}

const packedAt = (workspace: Workspace): string => join(workspace.target, 'comprehendo.packed.json');

describe('comprehendo pack', () => {
  it('compiles an authored corpus into one packed artifact', () => {
    const workspace = finished();

    const code = runPack(workspace.options());
    const packed = JSON.parse(readFileSync(packedAt(workspace), 'utf8')) as Record<string, unknown>;

    expect(code).toBe(0);
    expect(packed['provider']).toBe('toy-encoder');
    expect(packed['index']).toEqual([
      'EncodeOptions',
      'encode',
      'decode',
      'Codec',
      'DEFAULT_CODEC',
      'CodecRegistry',
    ]);
  });

  it('emits the packed format version the docs runtime reads', () => {
    const workspace = finished();

    runPack(workspace.options());
    const packed = JSON.parse(readFileSync(packedAt(workspace), 'utf8')) as Record<string, unknown>;

    expect(packed['packed']).toBe(1);
    expect(packed['comprehendo']).toBe('0.1');
  });

  it('produces an artifact the docs engine own loader accepts', () => {
    const workspace = finished();

    runPack(workspace.options());

    expect(() => loadPackedCorpus(packedAt(workspace))).not.toThrow();
    expect(loadPackedCorpus(packedAt(workspace)).index).toHaveLength(6);
  });

  it('produces an artifact that answers a query end to end', () => {
    const workspace = finished();
    runPack(workspace.options());

    const docs = createDocs(loadPackedCorpus(packedAt(workspace)), { sink: () => undefined });

    expect(docs()).toEqual({
      topics: ['EncodeOptions', 'encode', 'decode', 'Codec', 'DEFAULT_CODEC', 'CodecRegistry'],
    });
    expect(docs('encode')).toMatchObject({
      topic: 'encode',
      signatures: ['function encode(input: string, options?: EncodeOptions): string'],
    });
  });

  it('carries vocabularies_served through so all three tiers still resolve', () => {
    const workspace = finished();
    const paths = corpusPaths(workspace.corpus);
    const corpus = readCorpus(paths);
    writeCorpus(paths, {
      ...corpus,
      topics: corpus.topics.map((topic) =>
        topic.topic === 'encode'
          ? {
              ...topic,
              vocabularies_served: {
                own_terms: ['encode'],
                translations: [{ known_tool: 'protobuf', terms: ['marshal'] }],
                task: ['put a string on the wire'],
              },
            }
          : topic,
      ),
    });
    runPack(workspace.options());

    const docs = createDocs(loadPackedCorpus(packedAt(workspace)), { sink: () => undefined });

    expect(docs('marshal')).toMatchObject({ topic: 'encode' });
    expect(docs('put a string on the wire')).toMatchObject({ topic: 'encode' });
    // Authoring data, never echoed back: that is part of the CC5 budget.
    expect(docs('encode')).not.toHaveProperty('vocabularies_served');
  });

  it('omits optional arrays the author never filled', () => {
    const workspace = finished();

    runPack(workspace.options());
    const packed = loadPackedCorpus(packedAt(workspace));

    expect(packed.topics['encode']).not.toHaveProperty('see_also');
    expect(packed.topics['encode']).not.toHaveProperty('examples');
    expect(packed.topics['encode']).toHaveProperty('signatures');
  });

  it('refuses to emit while a publish-required field is still a stub', () => {
    const workspace = makeWorkspace();
    runInit(workspace.options());
    runScan(workspace.options());

    const pack = (): number => runPack(workspace.options());

    expect(pack).toThrow(CliError);
    expect(pack).toThrow(/status: stub/);
  });

  it('names every stub that blocked it, so the author knows what to write', () => {
    const workspace = makeWorkspace();
    runInit(workspace.options());
    runScan(workspace.options());
    const corpus = readCorpus(corpusPaths(workspace.corpus));

    try {
      packCorpus(corpus);
      expect.unreachable('pack must refuse a corpus that still carries stubs');
    } catch (error) {
      expect((error as Error).message).toContain('decode.summary');
      expect((error as Error).message).toContain('16 field(s)');
    }
  });
});
