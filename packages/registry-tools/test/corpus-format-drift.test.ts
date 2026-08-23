// The constants and shapes Corpus Format [28] duplicates are owned elsewhere.
//
// registry-tools takes no runtime import from core (the packages install
// independently, and a `../../core/src` import from `src/` breaks rootDir), so
// this component carries its own copy of the authoring format's version and
// stub sentinel, of the packed docs format version, and of the required-field
// sets Shape Schemas [03] defines. Per the duplication rule, every copy owes a
// test asserting both values match. That is this file.
//
// It reads the ORIGINALS off disk (core's source, the spec's JSON Schemas),
// never a restatement of them, so the copies cannot drift quietly.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTHORING_FILES,
  AUTHORING_FORMAT,
  COMPREHENDO_VERSION,
  PACKED_DOCS_FORMAT,
  STUB,
  parse,
  pack,
} from '../src/corpus-format.js';
import { parseFrontMatter } from '../src/corpus-front-matter.js';
import { authoredTree, coreModule, completeCorpus } from './helpers/authored-corpus.js';

const PACKAGES = join(import.meta.dirname, '..', '..');

const read = (...parts: readonly string[]): string => readFileSync(join(PACKAGES, ...parts), 'utf8');

/** The literal a `export const NAME = <value>` declaration carries in core. */
const declared = (source: string, name: string): string => {
  const found = new RegExp(`export const ${name} =\\s*(?:'([^']*)'|(\\d+))`).exec(source);
  expect(found, `core no longer declares ${name} as a plain literal`).not.toBeNull();
  return found?.[1] ?? found?.[2] ?? '';
};

const trees: (() => void)[] = [];

afterEach(() => {
  while (trees.length > 0) trees.pop()?.();
});

describe('the authoring format this component reads is the one [17] writes', () => {
  it('reads the same corpus_authoring version core writes', () => {
    expect(String(AUTHORING_FORMAT)).toBe(declared(read('core', 'src', 'cli', 'format.ts'), 'AUTHORING_FORMAT'));
  });

  it('recognises the same status: stub sentinel core writes', () => {
    expect(STUB).toBe(declared(read('core', 'src', 'cli', 'format.ts'), 'STUB'));
  });

  it('looks for the five file names the corpusPaths in core builds', () => {
    const io = read('core', 'src', 'cli', 'corpus-io.ts');

    for (const file of AUTHORING_FILES) expect(io).toContain(`'${file}'`);
    expect(AUTHORING_FILES).toEqual(['manifest.json', 'index.json', 'topics', 'twins.json', 'fixes.json']);
  });

  it('carries the same comprehendo version the docs engine stamps', () => {
    expect(COMPREHENDO_VERSION).toBe(declared(read('core', 'src', 'docs.ts'), 'COMPREHENDO_VERSION'));
  });

  it('emits the docs half at the packed format version that loader reads', () => {
    expect(String(PACKED_DOCS_FORMAT)).toBe(
      declared(read('core', 'src', 'docs.ts'), 'PACKED_CORPUS_FORMAT'),
    );
  });
});

describe('the front-matter dialect agrees with the emitter that wrote the file', () => {
  it('reads a real 17-written topic header to the mapping the core parser gives', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);
    await completeCorpus(tree);
    const file = readFileSync(join(tree.corpus, 'topics', 'encode.md'), 'utf8');
    const frontMatter = (await import(
      /* @vite-ignore */ new URL(
        `file://${join(PACKAGES, 'core', 'src', 'cli', 'front-matter.ts')}`,
      ).href
    )) as {
      splitFrontMatter: (markdown: string) => { header: string; body: string };
      parseYaml: (source: string) => unknown;
    };

    const mine = parseFrontMatter(file);
    const theirs = frontMatter.parseYaml(frontMatter.splitFrontMatter(file).header);

    expect(mine.header).toEqual(theirs);
    expect(mine.body.trim()).toBe(frontMatter.splitFrontMatter(file).body.trim());
  });
});

describe('the packed artifact carries every field Shape Schemas [03] requires', () => {
  it('gives every packed twin entry the fields twin.schema.json requires', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);
    await completeCorpus(tree);
    const schema = JSON.parse(read('spec', 'kit', 'shapes', 'twin.schema.json')) as {
      required: readonly string[];
    };
    const twin = (await coreModule('twin')) as {
      createTwinBuilder: (catalog: unknown) => { build: (code: string) => Record<string, unknown> };
    };

    const packedCorpus = pack(parse(tree.corpus));
    const built = twin
      .createTwinBuilder(packedCorpus.twins)
      .build(packedCorpus.twins.entries[0]?.code ?? '');

    for (const field of schema.required) expect(Object.keys(built)).toContain(field);
  });

  it('gives every packed fix the fields fix.schema.json requires', async () => {
    const tree = await authoredTree();
    trees.push(tree.cleanup);
    await completeCorpus(tree);
    const schema = JSON.parse(read('spec', 'kit', 'shapes', 'fix.schema.json')) as {
      required: readonly string[];
      anyOf?: readonly { required: readonly string[] }[];
    };

    const fixes = pack(parse(tree.corpus)).twins.entries.flatMap((entry) => entry.fixes);

    expect(fixes.length).toBeGreaterThan(0);
    for (const fix of fixes) {
      for (const field of schema.required) expect(Object.keys(fix)).toContain(field);
      // The schema's own "at least one of apply or docs" rule, which is also
      // what CC7 [09] calls fix-without-remedy.
      expect(fix.apply !== undefined || fix.docs !== undefined).toBe(true);
    }
  });
});
