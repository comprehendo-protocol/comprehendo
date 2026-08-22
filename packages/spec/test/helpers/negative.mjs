// Shared test helper for the must-fail kit (Negative Fixtures [05]).
//
// One place that knows where the negative fixtures live, what the envelope
// adds on top of the positive kit's, and which contract each fixture is the
// must-fail proof for. Every negative test file imports from here; nothing
// re-inlines the loader.
//
// The envelope is deliberately NOT re-declared: the step keys, the surface
// vocabulary and the canonical serializer are imported from the positive
// kit's helper, so "same fixture format as Conformance Fixtures [04]" is
// enforced by the code instead of promised by a comment.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonical, STEP_ANNOTATIONS, STEP_HEAD, STEP_TAIL, SURFACES } from './fixtures.mjs';

export { canonical, STEP_ANNOTATIONS, STEP_HEAD, STEP_TAIL, SURFACES };

export const NEGATIVE_DIR = fileURLToPath(
  new URL('../../kit/negative/', import.meta.url),
);

/**
 * The six must-fail fixtures the doc requires, one per load-bearing rule
 * (05-negative-fixtures.md, Implementation Notes). Asserted as an exact set:
 * a kit that quietly loses the telemetry fixture still passes every per-file
 * test, so the roster itself is a test.
 */
export const EXPECTED_NEGATIVE_FIXTURES = Object.freeze([
  'computed-marker.json',
  'oversized-topic.json',
  'provider-side-corpus-veto.json',
  'raw-error-leak.json',
  'schema-escaping-fix.json',
  'telemetry-attempt.json',
]);

/**
 * What each fixture is the must-fail proof FOR, stated here so a CI failure
 * reads as "raw-error-leak fixture unexpectedly passed" and never as a bare
 * red X. Keyed by the fixture's `reason`, which equals its scenario and its
 * file stem.
 *
 * `enforced` is the honest answer to "can this kit actually run the gate
 * today": as of comprehendo-wave-2, four of six gates exist (CC5/Budget
 * Harness [06] in wave 1; CC3/CC9 in wave 2 via Twin Builder [12] and
 * Marker & Probe [11]; CC7 in wave 2 via Twin Builder [12]). CC6 and CC8
 * land with their own contract's component, in the wave named here, and
 * this table is what stops that deferral from being silent.
 */
export const CONTRACTS = Object.freeze({
  'raw-error-leak': Object.freeze({
    rule: 'CC3',
    contract: '08-cc3-no-raw-errors',
    wave: 'comprehendo-wave-2',
    gate: 'twin-builder',
    enforced: true,
  }),
  'oversized-topic': Object.freeze({
    rule: 'CC5',
    contract: '02-cc5-context-budget',
    wave: 'comprehendo-wave-1',
    gate: 'budget-harness',
    enforced: true,
  }),
  'schema-escaping-fix': Object.freeze({
    rule: 'CC7',
    contract: '09-cc7-schema-bound-fixes',
    wave: 'comprehendo-wave-2',
    gate: 'twin-builder',
    enforced: true,
  }),
  'telemetry-attempt': Object.freeze({
    rule: 'CC6',
    contract: '27-cc6-no-telemetry',
    wave: 'comprehendo-wave-5',
    gate: 'submission-gate',
    enforced: false,
  }),
  'provider-side-corpus-veto': Object.freeze({
    rule: 'CC8',
    contract: '19-cc8-native-precedence',
    wave: 'comprehendo-wave-4',
    gate: 'manifest-scan',
    enforced: false,
  }),
  'computed-marker': Object.freeze({
    rule: 'CC9',
    contract: '10-cc9-marker-freeze',
    wave: 'comprehendo-wave-2',
    gate: 'marker-scan',
    enforced: true,
  }),
});

/**
 * The envelope: the positive kit's head, plus `violation`, which is what makes
 * a negative fixture negative. Scenario extras sit between it and the
 * transcript, which stays last.
 */
export const ENVELOPE_HEAD = Object.freeze(['fixture', 'title', 'scenario', 'rfc', 'violation']);

/** Scenario-specific envelope keys, the only ones allowed between head and steps. */
export const ENVELOPE_EXTRAS = Object.freeze([
  'budget',
  'declared_schema',
  'marker',
  'network_evidence',
  'raw_error',
  'suppression',
]);

/**
 * The violation block, in order. `locator` points INTO this fixture at the
 * one non-conforming value; `message` is the diagnostic the gate owes, so
 * "right rejection, wrong diagnostic" is a failure the doc's must-not names.
 */
export const VIOLATION_KEYS = Object.freeze([
  'rule',
  'contract',
  'wave',
  'gate',
  'reason',
  'locator',
  'message',
  'enforced',
]);

/** Every negative fixture file actually present on disk, sorted. */
export function listNegativeFixtureFiles() {
  return readdirSync(NEGATIVE_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

/** The raw bytes of one negative fixture file, as text. */
export function readNegativeText(file) {
  return readFileSync(join(NEGATIVE_DIR, file), 'utf8');
}

/** Read one negative fixture file as parsed JSON. Throws if absent or malformed. */
export function readNegative(file) {
  return JSON.parse(readNegativeText(file));
}

/** Every negative fixture on disk as a Map of file name to parsed JSON. */
export function readAllNegative() {
  return new Map(listNegativeFixtureFiles().map((file) => [file, readNegative(file)]));
}

/** Every step of every negative fixture, tagged with the file it came from. */
export function allNegativeSteps() {
  const out = [];
  for (const [file, fixture] of readAllNegative()) {
    (fixture.steps ?? []).forEach((step, index) => {
      out.push({ file, index, fixture, step });
    });
  }
  return out;
}

/**
 * One negative fixture by its `reason` (equivalently, its file stem), with a
 * message that names the kit when it is absent. This is the accessor the
 * per-violation tests use, so a test always reads as "the raw-error-leak
 * fixture", never as "file number 4".
 */
export function negativeFixture(reason) {
  const file = `${reason}.json`;
  if (!listNegativeFixtureFiles().includes(file)) {
    throw new Error(`the negative kit has no ${reason} fixture in ${NEGATIVE_DIR}`);
  }
  return readNegative(file);
}

/** The single step of a one-step fixture, or the step at `index`. */
export function stepOf(fixture, index = 0) {
  return fixture.steps[index];
}

/**
 * Resolve a `violation.locator` against its own fixture, e.g.
 * `steps[0].response.fixes[1].apply` or `marker.computed`. A locator that
 * resolves to `undefined` is a fixture pointing at nothing, which is the
 * quiet way a negative kit stops describing its own violation.
 *
 * @param {unknown} fixture
 * @param {string} locator
 */
export function resolveLocator(fixture, locator) {
  let node = fixture;
  for (const segment of locator.split('.')) {
    const [, key, indexes] = /^([^[]+)((?:\[\d+\])*)$/.exec(segment) ?? [];
    if (key === undefined) return undefined;
    node = node?.[key];
    for (const index of indexes.match(/\d+/g) ?? []) node = node?.[Number(index)];
  }
  return node;
}
