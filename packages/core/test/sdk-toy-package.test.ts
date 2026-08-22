/**
 * 14-sdk-entry, the acceptance suite: "a toy package built with the SDK
 * passes the full kit."
 *
 * The toy package is built once with `makeProvider` and then walked through
 * the conformance kit's own probe-hit transcript, step by step, plus the
 * discovery, twin, and docs paths the doc's acceptance criteria name. Shapes
 * are checked against the REQUIRED keys of the kit's JSON Schemas, read off
 * the schema files themselves, so this suite cannot drift from the spec
 * package while still reading green.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { hasMarker, probe } from '../src/marker.js';
import { makeProvider, type Provider } from '../src/sdk.js';
import * as barrel from '../src/index.js';
import { KIT_ROOT, at, readKitJson } from './helpers/source-scan.js';
import {
  TOY_PRIMING,
  TOY_RAW_CATALOGED,
  TOY_RAW_NOVEL,
  toyCorpus,
  toyHooks,
  toyRuntime,
  type ToyOptions,
} from './helpers/toy-provider.js';

interface BudgetRecord {
  readonly scope: string;
  readonly measured: number;
  readonly limit: number;
  readonly pass: boolean;
}
interface BudgetKit {
  readonly measureScope: (scope: string, payload: unknown) => BudgetRecord;
}
const kitUrl = new URL('../../spec/kit/budget/measure.js', import.meta.url).href;
const { measureScope } = (await import(kitUrl)) as BudgetKit;

const toy = (options: ToyOptions = {}): Provider =>
  makeProvider(options.corpus ?? toyCorpus(), toyHooks(options));

/** The `required` list of a kit shape schema, read from the schema itself. */
const requiredKeys = (schema: string): string[] =>
  (at(readKitJson('shapes', schema), 'required') as string[] | undefined) ?? [];

const carries = (value: unknown, schema: string): void => {
  const keys = requiredKeys(schema);
  expect(keys.length, `${schema} declares no required keys`).toBeGreaterThan(0);
  for (const key of keys) {
    expect(value, `${schema} requires "${key}"`).toHaveProperty(key);
  }
};

const kitStep = (index: number, field: string): unknown =>
  at(readKitJson('fixtures', 'probe-hit.json'), 'steps', String(index), field);

describe('the toy package, discovery', () => {
  it('answers a probe on the package export with an entry carrying every required key', () => {
    const provider = toy();

    const entry = probe(provider);

    carries(entry, 'entry.schema.json');
    expect(entry).toMatchObject({ name: 'mongodb-operator', level: 2 });
  });

  it('carries the same entry fields the kit probe-hit transcript returns', () => {
    const provider = toy();

    const kitEntry = kitStep(0, 'response') as Record<string, unknown>;

    expect(Object.keys(provider.entry).sort()).toEqual(Object.keys(kitEntry).sort());
    expect(provider.entry.surfaces).toEqual(kitEntry['surfaces']);
  });

  it('stamps a manifest declaration carrying every key the manifest schema requires', () => {
    carries(toy().manifest, 'manifest.schema.json');
  });

  it('marks all three value shapes: the export, a raised error, and a controlled handle', () => {
    const provider = toy();
    const handle = provider.mark({ close: (): void => undefined });
    const error = provider.errorFor(TOY_RAW_CATALOGED);

    expect([hasMarker(provider), hasMarker(error), hasMarker(handle)]).toEqual([true, true, true]);
    expect([probe(error), probe(handle)]).toEqual([provider.entry, provider.entry]);
  });

  it("carries the provider's own priming snippet onto the entry, verbatim", () => {
    const reference = readFileSync(
      join(KIT_ROOT, 'budget', 'fixtures', 'priming.reference.md'),
      'utf8',
    ).trim();

    expect(TOY_PRIMING).toBe(reference);
    expect(toy().entry.priming).toBe(reference);
    expect(makeProvider(toyCorpus(), { ...toyHooks(), priming: 'probe, then ask docs' }).entry.priming).toBe(
      'probe, then ask docs',
    );
  });

  it('carries a priming snippet that measures under the CC5 priming budget', () => {
    const record = measureScope('priming', toy().entry.priming);

    // The floor is not decoration: an empty snippet would sail under any
    // budget, so "passes the budget" only means something next to "is a real
    // snippet" (the kit's reference measures 127 tokens against a 150 cap).
    expect(record.measured).toBeGreaterThan(100);
    expect(record.pass, `priming is ${record.measured} tokens, budget ${record.limit}`).toBe(true);
  });

  it('refuses to build a provider with no priming snippet, rather than shipping a blank claim', () => {
    expect(() => makeProvider(toyCorpus(), { ...toyHooks(), priming: '' })).toThrow(/priming/i);
  });
});

describe('the toy package, twins at the throw sites', () => {
  it('hands a cataloged failure back as a twin whose first fix is schema-bound', () => {
    const provider = toy();

    const error = provider.errorFor(TOY_RAW_CATALOGED);

    carries(error.twin, 'twin.schema.json');
    expect(error.twin.fixes.length).toBeGreaterThan(0);
    carries(error.twin.fixes[0], 'fix.schema.json');
  });

  it('marks a novel failure UNSTRUCTURED rather than guessing a fix', () => {
    const twin = toy().twinFor(TOY_RAW_NOVEL);

    carries(twin, 'twin.schema.json');
    expect(twin.code).toBe('UNSTRUCTURED');
    expect(twin.received).toBe(TOY_RAW_NOVEL);
    expect(twin.fixes).toEqual([]);
  });
});

describe('the toy package, docs in three vocabularies', () => {
  const provider = (): Provider => toy();

  it("answers in the tool's own terms", () => {
    expect(provider().docs('$group')).toMatchObject({ topic: '$group' });
  });

  it("answers in another tool's terms", () => {
    expect(provider().docs('the SQL equivalent of GROUP BY')).toMatchObject({ topic: '$group' });
  });

  it('answers in plain task language', () => {
    expect(provider().docs('how to count events per key')).toMatchObject({ topic: '$group' });
  });

  it('answers a miss with UNDOCUMENTED, never an empty result or a wrong topic', () => {
    const answer = provider().docs('how do I transcode a video');

    carries(answer, 'undocumented.schema.json');
    expect(answer).toMatchObject({ code: 'UNDOCUMENTED', source_permitted: true });
  });

  it('returns the index as names only, exactly what the kit transcript shows', () => {
    expect(provider().docs()).toEqual({ topics: toyCorpus().index });
  });

  it('logs every lookup, hit and miss, to the local sink and nowhere else', () => {
    const runtime = toyRuntime();
    const built = makeProvider(toyCorpus(), toyHooks({ runtime }));

    built.docs();
    built.docs('$group');
    built.docs('how do I transcode a video');

    expect(runtime.lookups.map((entry) => entry.result)).toEqual(['index', 'hit', 'miss']);
    expect(built.docs.logStats()).toEqual({ written: 3, failed: 0 });
  });
});

describe('the toy package, the level-2 transcript', () => {
  it('abstains exactly as the kit step 4 abstains, on the kit step 4 input', () => {
    const provider = toy();

    const verdict = provider.validate?.(kitStep(3, 'input'));

    carries(verdict, 'unvalidatable.schema.json');
    expect(verdict).toMatchObject({ valid: null, code: 'UNVALIDATABLE' });
  });

  it('explains the kit step 5 input without executing it', () => {
    const runtime = toyRuntime();
    const provider = makeProvider(toyCorpus(), toyHooks({ runtime }));

    const explanation = provider.explain?.(kitStep(4, 'input'));

    carries(explanation, 'explanation.schema.json');
    expect(runtime.executions).toBe(0);
  });

  it('a Level 1 build of the same toy package simply has no judge surfaces', () => {
    const level1 = toy({ judge: 'none' });

    expect(level1.manifest.level).toBe(1);
    expect(Object.keys(level1)).not.toContain('validate');
    expect(Object.keys(level1)).not.toContain('explain');
  });
});

describe('the public surface a consumer imports', () => {
  it('exports makeProvider from the package barrel, not just from the module', () => {
    expect(barrel.makeProvider).toBe(makeProvider);
  });

  it('builds a working provider through the barrel entry point alone', () => {
    const provider = barrel.makeProvider(toyCorpus(), toyHooks({ judge: 'none' }));

    expect(hasMarker(provider)).toBe(true);
    expect(provider.docs()).toMatchObject({ topics: expect.any(Array) as unknown[] });
  });
});
