// The two fixtures that exist to catch an implementation, not to illustrate a
// surface: forward-compat (acceptance criterion 2) and disagreement
// (acceptance criterion 3).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check } from './helpers/validate.mjs';
import { readSchema } from './helpers/shapes.mjs';
import { fixtureNamed } from './helpers/fixtures.mjs';

/** Resolve a path of keys and array indexes inside a response. */
function at(value, path) {
  return path.reduce((node, key) => (node === undefined ? undefined : node[key]), value);
}

/** A copy of `value` with the field at `path` removed. */
function strip(value, path) {
  const copy = structuredClone(value);
  const parent = at(copy, path.slice(0, -1));
  delete parent[path.at(-1)];
  return copy;
}

describe('forward-compat: unknown fields are accepted (RFC 11)', () => {
  const fixture = () => fixtureNamed('forward-compat.json');

  test('the fixture cites the versioning rule it exists to defend', () => {
    assert.ok(fixture().rfc.includes('11'), 'forward compatibility is RFC 11');
  });

  test('every response validates WITH its unknown fields present', () => {
    for (const step of fixture().steps) {
      const { ok, errors } = check(step.shape, step.response);
      assert.ok(ok, `${step.step}: ${errors}`);
    }
  });

  test('every declared unknown field is actually present in the payload', () => {
    const { steps, unknown_fields } = fixture();
    assert.ok(unknown_fields.length > 0, 'the fixture declares no unknown field');
    for (const declared of unknown_fields) {
      const found = at(steps[declared.step].response, declared.path);
      assert.notEqual(found, undefined, `${declared.path.join('.')} is not in the payload`);
      assert.equal(declared.field, declared.path.at(-1));
    }
  });

  test('every declared unknown field is genuinely unknown to this spec version', () => {
    // The trap this catches is a fixture that "tests forward compatibility"
    // with a field the schema already declares, which asserts nothing.
    for (const declared of fixture().unknown_fields) {
      const properties = Object.keys(readSchema(declared.shape).properties);
      assert.ok(
        !properties.includes(declared.field),
        `${declared.shape} already declares ${declared.field}; it is not an unknown field`,
      );
    }
  });

  test('the unknown fields are additive: stripping them leaves a conforming document', () => {
    const { steps, unknown_fields } = fixture();
    for (const [index, step] of steps.entries()) {
      const paths = unknown_fields.filter((f) => f.step === index).map((f) => f.path);
      const stripped = paths.reduce((doc, path) => strip(doc, path), step.response);
      const { ok, errors } = check(step.shape, stripped);
      assert.ok(ok, `${step.step} without its unknown fields: ${errors}`);
      for (const path of paths) assert.equal(at(stripped, path), undefined);
    }
  });

  test('every step of the fixture carries at least one unknown field', () => {
    const { steps, unknown_fields } = fixture();
    const covered = new Set(unknown_fields.map((f) => f.step));
    assert.deepEqual([...covered].sort(), steps.map((_, index) => index));
  });

  test('the unknown fields reach more than one shape, and reach a nested one', () => {
    const { unknown_fields } = fixture();
    assert.ok(new Set(unknown_fields.map((f) => f.shape)).size > 1, 'one shape is not the rule');
    assert.ok(
      unknown_fields.some((f) => f.path.length > 1),
      'a nested unknown field is the case a shallow allow-list misses',
    );
  });
});

describe('disagreement: the marker wins (RFC 4.3)', () => {
  const fixture = () => fixtureNamed('disagreement.json');
  const stepFor = (surface) => fixture().steps.find((s) => s.surface === surface);

  test('both declarations are present, and both are conforming on their own', () => {
    const manifest = stepFor('manifest');
    const marker = stepFor('probe');
    assert.ok(manifest, 'the fixture carries no manifest declaration');
    assert.ok(marker, 'the fixture carries no marker probe');
    assert.ok(check('manifest.schema.json', manifest.response).ok);
    assert.ok(check('entry.schema.json', marker.response).ok);
  });

  test('they actually disagree on every field the fixture claims', () => {
    const manifest = stepFor('manifest').response;
    const marker = stepFor('probe').response;
    const { disagreements } = fixture();
    assert.ok(disagreements.length > 0, 'a disagreement fixture with no disagreement');
    for (const row of disagreements) {
      assert.deepEqual(manifest[row.manifest_key], row.manifest_value, row.concept);
      assert.deepEqual(marker[row.marker_key], row.marker_value, row.concept);
      assert.notDeepEqual(row.manifest_value, row.marker_value, `${row.concept} does not disagree`);
    }
  });

  test('the marker wins every disagreement, and the manifest wins none', () => {
    const { disagreements, resolved } = fixture();
    for (const row of disagreements) {
      assert.equal(row.wins, 'marker', `${row.concept} resolves to the advisory declaration`);
      assert.deepEqual(
        resolved[row.marker_key],
        row.marker_value,
        `resolved ${row.concept} is not what the marker said`,
      );
      assert.notDeepEqual(resolved[row.marker_key], row.manifest_value, row.concept);
    }
    assert.equal(resolved.source, 'marker');
  });

  test('the resolved view is the marker entry, field for field', () => {
    const marker = stepFor('probe').response;
    const { resolved } = fixture();
    for (const [key, value] of Object.entries(resolved)) {
      if (key === 'source') continue;
      assert.deepEqual(value, marker[key], `resolved ${key} is not the marker's ${key}`);
    }
  });

  test('trusting the manifest would have claimed a surface the runtime does not offer', () => {
    // Why the rule exists: the manifest overclaims level 2, the marker reports
    // what the code actually offers. A router that believed the manifest would
    // call a surface that is not there.
    const marker = stepFor('probe').response;
    const manifest = stepFor('manifest').response;
    assert.equal(marker.level, 1);
    assert.equal(manifest.level, 2);
    for (const surface of ['validate', 'explain']) {
      assert.ok(!marker.surfaces.includes(surface), `the marker still offers ${surface}`);
    }
  });
});
