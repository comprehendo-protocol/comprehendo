// The one negative fixture whose gate already exists, run through that gate
// for real (Negative Fixtures [05] against Budget Harness [06] / CC5 [02]).
//
// Everything else in this kit is a fixture waiting for a Wave 2 to Wave 5
// scanner. The oversized topic is not: the CC5 budget gate shipped in Wave 1,
// so this fixture is measured by the real tokenizer, compared against the real
// budget, and pushed through the real CLI the way CI invokes it. If it ever
// PASSES that gate, this file goes red, which is the doc's central rule.
//
// The CLI half crosses a process boundary on purpose. "measureScope returns
// pass: false" and "the build actually fails" are different claims, and only
// the second one is what CI reads.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUDGETS, SCOPES } from '../kit/budget/budgets.js';
import { measureScope } from '../kit/budget/measure.js';
import {
  EXPECTED_NEGATIVE_FIXTURES,
  allNegativeSteps,
  negativeFixture,
  stepOf,
} from './helpers/negative.mjs';

const RUNNER = fileURLToPath(new URL('../kit/budget/run.js', import.meta.url));

/** Which CC5 scope a shaped response is charged against, if any. */
const SCOPE_OF_SHAPE = {
  'topic.schema.json': 'topic',
  'index.schema.json': 'index',
};

// Loaded per test, never at module scope: a missing fixture must fail the
// assertions that name it, not stop the file from loading at all.
const load = () => negativeFixture('oversized-topic');
const loadTopic = () => stepOf(load()).response;

describe('oversized-topic, measured by the real CC5 harness', () => {
  test('the fixture names a scope the harness actually defines', () => {
    const fixture = load();
    assert.ok(SCOPES.includes(fixture.budget.scope), `unknown scope ${fixture.budget.scope}`);
    assert.equal(fixture.budget.scope, 'topic');
    assert.ok(
      fixture.violation.message.includes(fixture.budget.scope),
      'the diagnostic must name the scope that was blown',
    );
  });

  test('it fails the budget gate, and fails it for being over the topic budget', () => {
    const fixture = load();
    const record = measureScope(fixture.budget.scope, stepOf(fixture).response);
    assert.equal(record.pass, false, 'the oversized topic PASSED its gate, which is a CI failure');
    assert.ok(
      record.measured > record.limit,
      `measured ${record.measured} against a budget of ${record.limit}`,
    );
    assert.equal(record.limit, BUDGETS.topic, 'measured against the real budget, not a copy');
  });

  test('the overage is decisive, not a rounding accident', () => {
    // A fixture one token over would flip green on any tokenizer nudge, and a
    // must-fail that can flip is not a gate.
    const { measured, limit } = measureScope('topic', loadTopic());
    assert.ok(measured > limit * 1.25, `${measured} tokens is not decisively over ${limit}`);
  });

  test('it is a real topic, over budget and nothing else', () => {
    const topic = loadTopic();
    assert.ok(topic.summary.length > 0);
    assert.ok(topic.examples.length > 0);
    assert.ok(Array.isArray(topic.see_also));
  });
});

describe('the CLI gate, the way CI invokes it', () => {
  /** The topic response on disk as its own artifact, which is what CI measures. */
  const stage = () => {
    const artifact = join(mkdtempSync(join(tmpdir(), 'comprehendo-negative-')), 'topic.json');
    writeFileSync(artifact, `${JSON.stringify(loadTopic(), null, 2)}\n`);
    return artifact;
  };

  test('exits 1, and the reason on stderr names the count and the budget', () => {
    const artifact = stage();
    const run = spawnSync(process.execPath, [RUNNER, '--scope', 'topic', '--file', artifact], {
      encoding: 'utf8',
    });
    const { measured, limit } = measureScope('topic', loadTopic());

    assert.equal(run.status, 1, `expected the build to fail; stdout was:\n${run.stdout}`);
    assert.match(run.stdout, /FAIL {2}topic/);
    assert.match(run.stdout, /1 of 1 scopes OVER BUDGET: topic/);
    assert.ok(
      run.stderr.includes(
        `budget gate failed: topic measured ${measured} tokens against a budget of ${limit}`,
      ),
      `stderr did not name the violation:\n${run.stderr}`,
    );
  });

  test('the --json records stay parseable on the failing path', () => {
    const artifact = stage();
    const run = spawnSync(
      process.execPath,
      [RUNNER, '--json', '--scope', 'topic', '--file', artifact],
      { encoding: 'utf8' },
    );
    const [record] = JSON.parse(run.stdout);
    assert.equal(run.status, 1);
    assert.equal(record.scope, 'topic');
    assert.equal(record.pass, false);
  });
});

describe('exactly one violation per fixture, held by the budget gate', () => {
  // The doc's second business rule: a fixture that breaks two rules at once
  // cannot pin down which gate caught it. The budget gate is the one gate this
  // wave can actually run, so it is also the one cross-check that can be run
  // for real rather than asserted.
  for (const file of EXPECTED_NEGATIVE_FIXTURES.filter((name) => name !== 'oversized-topic.json')) {
    test(`${file} stays within every budget it touches`, () => {
      const steps = allNegativeSteps().filter((entry) => entry.file === file);
      for (const { index, step } of steps) {
        const scope = SCOPE_OF_SHAPE[step.shape];
        if (scope) {
          const record = measureScope(scope, step.response);
          assert.ok(record.pass, `${file} step ${index} is ALSO over the ${scope} budget`);
        }
        if (step.shape === 'entry.schema.json') {
          const record = measureScope('priming', step.response.priming);
          assert.ok(record.pass, `${file} step ${index} is ALSO over the priming budget`);
        }
      }
    });
  }
});
