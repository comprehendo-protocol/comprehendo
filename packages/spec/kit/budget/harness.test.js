import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN = fileURLToPath(new URL('./run.js', import.meta.url));

const harness = (...args) =>
  spawnSync(process.execPath, [RUN, ...args], { encoding: 'utf8' });

const tmpFile = (name, body) => {
  const dir = mkdtempSync(join(tmpdir(), 'comprehendo-harness-'));
  const path = join(dir, name);
  writeFileSync(path, body, 'utf8');
  return path;
};

test('the harness CLI reports a record for every scope and exits 0 under budget', () => {
  const run = harness('--json');
  assert.equal(run.status, 0, run.stderr);
  const records = JSON.parse(run.stdout);
  assert.equal(records.length, 3);
  for (const record of records) {
    assert.deepEqual(Object.keys(record).slice(0, 4), ['scope', 'limit', 'measured', 'pass']);
    assert.equal(record.pass, true);
  }
  assert.deepEqual(records.map((r) => r.scope).sort(), ['index', 'priming', 'topic']);
});

// Process boundary: CI spawns this harness as a child. What the parent reads back
// must be exactly what the child measured, not a re-render of it.
test('the parent process observes exactly the counts the child measured', async () => {
  const { measureBaselines } = await import('./measure.js');
  const run = harness('--json');
  assert.equal(run.status, 0, run.stderr);
  const fromChild = JSON.parse(run.stdout).sort((a, b) => a.scope.localeCompare(b.scope));
  const inParent = measureBaselines()
    .map((r) => ({ scope: r.scope, limit: r.limit, measured: r.measured, pass: r.pass, encoding: r.encoding }))
    .sort((a, b) => a.scope.localeCompare(b.scope));
  assert.deepEqual(fromChild, inParent);
});

test('the human report lists every scope with its measured count and its budget', () => {
  const run = harness();
  assert.equal(run.status, 0, run.stderr);
  for (const scope of ['index', 'topic', 'priming']) {
    const line = run.stdout.split('\n').find((l) => l.includes(scope));
    assert.ok(line, `no report line for ${scope}`);
    assert.match(line, /\d+\s*\/\s*\d+/, `report line for ${scope} carries count / budget`);
  }
  assert.match(run.stdout, /o200k_base/, 'the report names the encoding it measured with');
});

test('an over-budget artifact fails the build, naming the count and the budget', () => {
  const path = tmpFile('fat-priming.md', 'over budget '.repeat(200));
  const run = harness('--scope', 'priming', '--file', path);
  assert.equal(run.status, 1, 'an over-budget scope is red, never a warning');
  const output = run.stdout + run.stderr;
  assert.match(output, /priming/);
  assert.match(output, /150/, 'the budget it exceeded is named');
  assert.match(output, /\b\d{3,}\b/, 'the measured count is named');
  assert.match(output, /OVER BUDGET/i);
});

test('an under-budget artifact passed by path exits 0', () => {
  const path = tmpFile('priming.md', 'Probe the marker, then call docs(question).\n');
  const run = harness('--scope', 'priming', '--file', path, '--json');
  assert.equal(run.status, 0, run.stderr);
  const records = JSON.parse(run.stdout);
  assert.equal(records.length, 1);
  assert.equal(records[0].scope, 'priming');
  assert.equal(records[0].pass, true);
});

test('an unknown scope is a usage error, not a silent pass', () => {
  const run = harness('--scope', 'manual', '--file', '/dev/null');
  assert.equal(run.status, 2);
  assert.match(run.stderr, /manual/);
});

test('--file without --scope is a usage error', () => {
  const run = harness('--file', '/dev/null');
  assert.equal(run.status, 2);
  assert.match(run.stderr, /--scope/);
});

test('a missing artifact is a usage error naming the path', () => {
  const run = harness('--scope', 'priming', '--file', '/no/such/priming.md');
  assert.equal(run.status, 2);
  assert.match(run.stderr, /no\/such\/priming\.md/);
});
