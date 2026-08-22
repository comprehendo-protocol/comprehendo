import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const load = () => import('./tokenizer.js');
const fixture = (name) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

// Golden vectors, produced by the reference tiktoken-class encoders. They pin the
// tokenizer's identity: any proxy count (words, chars/4) misses every one of them.
const GOLDEN = [
  ['Comprehendo', 3],
  ['ffmpeg', 2],
  ['$graphLookup', 3],
  ['how to crop a video', 5],
  ["Symbol.for('comprehendo')", 7],
  ['', 0],
  [' ', 1],
];

test('countTokens returns the exact tiktoken-class count for the golden vectors', async () => {
  const { countTokens } = await load();
  for (const [text, expected] of GOLDEN) {
    assert.equal(countTokens(text), expected, `count for ${JSON.stringify(text)}`);
  }
});

test('countTokens is not a word-count or character-count proxy', async () => {
  const { countTokens } = await load();
  const payload = JSON.stringify(JSON.parse(fixture('index.baseline.json')));
  const measured = countTokens(payload);
  const words = payload.split(/\s+/).filter(Boolean).length;
  const charProxy = Math.ceil(payload.length / 4);

  // Both proxies are wrong by a wide margin on real corpus content, which is the
  // whole reason this harness refuses to use them.
  assert.notEqual(measured, words);
  assert.notEqual(measured, charProxy);
  assert.ok(measured / words > 3, `token/word ratio was ${measured / words}`);
  assert.ok(Math.abs(measured - charProxy) > 50, 'char proxy was suspiciously close');
});

test('countTokens measures every declared encoding and reports the largest count', async () => {
  const { countTokens, countTokensWith, ENCODINGS } = await load();
  // "ffmpeg" is one token under cl100k_base and two under o200k_base. A hard cap
  // must hold in either accounting, so the harness reports the larger.
  assert.equal(countTokensWith('cl100k_base', 'ffmpeg'), 1);
  assert.equal(countTokensWith('o200k_base', 'ffmpeg'), 2);
  assert.equal(countTokens('ffmpeg'), 2);
  assert.ok(ENCODINGS.includes('o200k_base'));
  assert.ok(ENCODINGS.includes('cl100k_base'));
});

test('countTokensDetailed names the encoding that produced the measurement', async () => {
  const { countTokensDetailed, ENCODINGS } = await load();
  const detail = countTokensDetailed('ffmpeg');
  assert.equal(detail.measured, 2);
  assert.equal(detail.encoding, 'o200k_base');
  assert.ok(ENCODINGS.includes(detail.encoding));
  for (const name of ENCODINGS) {
    assert.equal(typeof detail.counts[name], 'number');
  }
});

test('ENCODINGS is a frozen, non-empty list', async () => {
  const { ENCODINGS } = await load();
  assert.ok(Object.isFrozen(ENCODINGS));
  assert.ok(ENCODINGS.length > 0);
});

test('countTokens rejects a non-string, it never silently coerces', async () => {
  const { countTokens } = await load();
  assert.throws(() => countTokens(undefined), TypeError);
  assert.throws(() => countTokens({ topics: [] }), TypeError);
  assert.throws(() => countTokens(42), TypeError);
});

test('countTokensWith rejects an encoding the harness does not declare', async () => {
  const { countTokensWith } = await load();
  assert.throws(() => countTokensWith('p50k_base', 'hello'), /p50k_base/);
});

// Measured text is submitted corpus/agent data, never instructions (the
// project's data-not-instructions rule). A literal special-token string
// inside that content must count as ordinary text, never crash the gate and
// never be interpreted as a real control token.
test('countTokens measures text containing a literal tiktoken special-token string, never throws', async () => {
  const { countTokens, countTokensWith } = await load();
  const specialStrings = [
    '<|endoftext|>',
    '<|endofprompt|>',
    '<|fim_prefix|>',
    '<|fim_middle|>',
    '<|fim_suffix|>',
  ];
  for (const special of specialStrings) {
    const payload = `some corpus text with ${special} embedded in it`;
    assert.doesNotThrow(() => countTokens(payload), `countTokens threw on ${special}`);
    for (const encoding of ['o200k_base', 'cl100k_base']) {
      assert.doesNotThrow(
        () => countTokensWith(encoding, payload),
        `countTokensWith(${encoding}) threw on ${special}`,
      );
    }
  }
});

test('a literal special-token string is counted as its own literal text, not collapsed to one control token', async () => {
  const { countTokens } = await load();
  // If the encoder were treating this as a real special token it would count as
  // exactly 1; measuring it as plain text yields several BPE tokens instead.
  const measured = countTokens('<|endoftext|>');
  assert.ok(measured > 1, `expected the literal string to cost more than 1 token, got ${measured}`);
});
