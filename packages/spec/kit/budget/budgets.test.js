import test from 'node:test';
import assert from 'node:assert/strict';

const load = () => import('./budgets.js');

test('SCOPES covers exactly index, topic and priming', async () => {
  const { SCOPES } = await load();
  assert.deepEqual([...SCOPES].sort(), ['index', 'priming', 'topic']);
  assert.ok(Object.isFrozen(SCOPES));
});

test('BUDGETS carries a positive integer limit for every scope', async () => {
  const { BUDGETS, SCOPES } = await load();
  for (const scope of SCOPES) {
    assert.equal(typeof BUDGETS[scope], 'number', `${scope} limit`);
    assert.ok(Number.isInteger(BUDGETS[scope]), `${scope} limit is an integer`);
    assert.ok(BUDGETS[scope] > 0, `${scope} limit is positive`);
  }
});

test('BUDGETS is frozen, a budget cannot be overridden at runtime', async () => {
  const { BUDGETS } = await load();
  assert.ok(Object.isFrozen(BUDGETS));
  assert.throws(() => {
    BUDGETS.priming = 5000;
  }, TypeError);
  assert.equal(BUDGETS.priming, 150);
});

test('the priming budget is the CC5 150 token hard cap', async () => {
  const { BUDGETS, PRIMING_HARD_CAP } = await load();
  assert.equal(PRIMING_HARD_CAP, 150);
  assert.equal(BUDGETS.priming, PRIMING_HARD_CAP);
});

test('every budget is derived from the recorded Wave-1 baseline, never invented', async () => {
  const { BUDGETS, BASELINES, SCOPES } = await load();
  for (const scope of SCOPES) {
    const baseline = BASELINES[scope];
    assert.equal(typeof baseline, 'number', `${scope} baseline recorded`);
    assert.ok(BUDGETS[scope] >= baseline, `${scope} budget clears its own baseline`);
    assert.ok(
      BUDGETS[scope] <= baseline * 2,
      `${scope} budget ${BUDGETS[scope]} has more than 2x headroom over baseline ${baseline}`,
    );
  }
  assert.ok(Object.isFrozen(BASELINES));
});

test('assertRatchet accepts an unchanged budget table', async () => {
  const { assertRatchet, BUDGETS } = await load();
  assert.doesNotThrow(() => assertRatchet(BUDGETS, BUDGETS));
});

test('assertRatchet accepts a tightened budget', async () => {
  const { assertRatchet } = await load();
  assert.doesNotThrow(() =>
    assertRatchet({ index: 1200, topic: 600, priming: 150 }, { index: 900, topic: 600, priming: 120 }),
  );
});

test('assertRatchet rejects a loosened budget, naming the scope and both numbers', async () => {
  const { assertRatchet } = await load();
  assert.throws(
    () => assertRatchet({ index: 1200, topic: 600, priming: 150 }, { index: 1200, topic: 900, priming: 150 }),
    (err) => /topic/.test(err.message) && /600/.test(err.message) && /900/.test(err.message),
  );
});

test('assertRatchet rejects any priming budget above the 150 token hard cap', async () => {
  const { assertRatchet } = await load();
  assert.throws(
    () => assertRatchet({ index: 1200, topic: 600, priming: 200 }, { index: 1200, topic: 600, priming: 200 }),
    /priming/,
  );
});

test('assertRatchet rejects a scope dropped from the table', async () => {
  const { assertRatchet } = await load();
  assert.throws(
    () => assertRatchet({ index: 1200, topic: 600, priming: 150 }, { index: 1200, priming: 150 }),
    /topic/,
  );
});

test('assertRatchet rejects a non-numeric limit rather than passing it through', async () => {
  const { assertRatchet } = await load();
  assert.throws(
    () => assertRatchet({ index: 1200, topic: 600, priming: 150 }, { index: 1200, topic: 'none', priming: 150 }),
    /topic/,
  );
});
