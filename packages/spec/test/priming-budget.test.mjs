// The CC5 [02] release gate for the published priming snippet (36).
//
// The snippet is the adoption unit: the text a project pastes into its agents
// file, and the ONLY context the Cold-Agent Benchmark [38] gives an agent. Two
// things have to stay true about it forever, so both are measured here rather
// than asserted once at authoring time:
//
//   1. it fits CC5's 150-token hard cap, counted by the real tiktoken-class
//      meter (kit/budget), never by a word or character proxy, and
//   2. it still SAYS the four things an agent needs (the marker probe, how to
//      call comprehend/docs, the completeness contract, and the UNDOCUMENTED
//      source-pass grant), because a snippet trimmed to fit by deleting an
//      instruction passes a budget gate and fails an agent.
//
// The gate is run in-process AND through the harness CLI the way CI invokes
// it: "measureScope says pass" and "the build actually fails" are different
// claims, and only the second is what CI reads.
//
// @see .mdd/docs/36-priming-snippet.md, .mdd/docs/02-cc5-context-budget.md

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUDGETS, PRIMING_HARD_CAP } from '../kit/budget/budgets.js';
import { measureFile, measureScope, renderPayload } from '../kit/budget/measure.js';
import { countTokensDetailed, ENCODINGS } from '../kit/budget/tokenizer.js';

/** The published artifact. This path is what [38] consumes, so it is fixed. */
const PRIMING = fileURLToPath(new URL('../priming.md', import.meta.url));
const RUNNER = fileURLToPath(new URL('../kit/budget/run.js', import.meta.url));

/**
 * Long dashes, by code point (U+2014 em, U+2013 en). Built from char codes on
 * purpose: this project bans them from source, so the pattern that detects one
 * must not contain one.
 */
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`, 'u');

// Read per test, never at module scope: a missing snippet must fail the
// assertions that name it, not stop the file from loading at all.
const snippet = () => readFileSync(PRIMING, 'utf8');

/** The exact text a budget is charged for, which is the text an agent pastes. */
const text = () => renderPayload(snippet());

const stage = (name, body) => {
  const path = join(mkdtempSync(join(tmpdir(), 'comprehendo-priming-')), name);
  writeFileSync(path, body, 'utf8');
  return path;
};

const harness = (...args) => spawnSync(process.execPath, [RUNNER, ...args], { encoding: 'utf8' });

describe('the published priming snippet, measured by the real CC5 meter', () => {
  test('it exists at packages/spec/priming.md', () => {
    assert.ok(snippet().trim().length > 0, 'the published snippet is empty');
  });

  test('it measures under the 150 token hard cap', () => {
    const record = measureFile('priming', PRIMING);
    assert.equal(record.limit, PRIMING_HARD_CAP, 'measured against the real CC5 cap, not a copy');
    assert.equal(record.limit, BUDGETS.priming);
    assert.ok(
      record.measured < PRIMING_HARD_CAP,
      `the priming snippet measures ${record.measured} tokens against a hard cap of ${PRIMING_HARD_CAP}`,
    );
    assert.equal(record.pass, true);
  });

  test('it fits under every encoding the harness measures, not just the cheapest one', () => {
    const { counts } = countTokensDetailed(text());
    for (const encoding of ENCODINGS) {
      assert.equal(typeof counts[encoding], 'number', `${encoding} was not measured`);
      assert.ok(
        counts[encoding] < PRIMING_HARD_CAP,
        `${encoding} counts ${counts[encoding]} tokens, over the ${PRIMING_HARD_CAP} cap`,
      );
    }
  });

  test('the count is a real BPE count, not a word or character proxy', () => {
    // A proxy is wrong by 3x to 5x on this kind of text, so the two can never
    // be confused for one another: this asserts the meter is not counting words.
    const words = text().split(/\s+/).filter(Boolean).length;
    const { measured } = countTokensDetailed(text());
    assert.notEqual(measured, words, 'the measured count equals the word count, that is a proxy');
    assert.ok(measured > words, `${measured} tokens for ${words} words is not a real BPE count`);
  });

  test('the file is the snippet and nothing else, so the measured number is what an agent pays', () => {
    const body = snippet();
    assert.ok(!body.startsWith('---'), 'front matter would be measured but never pasted');
    assert.ok(!/^#/m.test(body), 'a heading would be measured but never pasted');
    assert.equal(body.trim().split('\n\n').length, 1, 'the snippet is one pasteable block');
  });
});

describe('the snippet still teaches the four things (36 Business Rules)', () => {
  const covers = [
    ['the JS marker probe', /Symbol\.for\('comprehendo'\)/],
    ['the Python marker probe', /__comprehendo__/],
    ['probing the handle or the caught error', /probe the handle or caught error/],
    ['how to call docs', /\.docs\(question\)/],
    ['how to call comprehend', /comprehend\(raw\)/],
    ['the sidecar docs call for an un-adopted package', /docs\(pkg, question\)/],
    ['the completeness contract', /never read source/],
    ['the UNDOCUMENTED source-pass grant', /`UNDOCUMENTED`, which permits one source pass/],
  ];

  for (const [what, pattern] of covers) {
    test(`it covers ${what}`, () => {
      assert.match(text(), pattern);
    });
  }

  test('it is operational instruction, never marketing', () => {
    assert.doesNotMatch(text(), /\b(revolutionary|seamless|powerful|best-in-class|simply)\b/i);
  });

  test('it carries no long dash (project style rule)', () => {
    assert.doesNotMatch(snippet(), LONG_DASH, 'long dash in published text, use a comma or a hyphen');
  });
});

describe('the gate really fails, it does not merely report', () => {
  const padded = () => `${text()} ${'padding tokens for the mutation check '.repeat(20)}`;

  test('the published snippet padded past the cap fails the same in-process gate', () => {
    const record = measureScope('priming', padded());
    assert.ok(record.measured > PRIMING_HARD_CAP, 'the mutation did not actually go over budget');
    assert.equal(record.pass, false, 'an over-cap snippet PASSED the gate, the gate asserts nothing');
  });

  // Process boundary: CI spawns the harness as a child, and what the parent
  // reads back must be exactly what the child measured.
  test('the harness CLI passes the published file and reports the same count as the parent', () => {
    const inParent = measureFile('priming', PRIMING);
    const run = harness('--scope', 'priming', '--file', PRIMING, '--json');
    assert.equal(
      run.status,
      0,
      `the published snippet failed the CLI gate:\n${run.stdout}${run.stderr}`,
    );
    const [record] = JSON.parse(run.stdout);
    assert.equal(record.scope, 'priming');
    assert.equal(record.pass, true);
    assert.equal(record.measured, inParent.measured, 'child and parent disagree on the count');
    assert.equal(record.limit, PRIMING_HARD_CAP);
  });

  test('a padded copy of the published snippet exits 1, naming the count and the cap', () => {
    const path = stage('priming.md', `${padded()}\n`);
    const run = harness('--scope', 'priming', '--file', path);
    const { measured } = measureFile('priming', path);
    assert.equal(run.status, 1, `an over-cap snippet must fail the build; stdout was:\n${run.stdout}`);
    assert.match(run.stdout, /FAIL {2}priming/);
    assert.ok(
      run.stderr.includes(
        `budget gate failed: priming measured ${measured} tokens against a budget of ${PRIMING_HARD_CAP}`,
      ),
      `stderr did not name the violation:\n${run.stderr}`,
    );
  });
});
