import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const load = () => import('./measure.js');
const budgets = () => import('./budgets.js');

const tmpFile = (name, body) => {
  const dir = mkdtempSync(join(tmpdir(), 'comprehendo-budget-'));
  const path = join(dir, name);
  writeFileSync(path, body, 'utf8');
  return path;
};

test('measureScope returns the documented budget record shape', async () => {
  const { measureScope } = await load();
  const { BUDGETS } = await budgets();
  const record = measureScope('topic', { topic: 'crop', summary: 'Use -vf crop.' });

  assert.deepEqual(Object.keys(record).slice(0, 4), ['scope', 'limit', 'measured', 'pass']);
  assert.equal(record.scope, 'topic');
  assert.equal(record.limit, BUDGETS.topic);
  assert.equal(typeof record.measured, 'number');
  assert.equal(typeof record.pass, 'boolean');
  assert.equal(typeof record.encoding, 'string');
});

test('a payload under its budget passes', async () => {
  const { measureScope } = await load();
  const record = measureScope('priming', 'Probe the marker, then call docs().');
  assert.equal(record.pass, true);
  assert.ok(record.measured < record.limit);
});

test('a payload over its budget fails and carries the count and the limit it exceeded', async () => {
  const { measureScope } = await load();
  const record = measureScope('priming', 'over budget '.repeat(200));
  assert.equal(record.pass, false);
  assert.equal(record.limit, 150);
  assert.ok(record.measured > 150, `measured ${record.measured}`);
});

test('measureScope rejects a scope the budget table does not define', async () => {
  const { measureScope } = await load();
  assert.throws(() => measureScope('manual', 'anything'), /manual/);
});

test('an index response is measured as the serialized payload the agent receives', async () => {
  const { measureScope, renderPayload } = await load();
  const response = { topics: ['crop', 'scale', 'how to trim'] };
  const record = measureScope('index', response);
  assert.equal(renderPayload(response), JSON.stringify(response));
  const { countTokens } = await import('./tokenizer.js');
  assert.equal(record.measured, countTokens(JSON.stringify(response)));
});

test('a text payload is measured as its own trimmed text, never re-serialized', async () => {
  const { renderPayload } = await load();
  assert.equal(renderPayload('  probe the marker\n'), 'probe the marker');
});

test('the kit baseline index fixture measures under the index budget', async () => {
  const { measureBaselines } = await load();
  const record = measureBaselines().find((r) => r.scope === 'index');
  assert.equal(record.pass, true, `index measured ${record.measured} against ${record.limit}`);
});

test('the kit baseline topic fixture measures under the topic budget', async () => {
  const { measureBaselines } = await load();
  const record = measureBaselines().find((r) => r.scope === 'topic');
  assert.equal(record.pass, true, `topic measured ${record.measured} against ${record.limit}`);
});

test('the priming reference fixture measures under 150 tokens', async () => {
  const { measureBaselines } = await load();
  const record = measureBaselines().find((r) => r.scope === 'priming');
  assert.equal(record.limit, 150);
  assert.equal(record.pass, true, `priming measured ${record.measured} tokens`);
  assert.ok(record.measured < 150);
});

test('measureBaselines returns exactly one record per scope', async () => {
  const { measureBaselines } = await load();
  const { SCOPES } = await budgets();
  const records = measureBaselines();
  assert.equal(records.length, SCOPES.length);
  assert.deepEqual(records.map((r) => r.scope).sort(), [...SCOPES].sort());
});

test('the recorded Wave-1 baselines still match what the fixtures measure today', async () => {
  const { measureBaselines } = await load();
  const { BASELINES } = await budgets();
  for (const record of measureBaselines()) {
    assert.equal(
      record.measured,
      BASELINES[record.scope],
      `${record.scope} baseline drifted: recorded ${BASELINES[record.scope]}, measured ${record.measured}`,
    );
  }
});

test('measureFile measures an arbitrary artifact for a named scope', async () => {
  const { measureFile, measureScope } = await load();
  const path = tmpFile('priming.md', 'Probe the marker, then call docs().\n');
  const record = measureFile('priming', path);
  assert.equal(record.scope, 'priming');
  assert.equal(record.measured, measureScope('priming', 'Probe the marker, then call docs().').measured);
  assert.equal(record.pass, true);
});

test('measureFile parses a .json artifact as a response payload', async () => {
  const { measureFile, measureScope } = await load();
  const response = { topics: ['crop', 'scale'] };
  const path = tmpFile('index.json', JSON.stringify(response, null, 2));
  const record = measureFile('index', path);
  assert.equal(record.measured, measureScope('index', response).measured);
});

test('measureFile names the path when the artifact is missing', async () => {
  const { measureFile } = await load();
  assert.throws(() => measureFile('priming', '/no/such/priming.md'), /no\/such\/priming\.md/);
});
