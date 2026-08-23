// Corpus Format [28]: `validate`, the gate a corpus passes before it is packed.
//
// Every case starts from a corpus Corpus Generator [17] really wrote and then
// breaks exactly one thing in it, so what the assertion proves is that the
// named check fires, not that a hand-typed shape happens to fail.
//
// The CC7 [09] half is held to core's own gate by an agreement test at the
// bottom: `validateCatalog` in packages/core/src/twin-validate.ts is the
// native tier's enforcement of the same contract, and "one discipline, two
// tiers" is a claim this suite has to be able to fail.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { catalogOf, parse, validate } from '../src/corpus-format.js';
import type { CorpusSource, CorpusViolation } from '../src/corpus-format.js';
import {
  authoredTree,
  coreModule,
  completeCorpus,
  readJsonFile,
  writeJsonFile,
} from './helpers/authored-corpus.js';

const trees: (() => void)[] = [];

afterEach(() => {
  while (trees.length > 0) trees.pop()?.();
});

/** A real corpus, optionally broken in one named way before it is parsed. */
async function corpusWith(
  damage: (tree: Awaited<ReturnType<typeof authoredTree>>) => void = () => undefined,
  complete = true,
): Promise<CorpusSource> {
  const tree = await authoredTree();
  trees.push(tree.cleanup);
  if (complete) await completeCorpus(tree);
  damage(tree);
  return parse(tree.corpus);
}

const reasons = (found: readonly CorpusViolation[]): string[] =>
  found.map((violation) => violation.reason);

const editTwins = (
  tree: Awaited<ReturnType<typeof authoredTree>>,
  edit: (twins: Record<string, unknown>[]) => void,
): void => {
  const file = readJsonFile(tree.paths.twins);
  const twins = file['twins'] as Record<string, unknown>[];
  edit(twins);
  writeJsonFile(tree.paths.twins, { ...file, twins });
};

const editFixes = (
  tree: Awaited<ReturnType<typeof authoredTree>>,
  edit: (fixes: Record<string, Record<string, unknown>[]>) => void,
): void => {
  const file = readJsonFile(tree.paths.fixes);
  const fixes = file['fixes'] as Record<string, Record<string, unknown>[]>;
  edit(fixes);
  writeJsonFile(tree.paths.fixes, { ...file, fixes });
};

describe('validate accepts a conforming corpus', () => {
  it('reports nothing at all for the corpus Corpus Generator [17] wrote and a human finished', async () => {
    expect(validate(await corpusWith())).toEqual([]);
  });
});

describe('validate rejects a corpus violating the CC7 [09] schema-bound-fix rule', () => {
  it('names a fix whose apply expresses an operation the provider never declared', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) first[0]['apply'] = { dropDatabase: 1 };
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('schema-escaping-fix');
    expect(found.find((v) => v.reason === 'schema-escaping-fix')?.message).toContain('dropDatabase');
    expect(found.find((v) => v.reason === 'schema-escaping-fix')?.rule).toBe('CC7');
  });

  it('accepts a fix whose apply stays inside the declared call schema', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) first[0]['apply'] = { encode: 'a non-empty payload' };
      });
    });

    expect(validate(corpus)).toEqual([]);
  });

  it('names an apply the corpus expresses as prose rather than as literal call data', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) first[0]['apply'] = 'just call encode() with something';
      });
    });

    expect(reasons(validate(corpus))).toContain('unvalidatable-apply');
  });

  it('names an apply carried by a corpus that declares no call schema at all', async () => {
    const corpus = await corpusWith((tree) => {
      const manifest = readJsonFile(tree.paths.manifest);
      delete manifest['declared_schema'];
      writeJsonFile(tree.paths.manifest, manifest);
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) first[0]['apply'] = { encode: 'x' };
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('undeclared-call-schema');
    expect(found[0]?.rule).toBe('CC7');
  });

  it('leaves a corpus with no apply anywhere alone when it declares no call schema', async () => {
    const corpus = await corpusWith((tree) => {
      const manifest = readJsonFile(tree.paths.manifest);
      delete manifest['declared_schema'];
      writeJsonFile(tree.paths.manifest, manifest);
    });

    expect(validate(corpus)).toEqual([]);
  });

  it('names a fix whose docs pointer targets a topic the index does not carry', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) first[0]['docs'] = 'no-such-topic';
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('dangling-docs-pointer');
    expect(found[0]?.message).toContain('no-such-topic');
  });

  it('names a twin whose docs pointer targets a topic the index does not carry', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[0] !== undefined) twins[0]['docs'] = 'gone';
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('dangling-docs-pointer');
    expect(found.find((v) => v.reason === 'dangling-docs-pointer')?.locator).toContain('twins[0]');
  });

  it('names a fix that carries neither apply nor docs, so it remedies nothing', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) delete first[0]['docs'];
      });
    });

    expect(reasons(validate(corpus))).toContain('fix-without-remedy');
  });
});

describe('validate rejects a corpus violating Shape Schemas [03]', () => {
  it('names a cataloged failure carrying no fix at all', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        for (const id of Object.keys(fixes)) delete fixes[id];
      });
    });

    expect(reasons(validate(corpus))).toContain('empty-fixes');
  });

  it('names a fix with no title', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const first = Object.values(fixes)[0];
        if (first?.[0] !== undefined) first[0]['title'] = '   ';
      });
    });

    expect(reasons(validate(corpus))).toContain('fix-without-title');
  });

  it('names a twin that claims the reserved UNSTRUCTURED code', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[0] !== undefined) twins[0]['code'] = 'UNSTRUCTURED';
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('reserved-code');
    expect(found.find((v) => v.reason === 'reserved-code')?.rule).toBe('CC3');
  });

  it('names two twins published under one code, because a code means one thing', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[1] !== undefined) twins[1]['code'] = String(twins[0]?.['code']);
      });
    });

    expect(reasons(validate(corpus))).toContain('duplicate-code');
  });

  it('names a twin whose reason is empty', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[0] !== undefined) twins[0]['reason'] = '  ';
      });
    });

    expect(reasons(validate(corpus))).toContain('empty-reason');
  });

  it('names a reason that pastes the raw throw-site text back at the agent (CC3 [08])', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[0] !== undefined) twins[0]['reason'] = 'The call failed: input must not be empty';
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('raw-error-leak');
    expect(found.find((v) => v.reason === 'raw-error-leak')?.rule).toBe('CC3');
  });
});

describe('validate rejects a corpus violating the format itself', () => {
  it('names a topic file covering more than one topic', async () => {
    const corpus = await corpusWith((tree) => {
      const path = join(tree.corpus, 'topics', 'encode.md');
      writeFileSync(
        path,
        '---\ntopic: encode\nkind: function\nsource: src/encode.ts:5\n---\n\nOne topic.\n\n---\ntopic: also-encode\nkind: function\n---\n\nAnd a second.\n',
        'utf8',
      );
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('one-topic-per-file');
    expect(found.find((v) => v.reason === 'one-topic-per-file')?.message).toContain('also-encode');
  });

  it('names two index entries pointing at one file', async () => {
    const corpus = await corpusWith((tree) => {
      const index = readJsonFile(tree.paths.index);
      const topics = index['topics'] as Record<string, unknown>[];
      if (topics[1] !== undefined) topics[1]['file'] = 'topics/encode.md';
      writeJsonFile(tree.paths.index, { ...index, topics });
    });

    expect(reasons(validate(corpus))).toContain('two-topics-one-file');
  });

  it('names a topic file under topics/ that no index entry advertises', async () => {
    const corpus = await corpusWith((tree) => {
      writeFileSync(
        join(tree.corpus, 'topics', 'stray.md'),
        '---\ntopic: stray\n---\n\nNobody advertises this.\n',
        'utf8',
      );
    });

    expect(reasons(validate(corpus))).toContain('stray-topic-file');
  });

  it('names every field still carrying status: stub in a scanned but unfinished corpus', async () => {
    const corpus = await corpusWith(() => undefined, false);

    const found = validate(corpus);

    expect(reasons(found)).toContain('stub-field');
    // 17 marks a topic summary, and a twin's code and reason. Every one of
    // them is a field the packed format has no representation for.
    expect(found.filter((v) => v.reason === 'stub-field').length).toBeGreaterThanOrEqual(6);
  });

  it('names a topic serving no vocabulary, which nothing could ever reach', async () => {
    const corpus = await corpusWith((tree) => {
      const path = join(tree.corpus, 'topics', 'encode.md');
      writeFileSync(
        path,
        '---\ntopic: encode\nkind: function\nsource: src/encode.ts:5\nsignatures: []\nsee_also: []\nvocabularies_served:\n  own_terms: []\n  translations: []\n  task: []\n---\n\nA summary nobody can ask for.\n',
        'utf8',
      );
    });

    expect(reasons(validate(corpus))).toContain('topic-without-vocabulary');
  });

  it('names a twin declaring no matchable fingerprint facet', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[0] !== undefined) twins[0]['fingerprint'] = { source: 'src/encode.ts:7' };
      });
    });

    expect(reasons(validate(corpus))).toContain('unmatchable-fingerprint');
  });

  it('names a fixes.json entry keyed by a twin id no twin carries', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        fixes['src/gone.ts#gone#Error#gone'] = [{ title: 'A fix for nothing', docs: 'encode' }];
      });
    });

    expect(reasons(validate(corpus))).toContain('orphan-fix');
  });

  it('reports every violation in one pass rather than stopping at the first', async () => {
    const corpus = await corpusWith((tree) => {
      editTwins(tree, (twins) => {
        if (twins[0] !== undefined) twins[0]['reason'] = '';
        if (twins[1] !== undefined) twins[1]['code'] = 'UNSTRUCTURED';
      });
    });

    const found = validate(corpus);

    expect(reasons(found)).toContain('empty-reason');
    expect(reasons(found)).toContain('reserved-code');
  });
});

describe('one discipline, two tiers: this gate agrees with the native one (CC7 [09])', () => {
  it('reports the same violation reasons Twin Builder [12] reports for the same catalog', async () => {
    const corpus = await corpusWith((tree) => {
      editFixes(tree, (fixes) => {
        const entries = Object.values(fixes);
        if (entries[0]?.[0] !== undefined) entries[0][0]['apply'] = { dropDatabase: 1 };
        if (entries[1]?.[0] !== undefined) entries[1][0]['docs'] = 'no-such-topic';
      });
      editTwins(tree, (twins) => {
        if (twins[1] !== undefined) twins[1]['reason'] = '';
      });
    });
    const twinValidate = (await coreModule('twin')) as {
      validateCatalog: (catalog: unknown) => readonly { reason: string }[];
    };

    const native = new Set(twinValidate.validateCatalog(catalogOf(corpus)).map((v) => v.reason));
    const registry = new Set(reasons(validate(corpus)));

    expect(native.size).toBeGreaterThan(0);
    for (const reason of native) expect([...registry]).toContain(reason);
  });

  it('builds a catalog the real twin builder accepts when the corpus is conforming', async () => {
    const corpus = await corpusWith();
    const twin = (await coreModule('twin')) as {
      createTwinBuilder: (catalog: unknown) => { codes: readonly string[] };
    };

    const builder = twin.createTwinBuilder(catalogOf(corpus));

    expect([...builder.codes]).toEqual(corpus.twins.map((entry) => entry.code));
  });
});
