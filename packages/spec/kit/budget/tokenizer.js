/**
 * Real tiktoken-class token counting for the CC5 context-budget gates.
 *
 * There is no word-count or character-count proxy anywhere in this file, on
 * purpose: a "150 tokens" claim has to mean the same thing an agent's own
 * context accounting means, and a proxy is wrong by 3x to 5x on real corpus
 * content (see tokenizer.test.js, "not a word-count or character-count proxy").
 *
 * Every measurement runs through EVERY declared encoding and reports the
 * largest count. The tiktoken-class encodings disagree by real amounts
 * ("ffmpeg" is one token under cl100k_base, two under o200k_base), and a hard
 * cap has to hold in either accounting, so the harness bills the larger.
 */
import { getEncoding } from 'js-tiktoken';

/** The tiktoken-class encodings every budget is measured against. */
export const ENCODINGS = Object.freeze(['o200k_base', 'cl100k_base']);

/** @type {Map<string, { encode(text: string): number[] }>} */
const encoders = new Map();

function encoderFor(encoding) {
  if (!ENCODINGS.includes(encoding)) {
    throw new RangeError(
      `unknown encoding "${encoding}"; the budget harness measures with: ${ENCODINGS.join(', ')}`,
    );
  }
  let encoder = encoders.get(encoding);
  if (encoder === undefined) {
    encoder = getEncoding(encoding);
    encoders.set(encoding, encoder);
  }
  return encoder;
}

function assertText(text) {
  if (typeof text !== 'string') {
    throw new TypeError(
      `a budget is measured against text, received ${text === null ? 'null' : typeof text}; ` +
        'render the payload first (see measure.js renderPayload)',
    );
  }
}

/**
 * Token count of `text` under one named encoding.
 * @param {string} encoding
 * @param {string} text
 * @returns {number}
 */
export function countTokensWith(encoding, text) {
  assertText(text);
  return encoderFor(encoding).encode(text).length;
}

/**
 * Token count of `text` under every declared encoding, plus which one produced
 * the reported (largest) measurement.
 * @param {string} text
 * @returns {{ measured: number, encoding: string, counts: Readonly<Record<string, number>> }}
 */
export function countTokensDetailed(text) {
  assertText(text);
  /** @type {Record<string, number>} */
  const counts = {};
  let measured = -1;
  let encoding = ENCODINGS[0];
  for (const name of ENCODINGS) {
    const count = countTokensWith(name, text);
    counts[name] = count;
    if (count > measured) {
      measured = count;
      encoding = name;
    }
  }
  return { measured, encoding, counts: Object.freeze(counts) };
}

/**
 * The token count a budget is compared against.
 * @param {string} text
 * @returns {number}
 */
export function countTokens(text) {
  return countTokensDetailed(text).measured;
}
