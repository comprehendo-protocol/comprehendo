// The conformance kit, fed to the REAL validator.
//
// Not a content assertion: every fixture below is turned into a provider
// catalog and pushed through `validateCatalog` / `auditTwin`, the same
// functions the builder itself runs at build time. The negative kit's two
// twin-builder fixtures (raw-error-leak, CC3 [08]; schema-escaping-fix,
// CC7 [09]) must FAIL here, each for the exact reason its own `violation`
// block names, and the positive kit must pass byte-for-byte.

import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import {
  auditTwin,
  createTwinBuilder,
  TwinCatalogError,
  unstructuredTwin,
  validateCatalog,
} from '../src/twin.js';
import type { CatalogEntry, Fix, ProviderCatalog, Twin } from '../src/twin.js';

interface KitStep {
  readonly step: string;
  readonly surface: string;
  readonly shape: string;
  readonly response: Twin;
}

interface KitFixture {
  readonly fixture: string;
  readonly steps: readonly KitStep[];
  readonly declared_schema?: { readonly surface: string; readonly operations: string[] };
  readonly raw_error?: string;
  readonly violation?: {
    readonly rule: string;
    readonly gate: string;
    readonly reason: string;
    readonly locator: string;
    readonly message: string;
  };
}

const readFixture = (kit: 'fixtures' | 'negative', name: string): KitFixture =>
  JSON.parse(
    readFileSync(new URL(`../../spec/kit/${kit}/${name}.json`, import.meta.url), 'utf8'),
  ) as KitFixture;

/** A twin from the kit, read back as the catalog entry that would produce it. */
const entryOf = (twin: Twin): CatalogEntry => ({
  code: twin.code,
  reason: twin.reason,
  fixes: twin.fixes,
  ...(twin.path !== undefined ? { path: twin.path } : {}),
  ...(twin.namespace !== undefined ? { namespace: twin.namespace } : {}),
  ...(twin.declared !== undefined ? { declared: twin.declared } : {}),
  ...(twin.received !== undefined ? { received: twin.received } : {}),
  ...(twin.accepts !== undefined ? { accepts: twin.accepts } : {}),
});

/** Every topic any fix in this twin points at, so `docs` resolves by construction. */
const topicsOf = (twin: Twin): string[] =>
  twin.fixes.map((fix) => fix.docs).filter((topic): topic is string => topic !== undefined);

describe('schema-escaping-fix fails the CC7 [09] gate for its own named reason', () => {
  const fixture = readFixture('negative', 'schema-escaping-fix');
  const twin = fixture.steps[0]?.response as Twin;
  const declared = fixture.declared_schema;

  const asCatalog = (fixes: readonly Fix[]): ProviderCatalog => ({
    declaredSchema: { surface: declared?.surface ?? '', operations: declared?.operations ?? [] },
    topics: topicsOf(twin),
    entries: [{ ...entryOf(twin), fixes }],
  });

  test('the real validator rejects it, once, with the fixture rule and reason', () => {
    const violations = validateCatalog(asCatalog(twin.fixes));

    // The fixture names this component as the gate that owes the rejection,
    // so the rejection is asserted against the fixture's own claim, never
    // against a string this test made up.
    expect(fixture.violation?.gate).toBe('twin-builder');
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe(fixture.violation?.rule);
    expect(violations[0]?.reason).toBe(fixture.violation?.reason);
  });

  test('the diagnostic names $out, the operation the provider never declared', () => {
    const violations = validateCatalog(asCatalog(twin.fixes));

    expect(violations[0]?.message).toContain('$out');
    expect(fixture.violation?.message).toContain('$out');
  });

  test('the violation locator agrees with the fixture locator', () => {
    const violations = validateCatalog(asCatalog(twin.fixes));

    expect(violations[0]?.locator).toBe('entries[0].fixes[1].apply');
    expect(fixture.violation?.locator.endsWith('fixes[1].apply')).toBe(true);
  });

  test('a build of this catalog fails, it never produces a builder', () => {
    expect(() => createTwinBuilder(asCatalog(twin.fixes))).toThrow(TwinCatalogError);
  });

  test('the sibling fix is inside the schema, so only the escaping one fails', () => {
    const conforming = twin.fixes[0] as Fix;

    expect(validateCatalog(asCatalog([conforming]))).toEqual([]);
    expect(createTwinBuilder(asCatalog([conforming])).codes).toEqual([twin.code]);
  });
});

describe('raw-error-leak fails the CC3 [08] gate for its own named reason', () => {
  const fixture = readFixture('negative', 'raw-error-leak');
  const twin = fixture.steps[0]?.response as Twin;
  const raw = fixture.raw_error ?? '';

  test('the real audit rejects it, with the fixture reason, pointing at reason', () => {
    const violations = auditTwin(twin, raw);

    expect(fixture.violation?.gate).toBe('twin-builder');
    expect(violations.map((violation) => violation.reason)).toContain(fixture.violation?.reason);
    expect(violations[0]?.rule).toBe(fixture.violation?.rule);
    expect(violations[0]?.locator).toBe('reason');
    expect(fixture.violation?.locator.endsWith('reason')).toBe(true);
  });

  test('the audit also catches the raw text having been dropped from received', () => {
    const violations = auditTwin(twin, raw);

    expect(violations.map((violation) => violation.reason)).toContain('raw-error-discarded');
  });

  test('this builder handles the same raw error correctly, which is the contrast', () => {
    const honest = unstructuredTwin(raw);

    expect(auditTwin(honest, raw)).toEqual([]);
    expect(honest.received).toBe(raw);
    expect(honest.reason).not.toBe(raw);
  });
});

describe('twin-round-trip: the positive kit passes through the real builder', () => {
  const fixture = readFixture('fixtures', 'twin-round-trip');
  const responses = fixture.steps.map((step) => step.response);
  const structured = responses[0] as Twin;
  const unstructured = responses[1] as Twin;
  const docsOnly = responses[2] as Twin;

  const catalogFor = (twin: Twin): ProviderCatalog => ({
    declaredSchema: {
      surface: 'aggregate(pipeline)',
      operations: ['$match', '$sort', '$limit', '$project', '$group', '$count'],
    },
    topics: ['index selection', 'capped collections'],
    entries: [entryOf(twin)],
  });

  test('the fully structured twin round-trips field for field', () => {
    const built = createTwinBuilder(catalogFor(structured)).build(structured.code);

    expect(built).toEqual(structured);
  });

  test('and serializes in the kit key order, so both kits stay byte-identical', () => {
    const built = createTwinBuilder(catalogFor(structured)).build(structured.code);

    expect(Object.keys(built)).toEqual(Object.keys(structured));
  });

  test('the unstructured passthrough is exactly what unstructuredTwin produces', () => {
    const built = unstructuredTwin(unstructured.received);

    expect(built).toEqual(unstructured);
    expect(Object.keys(built)).toEqual(Object.keys(unstructured));
  });

  test('the docs-only twin round-trips, its pointer resolving against the index', () => {
    const built = createTwinBuilder(catalogFor(docsOnly)).build(docsOnly.code);

    expect(built).toEqual(docsOnly);
  });

  test('every cataloged fix in the positive kit is inside the declared schema', () => {
    for (const twin of [structured, docsOnly]) {
      expect(validateCatalog(catalogFor(twin))).toEqual([]);
    }
  });

  test('and no twin in the positive kit leaks its raw error', () => {
    for (const twin of responses) {
      expect(auditTwin(twin, typeof twin.received === 'string' ? twin.received : undefined)).toEqual(
        [],
      );
    }
  });
});
