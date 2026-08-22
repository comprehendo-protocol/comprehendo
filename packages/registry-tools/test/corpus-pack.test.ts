// Corpus Format [28]: `pack`, and the one runtime artifact it produces.
//
// The acceptance claim is that a packed corpus is loaded by the runtime with
// NO directory access, so these tests write the artifact to a real temp file,
// read that one file back, and drive the real runtimes with what came out:
// Docs Engine [13]'s `createDocs` answers a query from it, Fingerprint Index &
// Matcher [21]'s real matcher matches a real thrown error against it, and Twin
// Builder [12]'s real builder turns the matched entry into the cataloged twin.
// Nothing here is a double.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFingerprintIndex } from '../src/fingerprint.js';
import {
  CORPUS_ARTIFACT,
  CORPUS_DESCRIPTOR_KEY,
  CORPUS_PACKED_FORMAT,
  CorpusFormatError,
  corpusDescriptor,
  pack,
  parse,
  readPackedCorpus,
  serializeCorpus,
} from '../src/corpus-format.js';
import type { PackedCorpus } from '../src/corpus-format.js';
import {
  authoredTree,
  coreModule,
  completeCorpus,
  readJsonFile,
  scratch,
  writeJsonFile,
} from './helpers/authored-corpus.js';

const trees: (() => void)[] = [];

afterEach(() => {
  while (trees.length > 0) trees.pop()?.();
});

async function packed(): Promise<PackedCorpus> {
  const tree = await authoredTree();
  trees.push(tree.cleanup);
  await completeCorpus(tree);
  return pack(parse(tree.corpus));
}

/** The artifact, on a real disk, read back as exactly one file. */
function published(corpus: PackedCorpus): { dir: string; read: () => PackedCorpus } {
  const { path, cleanup } = scratch('comprehendo-28-published-');
  trees.push(cleanup);
  writeFileSync(join(path, CORPUS_ARTIFACT), serializeCorpus(corpus), 'utf8');
  return {
    dir: path,
    read: (): PackedCorpus =>
      readPackedCorpus(JSON.parse(readFileSync(join(path, CORPUS_ARTIFACT), 'utf8')) as unknown),
  };
}

describe('pack compiles a validated corpus into one versioned artifact', () => {
  it('declares its format version, the target package and the provider', async () => {
    const corpus = await packed();

    expect(corpus.corpus_packed).toBe(CORPUS_PACKED_FORMAT);
    expect(corpus.package).toBe('toy-encoder');
    expect(corpus.provider).toBe('toy-encoder');
    expect(corpus.comprehendo).toBe('0.1');
  });

  it('carries the topic index, every topic body, the twins and the fingerprints', async () => {
    const corpus = await packed();

    expect(corpus.docs.index).toEqual(['encode', 'decode']);
    expect(corpus.docs.topics['encode']?.summary).toContain('encode');
    expect(corpus.twins.entries.map((entry) => entry.code)).toEqual([
      'TOY_0_RANGEERROR',
      'TOY_1_TYPEERROR',
    ]);
    expect(corpus.fingerprints.map((print) => print.errorClass)).toEqual([
      'RangeError',
      'TypeError',
    ]);
  });

  it('binds every fingerprint to a code the packed catalog carries', async () => {
    const corpus = await packed();

    // The router resolves a match with `builder.twinFor(entry.corpusEntryId)`,
    // so `corpusEntryId` IS the twin code, not the authoring twin id. A
    // fingerprint pointing anywhere else matches and then hands back
    // UNSTRUCTURED, which is the silent half-failure this binding prevents.
    const codes = corpus.twins.entries.map((entry) => entry.code);
    for (const print of corpus.fingerprints) expect(codes).toContain(print.corpusEntryId);
    expect(corpus.fingerprints.every((print) => print.package === 'toy-encoder')).toBe(true);
  });

  it('is a pure function of its input, so two packs of one corpus are byte-identical', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);
    await completeCorpus(tree);

    expect(serializeCorpus(pack(parse(tree.corpus)))).toBe(
      serializeCorpus(pack(parse(tree.corpus))),
    );
  });

  it('names the descriptor a published corpus package declares itself with', async () => {
    const corpus = await packed();

    expect(CORPUS_DESCRIPTOR_KEY).toBe('comprehendoCorpus');
    expect(corpusDescriptor(corpus)).toEqual({
      target: 'toy-encoder',
      format: CORPUS_PACKED_FORMAT,
      artifact: CORPUS_ARTIFACT,
    });
  });
});

describe('validate runs before pack; a corpus that fails validation is never packed', () => {
  it('refuses a corpus with a schema-escaping fix, naming the violation', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);
    await completeCorpus(tree);
    const file = readJsonFile(tree.paths.fixes);
    const fixes = file['fixes'] as Record<string, Record<string, unknown>[]>;
    const first = Object.values(fixes)[0];
    if (first?.[0] !== undefined) first[0]['apply'] = { dropDatabase: 1 };
    writeJsonFile(tree.paths.fixes, { ...file, fixes });
    const corpus = parse(tree.corpus);

    expect(() => pack(corpus)).toThrow(CorpusFormatError);
    expect(() => pack(corpus)).toThrow(/schema-escaping-fix/);
    expect(() => pack(corpus)).toThrow(/dropDatabase/);
  });

  it('refuses a corpus that still carries a stub, because the format cannot say so', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);
    const corpus = parse(tree.corpus);

    expect(() => pack(corpus)).toThrow(/stub-field/);
  });

  it('carries every violation on the raised error, not only in its message', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);

    try {
      pack(parse(tree.corpus));
      expect.unreachable('an unfinished corpus is never packed');
    } catch (error) {
      expect(error).toBeInstanceOf(CorpusFormatError);
      expect((error as CorpusFormatError).violations.length).toBeGreaterThan(0);
    }
  });
});

describe('the packed artifact is loaded by the runtime with no directory access', () => {
  it('is exactly one file, and it round trips through its own loader', async () => {
    const corpus = await packed();
    const site = published(corpus);

    expect(readdirSync(site.dir)).toEqual([CORPUS_ARTIFACT]);
    expect(site.read()).toEqual(corpus);
  });

  it('answers a docs query through the Docs Engine [13] runtime, unchanged', async () => {
    const corpus = await packed();
    const docs = (await coreModule('docs')) as {
      parsePackedCorpus: (raw: unknown) => unknown;
      createDocs: (packed: unknown, options: unknown) => (query?: string) => Record<string, unknown>;
    };

    // The docs section IS Docs Engine's own `packed: 1` artifact, so its own
    // loader is the acceptance test for it, exactly as 17's `pack` does.
    const surface = docs.createDocs(docs.parsePackedCorpus(published(corpus).read().docs), {
      sink: (): void => undefined,
    });

    expect(surface()['topics']).toEqual(['encode', 'decode']);
    expect(surface('encode')['topic']).toBe('encode');
    expect(surface('encode')['summary']).toContain('encode');
  });

  it('matches a real thrown error and hands back the cataloged twin', async () => {
    const corpus = await packed();
    const loaded = published(corpus).read();
    const twin = (await coreModule('twin')) as {
      createTwinBuilder: (catalog: unknown) => {
        twinFor: (code: string, raw: unknown) => Record<string, unknown>;
      };
    };

    const thrown = new RangeError('input must not be empty');
    const match = buildFingerprintIndex(loaded.fingerprints).match(thrown);

    expect(match.outcome).toBe('matched');
    if (match.outcome !== 'matched') return;
    const built = twin.createTwinBuilder(loaded.twins).twinFor(match.entry.corpusEntryId, thrown);
    expect(built['code']).toBe('TOY_0_RANGEERROR');
    expect(built['reason']).toContain('The toy encoder refused this call');
    expect((built['fixes'] as { title: string }[])[0]?.title).toBe('Pass a non-empty payload');
  });

  it('does not match an error nothing in the corpus catalogs', async () => {
    const loaded = published(await packed()).read();

    const match = buildFingerprintIndex(loaded.fingerprints).match(
      new Error('some entirely other failure'),
    );

    expect(match.outcome).toBe('miss');
  });
});

describe('a loader that cannot read an artifact version fails clearly, never lossily', () => {
  it('refuses a corpus_packed version this build does not understand, naming both', async () => {
    const corpus = await packed();
    const site = scratch('comprehendo-28-future-');
    trees.push(site.cleanup);
    writeJsonFile(join(site.path, CORPUS_ARTIFACT), {
      ...corpus,
      corpus_packed: CORPUS_PACKED_FORMAT + 1,
    });

    const read = (): unknown =>
      readPackedCorpus(
        JSON.parse(readFileSync(join(site.path, CORPUS_ARTIFACT), 'utf8')) as unknown,
      );

    expect(read).toThrow(RangeError);
    expect(read).toThrow(new RegExp(String(CORPUS_PACKED_FORMAT + 1)));
    expect(read).toThrow(new RegExp(`reads version ${String(CORPUS_PACKED_FORMAT)}`));
  });

  it('refuses an artifact that declares no version at all', async () => {
    const corpus = await packed();
    const { corpus_packed: _dropped, ...versionless } = corpus;

    expect(() => readPackedCorpus(versionless)).toThrow(TypeError);
  });

  it('refuses an artifact whose docs half its own runtime would reject', () => {
    expect(() =>
      readPackedCorpus({
        comprehendo: '0.1',
        corpus_packed: CORPUS_PACKED_FORMAT,
        package: 'toy',
        provider: 'toy',
        docs: { comprehendo: '0.1', packed: 1, provider: 'toy', index: ['gone'], topics: {} },
        twins: { declaredSchema: { surface: 'toy', operations: [] }, topics: [], entries: [] },
        fingerprints: [],
      }),
    ).toThrow(/gone/);
  });
});
