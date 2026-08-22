// Shared test helper for the conformance-fixture kit (Conformance Fixtures [04]).
//
// One place that knows where the fixtures live, what the envelope looks like,
// and which scenarios the kit is required to carry. Every fixture test file
// imports from here; nothing re-inlines the loader.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = fileURLToPath(
  new URL('../../kit/fixtures/', import.meta.url),
);

/**
 * The fixture files the kit MUST carry, one per scenario the source spec
 * names (mdd-comprehendo-spec.md lines 317-322). Asserted as an exact set:
 * a kit that quietly loses the disagreement fixture still passes every
 * per-file test, so the roster itself is a test.
 */
export const EXPECTED_FIXTURES = Object.freeze([
  'did-you-mean.json',
  'disagreement.json',
  'docs-three-vocabularies.json',
  'forward-compat.json',
  'probe-hit.json',
  'probe-mid-failure-discovery.json',
  'probe-miss.json',
  'twin-round-trip.json',
  'undocumented-source-pass.json',
]);

/** The scenario vocabulary. A fixture belongs to exactly one scenario. */
export const SCENARIOS = Object.freeze([
  'did-you-mean',
  'disagreement',
  'docs-lookup',
  'forward-compat',
  'probe-transcript',
  'source-pass',
  'twin-round-trip',
]);

/**
 * The surfaces a transcript step can exercise. `probe` and `manifest` are the
 * two discovery paths (RFC 4.1 and 4.3), `error` is an operation that raised
 * a twin, and the rest are the callable surfaces of RFC 4.2.
 */
export const SURFACES = Object.freeze([
  'comprehend',
  'docs',
  'error',
  'explain',
  'manifest',
  'probe',
  'validate',
]);

/**
 * The envelope: identification first, then whatever scenario data the
 * scenario needs, then the transcript last. Keeping the shape uniform is what
 * lets a port write ONE runner instead of one per fixture.
 */
export const ENVELOPE_HEAD = Object.freeze(['fixture', 'title', 'scenario', 'rfc']);

/** Scenario-specific envelope keys, the only ones allowed between head and steps. */
export const ENVELOPE_EXTRAS = Object.freeze([
  'discovery',
  'disagreements',
  'resolved',
  'source_pass',
  'unknown_fields',
]);

/** Every step: the call first, the shaped response last. */
export const STEP_HEAD = Object.freeze(['step', 'surface', 'input']);
export const STEP_TAIL = Object.freeze(['shape', 'response']);

/** Scenario-specific step keys, the only ones allowed between head and tail. */
export const STEP_ANNOTATIONS = Object.freeze(['did_you_mean', 'vocabulary']);

/** Every fixture file actually present on disk, sorted. */
export function listFixtureFiles() {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

/** The raw bytes of one fixture file, as text. */
export function readFixtureText(file) {
  return readFileSync(join(FIXTURES_DIR, file), 'utf8');
}

/** Read one fixture file as parsed JSON. Throws if absent or malformed. */
export function readFixture(file) {
  return JSON.parse(readFixtureText(file));
}

/** Every fixture on disk as a Map of file name to parsed JSON. */
export function readAllFixtures() {
  return new Map(listFixtureFiles().map((file) => [file, readFixture(file)]));
}

/**
 * The canonical serialization CC2 [01] freezes: two-space indent, key order as
 * authored, one trailing newline. Byte-identical means byte-identical, so this
 * is the one definition of the bytes both ports must reproduce.
 */
export function canonical(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Every step of every fixture, tagged with the file it came from. */
export function allSteps() {
  const out = [];
  for (const [file, fixture] of readAllFixtures()) {
    (fixture.steps ?? []).forEach((step, index) => {
      out.push({ file, index, fixture, step });
    });
  }
  return out;
}

/** Every step in the kit whose response is an instance of `shapeFile`. */
export function stepsOfShape(shapeFile) {
  return allSteps().filter(({ step }) => step.shape === shapeFile);
}

/** One fixture by file name, with a message that names the kit when absent. */
export function fixtureNamed(file) {
  if (!listFixtureFiles().includes(file)) {
    throw new Error(`the conformance kit has no fixture ${file} in ${FIXTURES_DIR}`);
  }
  return readFixture(file);
}
