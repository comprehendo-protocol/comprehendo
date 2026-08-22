// The must-fail kit as a set: the roster, the envelope, and the invariants
// that hold across every negative fixture at once (Negative Fixtures [05]).
//
// Per-fixture proofs of the actual violation live in
// negative-violations.test.mjs, and the one gate that exists in Wave 1 is run
// for real in negative-budget.test.mjs. What is here is what no single fixture
// can prove about itself: that all six required fixtures exist, that each one
// names the rule it violates, that each is still a VALID instance of its shape
// (a malformed fixture would fail every gate for the wrong reason), and that
// the bytes on disk are the canonical form CC2 [01] freezes.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check } from './helpers/validate.mjs';
import { listSchemaFiles } from './helpers/shapes.mjs';
import { EXPECTED_FIXTURES } from './helpers/fixtures.mjs';
import {
  CONTRACTS,
  ENVELOPE_EXTRAS,
  ENVELOPE_HEAD,
  EXPECTED_NEGATIVE_FIXTURES,
  STEP_ANNOTATIONS,
  STEP_HEAD,
  STEP_TAIL,
  SURFACES,
  VIOLATION_KEYS,
  allNegativeSteps,
  canonical,
  listNegativeFixtureFiles,
  readAllNegative,
  readNegative,
  readNegativeText,
  resolveLocator,
} from './helpers/negative.mjs';

const RFC_SECTION = /^\d+(\.\d+)*$/;
const stem = (file) => file.replace(/\.json$/, '');

describe('the negative roster', () => {
  test('the kit carries exactly the six must-fail fixtures the doc requires', () => {
    assert.deepEqual(listNegativeFixtureFiles(), [...EXPECTED_NEGATIVE_FIXTURES]);
  });

  test('every load-bearing rule in the contract table has its must-fail fixture', () => {
    assert.deepEqual(listNegativeFixtureFiles().map(stem), Object.keys(CONTRACTS).sort());
  });

  test('the negative kit and the positive kit share no fixture name', () => {
    const files = listNegativeFixtureFiles();
    assert.ok(files.length > 0, 'the negative kit is empty');
    for (const file of files) {
      assert.ok(
        !EXPECTED_FIXTURES.includes(file),
        `${file} is in both kits; a must-fail fixture is never mixed into the positive kit`,
      );
    }
  });
});

describe('the negative envelope', () => {
  for (const file of EXPECTED_NEGATIVE_FIXTURES) {
    describe(file, () => {
      test('carries the envelope keys in order, violation in the head, transcript last', () => {
        const keys = Object.keys(readNegative(file));
        assert.deepEqual(keys.slice(0, ENVELOPE_HEAD.length), [...ENVELOPE_HEAD]);
        assert.equal(keys.at(-1), 'steps', 'the transcript is the last key');
        for (const extra of keys.slice(ENVELOPE_HEAD.length, -1)) {
          assert.ok(ENVELOPE_EXTRAS.includes(extra), `${file} invents the envelope key ${extra}`);
        }
      });

      test('names itself after its file, and its scenario is the rule it breaks', () => {
        const fixture = readNegative(file);
        assert.equal(fixture.fixture, stem(file));
        assert.equal(fixture.scenario, stem(file), 'the scenario IS the violation');
        assert.equal(fixture.violation.reason, stem(file), 'the reason IS the violation');
        assert.ok(fixture.title.length > 0);
      });

      test('cites the RFC sections it exercises', () => {
        const { rfc } = readNegative(file);
        assert.ok(Array.isArray(rfc) && rfc.length > 0, 'rfc must name at least one section');
        for (const section of rfc) assert.match(section, RFC_SECTION);
      });

      test('carries at least one step', () => {
        const { steps } = readNegative(file);
        assert.ok(Array.isArray(steps) && steps.length > 0);
      });
    });
  }
});

describe('every fixture names the specific rule it violates', () => {
  // The doc's must-not: a negative fixture that fails for the wrong reason
  // does not satisfy it. That is only checkable if the fixture states the
  // reason, the gate that owes the rejection, and where the violation lives.
  for (const file of EXPECTED_NEGATIVE_FIXTURES) {
    describe(file, () => {
      test('the violation block carries every key, in order', () => {
        const { violation } = readNegative(file);
        assert.deepEqual(Object.keys(violation), [...VIOLATION_KEYS]);
      });

      test('rule, contract, wave and gate agree with the contract table', () => {
        const { violation } = readNegative(file);
        const expected = CONTRACTS[stem(file)];
        assert.equal(violation.rule, expected.rule);
        assert.equal(violation.contract, expected.contract);
        assert.equal(violation.wave, expected.wave);
        assert.equal(violation.gate, expected.gate);
        assert.equal(violation.enforced, expected.enforced);
      });

      test('the diagnostic is a sentence, not a bare red X', () => {
        const { violation } = readNegative(file);
        assert.ok(
          violation.message.length > 40,
          'the gate owes a named reason, "right rejection, wrong diagnostic" is a failure',
        );
      });

      test('the locator resolves to a real value inside this fixture', () => {
        const fixture = readNegative(file);
        const found = resolveLocator(fixture, fixture.violation.locator);
        assert.notEqual(
          found,
          undefined,
          `${file} locator ${fixture.violation.locator} points at nothing`,
        );
      });
    });
  }

  test('exactly the gates built so far can actually be run, named here so the list cannot silently drift', () => {
    const enforced = [...readAllNegative().values()]
      .map(({ violation }) => violation)
      .filter((violation) => violation.enforced)
      .map((violation) => violation.reason)
      .sort();
    assert.deepEqual(
      enforced,
      ['computed-marker', 'oversized-topic', 'raw-error-leak', 'schema-escaping-fix'].sort(),
    );
  });

  test('every deferred gate names the later wave that will enforce it', () => {
    const violations = [...readAllNegative().values()].map(({ violation }) => violation);
    assert.equal(violations.length, EXPECTED_NEGATIVE_FIXTURES.length);
    for (const violation of violations) {
      if (violation.enforced) continue;
      assert.notEqual(
        violation.wave,
        'comprehendo-wave-1',
        `${violation.reason} is deferred, so its enforcing wave cannot be Wave 1`,
      );
      assert.match(violation.contract, /^\d\d-cc\d+-/, `${violation.reason} must name its SPEC doc`);
    }
  });
});

describe('every step is a valid instance of a shape', () => {
  // A negative fixture is non-conforming in exactly one DIMENSION, never
  // malformed: a fixture that does not even parse against its shape would be
  // rejected by every gate for the wrong reason, which is the failure this
  // doc's must-not names.
  test('steps carry the call first and the shaped response last', () => {
    for (const { file, index, step } of allNegativeSteps()) {
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
    for (const { file, index, step } of allNegativeSteps()) {
      assert.ok(SURFACES.includes(step.surface), `${file} step ${index}: ${step.surface}`);
      assert.ok(schemas.includes(step.shape), `${file} step ${index}: ${step.shape}`);
      assert.ok(step.step.length > 0, `${file} step ${index} has no description`);
    }
  });

  test('every response validates against the shape the step names', () => {
    for (const { file, index, step } of allNegativeSteps()) {
      const { ok, errors } = check(step.shape, step.response);
      assert.ok(ok, `${file} step ${index} (${step.shape}) is malformed, not merely wrong: ${errors}`);
    }
  });
});

describe('canonical serialization (CC2 [01])', () => {
  test('every negative fixture on disk is already its own canonical form', () => {
    for (const [file, fixture] of readAllNegative()) {
      assert.equal(
        readNegativeText(file),
        canonical(fixture),
        `${file} is not byte-identical to its canonical serialization`,
      );
    }
  });

  test('a parse/serialize round-trip is byte-identical', () => {
    for (const file of listNegativeFixtureFiles()) {
      const once = readNegativeText(file);
      assert.equal(canonical(JSON.parse(canonical(JSON.parse(once)))), once, file);
    }
  });

  test('no negative fixture carries a trailing-whitespace or CRLF line', () => {
    for (const file of listNegativeFixtureFiles()) {
      const text = readNegativeText(file);
      assert.ok(!text.includes('\r'), `${file} carries a CRLF line ending`);
      assert.ok(!/[ \t]\n/.test(text), `${file} carries trailing whitespace`);
    }
  });
});

describe('language neutrality, with one stated exemption', () => {
  // Same rule as the positive kit: a fixture that only makes sense in one
  // language is not a conformance fixture. CC9's violation IS the marker
  // idiom, so computed-marker.json cannot be neutral; the exemption is
  // therefore stated AND asserted, it must carry BOTH ecosystems' forms, or
  // the negative kit has quietly become the JavaScript kit.
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
  const EXEMPT = ['computed-marker.json'];

  for (const file of EXPECTED_NEGATIVE_FIXTURES.filter((name) => !EXEMPT.includes(name))) {
    test(`${file} carries no single-ecosystem idiom`, () => {
      const text = readNegativeText(file).toLowerCase();
      for (const idiom of SINGLE_ECOSYSTEM) {
        assert.ok(!text.includes(idiom.toLowerCase()), `${file} names ${idiom}`);
      }
    });
  }

  test('the exempt fixture is exempt because it names BOTH ecosystems', () => {
    for (const file of EXEMPT) {
      const text = readNegativeText(file);
      assert.ok(text.includes('Symbol.for'), `${file} omits the JavaScript marker form`);
      assert.ok(text.includes('__comprehendo__'), `${file} omits the Python marker form`);
    }
  });
});
