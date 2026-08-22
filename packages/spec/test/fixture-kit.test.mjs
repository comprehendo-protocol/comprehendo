// The kit as a set: the roster, the envelope, and the invariants that hold
// across every fixture at once (Conformance Fixtures [04]).
//
// Per-scenario assertions live in the fixtures-*.test.mjs files. What is here
// is what no single fixture can prove about itself: that the set is complete,
// that every response really is an instance of a Shape Schema [03] shape, that
// the bytes on disk are the canonical form CC2 [01] freezes, and that nothing
// in the kit only makes sense in one language.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check } from './helpers/validate.mjs';
import { listSchemaFiles, readSchema } from './helpers/shapes.mjs';
import {
  ENVELOPE_EXTRAS,
  ENVELOPE_HEAD,
  EXPECTED_FIXTURES,
  SCENARIOS,
  STEP_ANNOTATIONS,
  STEP_HEAD,
  STEP_TAIL,
  SURFACES,
  allSteps,
  canonical,
  listFixtureFiles,
  readAllFixtures,
  readFixtureText,
  stepsOfShape,
} from './helpers/fixtures.mjs';

const RFC_SECTION = /^\d+(\.\d+)*$/;

describe('the fixture roster', () => {
  test('the kit carries exactly the fixtures the scenario list names', () => {
    assert.deepEqual(listFixtureFiles(), [...EXPECTED_FIXTURES]);
  });

  test('every scenario in the vocabulary is exercised by some fixture', () => {
    const used = new Set([...readAllFixtures().values()].map((f) => f.scenario));
    assert.deepEqual([...used].sort(), [...SCENARIOS]);
  });
});

describe('the fixture envelope', () => {
  for (const file of EXPECTED_FIXTURES) {
    describe(file, () => {
      test('carries the envelope keys in order, transcript last', () => {
        const keys = Object.keys(JSON.parse(readFixtureText(file)));
        assert.deepEqual(keys.slice(0, ENVELOPE_HEAD.length), [...ENVELOPE_HEAD]);
        assert.equal(keys.at(-1), 'steps', 'the transcript is the last key');
        for (const extra of keys.slice(ENVELOPE_HEAD.length, -1)) {
          assert.ok(ENVELOPE_EXTRAS.includes(extra), `${file} invents the envelope key ${extra}`);
        }
      });

      test('names itself after its file, in a known scenario', () => {
        const fixture = JSON.parse(readFixtureText(file));
        assert.equal(fixture.fixture, file.replace(/\.json$/, ''));
        assert.ok(SCENARIOS.includes(fixture.scenario), `unknown scenario ${fixture.scenario}`);
        assert.ok(fixture.title.length > 0);
      });

      test('cites the RFC sections it exercises', () => {
        const { rfc } = JSON.parse(readFixtureText(file));
        assert.ok(Array.isArray(rfc) && rfc.length > 0, 'rfc must name at least one section');
        for (const section of rfc) {
          assert.match(section, RFC_SECTION);
        }
      });

      test('carries at least one step', () => {
        const { steps } = JSON.parse(readFixtureText(file));
        assert.ok(Array.isArray(steps) && steps.length > 0);
      });
    });
  }
});

describe('every step is an instance of a shape', () => {
  test('steps carry the call first and the shaped response last', () => {
    for (const { file, index, step } of allSteps()) {
      const keys = Object.keys(step);
      const where = `${file} step ${index}`;
      assert.deepEqual(keys.slice(0, STEP_HEAD.length), [...STEP_HEAD], where);
      assert.deepEqual(keys.slice(-STEP_TAIL.length), [...STEP_TAIL], where);
      for (const extra of keys.slice(STEP_HEAD.length, -STEP_TAIL.length)) {
        assert.ok(STEP_ANNOTATIONS.includes(extra), `${where} invents the step key ${extra}`);
      }
    }
  });

  test('every step names a known surface and a real schema file', () => {
    const schemas = listSchemaFiles();
    for (const { file, index, step } of allSteps()) {
      assert.ok(SURFACES.includes(step.surface), `${file} step ${index}: ${step.surface}`);
      assert.ok(schemas.includes(step.shape), `${file} step ${index}: ${step.shape}`);
      assert.equal(typeof step.step, 'string');
      assert.ok(step.step.length > 0, `${file} step ${index} has no description`);
    }
  });

  test('every response validates against the shape the step names', () => {
    for (const { file, index, step } of allSteps()) {
      const { ok, errors } = check(step.shape, step.response);
      assert.ok(ok, `${file} step ${index} (${step.shape}): ${errors}`);
    }
  });
});

describe('canonical serialization (CC2 [01])', () => {
  test('every fixture on disk is already its own canonical form', () => {
    for (const [file, fixture] of readAllFixtures()) {
      assert.equal(
        readFixtureText(file),
        canonical(fixture),
        `${file} is not byte-identical to its canonical serialization`,
      );
    }
  });

  test('a parse/serialize round-trip is byte-identical', () => {
    for (const file of listFixtureFiles()) {
      const once = readFixtureText(file);
      assert.equal(canonical(JSON.parse(canonical(JSON.parse(once)))), once, file);
    }
  });

  test('no fixture carries a trailing-whitespace or CRLF line', () => {
    for (const file of listFixtureFiles()) {
      const text = readFixtureText(file);
      assert.ok(!text.includes('\r'), `${file} carries a CRLF line ending`);
      assert.ok(!/[ \t]\n/.test(text), `${file} carries trailing whitespace`);
    }
  });
});

describe('language neutrality (the must-not of this doc)', () => {
  // A fixture that only makes sense in one language is not a conformance
  // fixture. The two marker idioms are the concrete trap: the RFC's own
  // priming reference names both of them, and a kit that copies it verbatim
  // has quietly become the JavaScript kit.
  const SINGLE_ECOSYSTEM = [
    'Symbol.for',
    '__comprehendo__',
    'javascript',
    'typescript',
    'python',
    'node.js',
    'pyproject',
    'package.json',
  ];

  for (const file of EXPECTED_FIXTURES) {
    test(`${file} carries no single-ecosystem idiom`, () => {
      const text = readFixtureText(file).toLowerCase();
      for (const idiom of SINGLE_ECOSYSTEM) {
        assert.ok(!text.includes(idiom.toLowerCase()), `${file} names ${idiom}`);
      }
    });
  }
});

describe('shape coverage', () => {
  // The deliberate absences, stated out loud so adding a fixture has to
  // update this list rather than silently widening the kit:
  //   fix.schema.json     covered transitively, every twin's `fixes` items
  //                       are `$ref`d to it (asserted below).
  //   config.schema.json  not covered here. Consumer configuration is not in
  //                       this doc's scenario list; it belongs to Router &
  //                       Precedence [22] and Config Loader [23].
  const EXERCISED = [
    'entry.schema.json',
    'explanation.schema.json',
    'index.schema.json',
    'manifest.schema.json',
    'topic.schema.json',
    'twin.schema.json',
    'undocumented.schema.json',
    'unvalidatable.schema.json',
  ];
  const ABSENT = ['config.schema.json', 'fix.schema.json'];

  test('the kit exercises exactly the shapes it claims to', () => {
    const used = new Set(allSteps().map(({ step }) => step.shape));
    assert.deepEqual([...used].sort(), EXERCISED);
  });

  test('every shape on disk is either exercised by the kit or a stated absence', () => {
    const used = new Set(allSteps().map(({ step }) => step.shape));
    for (const file of listSchemaFiles()) {
      assert.ok(
        used.has(file) || ABSENT.includes(file),
        `${file} is neither exercised by a fixture nor a stated absence`,
      );
    }
    for (const file of ABSENT) {
      assert.ok(!used.has(file), `${file} is listed as absent but the kit exercises it`);
    }
    assert.deepEqual([...EXERCISED, ...ABSENT].sort(), listSchemaFiles());
  });

  test('fix.schema.json is covered transitively, through a twin', () => {
    const withFixes = stepsOfShape('twin.schema.json').filter(
      ({ step }) => step.response.fixes.length > 0,
    );
    assert.ok(withFixes.length > 0, 'no twin in the kit carries a fix');
    const items = readSchema('twin.schema.json').properties.fixes.items;
    assert.equal(items.$ref, 'https://comprehendo.dev/schemas/0.1/fix.schema.json');
  });
});

describe('cross-fixture consistency', () => {
  // The kit duplicates values on purpose (a port must be able to read ONE
  // fixture file and run it). These two tests are what make the duplication
  // safe: a copy that drifts goes red instead of quietly disagreeing.
  test('entries for the same provider agree on every field this spec defines', () => {
    const known = Object.keys(readSchema('entry.schema.json').properties);
    const byName = new Map();
    for (const { file, step } of stepsOfShape('entry.schema.json')) {
      const subset = Object.fromEntries(
        known.filter((key) => key in step.response).map((key) => [key, step.response[key]]),
      );
      const seen = byName.get(step.response.name);
      if (seen === undefined) byName.set(step.response.name, { file, subset });
      else assert.deepEqual(subset, seen.subset, `${file} disagrees with ${seen.file}`);
    }
    assert.ok(byName.size > 0, 'no entry in the kit');
  });

  test('topics with the same name are the same topic everywhere', () => {
    const byTopic = new Map();
    for (const { file, step } of stepsOfShape('topic.schema.json')) {
      const seen = byTopic.get(step.response.topic);
      if (seen === undefined) byTopic.set(step.response.topic, { file, response: step.response });
      else assert.deepEqual(step.response, seen.response, `${file} disagrees with ${seen.file}`);
    }
    assert.ok(byTopic.size > 0, 'no topic in the kit');
  });
});
