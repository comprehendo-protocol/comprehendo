/**
 * The CC5 context budgets. This file is where the numbers live, and it is a
 * one-way door: budgets only ever ratchet DOWN (see assertRatchet).
 */

/**
 * CC5's absolute ceiling for the priming snippet. Not a default, not tunable:
 * a snippet over this does not ship, in any wave.
 */
export const PRIMING_HARD_CAP = 150;

/** The three measured surfaces. */
export const SCOPES = Object.freeze(['index', 'topic', 'priming']);

/**
 * What the kit's own Wave-1 worked examples measure, in tokens, under the
 * harness's encoding set. These are evidence, not policy: measure.test.js
 * re-measures the fixtures on every run and goes red if any of these drift, so
 * the budgets below can never quietly detach from what they were derived from.
 *
 *   index    fixtures/index.baseline.json   214 topic names, the reference
 *                                           corpus scale the source spec
 *                                           states ("~200 one-topic files")
 *   topic    fixtures/topic.baseline.json   one worked topic: summary,
 *                                           signatures, three examples, see_also
 *   priming  fixtures/priming.reference.md  the RFC section 5.5 reference snippet
 */
export const BASELINES = Object.freeze({
  index: 914,
  topic: 383,
  priming: 127,
});

/**
 * The fixed Wave-1 budgets, in tokens. Set once, here, from BASELINES above,
 * rounded up to clean numbers with bounded headroom (budgets.test.js asserts
 * every limit sits between its baseline and 2x its baseline, so a future edit
 * cannot invent a number).
 *
 *   index    1200  the 914-token reference-scale index plus room for roughly
 *                  60 more topics before a corpus has to split
 *   topic     600  a topic-sized answer: the 383-token worked example plus room
 *                  for a longer summary or a fourth example, and nowhere near a
 *                  dump
 *   priming   150  CC5's hard cap, unchanged (baseline 127)
 *
 * Frozen because CC5 calls these fixed: nothing in the process may raise a
 * budget at runtime.
 */
export const BUDGETS = Object.freeze({
  index: 1200,
  topic: 600,
  priming: PRIMING_HARD_CAP,
});

function limitOf(table, scope, side) {
  const limit = table?.[scope];
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) {
    throw new RangeError(
      `budget ratchet violation: the ${side} budget table has no usable limit for "${scope}" ` +
        `(found ${JSON.stringify(limit)}); a scope cannot be dropped or blanked to escape its budget`,
    );
  }
  return limit;
}

/**
 * The one-way door. `next` may tighten a budget or leave it alone; anything
 * that would loosen one is itself a CC5 violation. CI supplies `previous` by
 * reading this module from the base ref.
 *
 * @param {Record<string, number>} previous
 * @param {Record<string, number>} next
 */
export function assertRatchet(previous, next) {
  for (const scope of SCOPES) {
    const before = limitOf(previous, scope, 'previous');
    const after = limitOf(next, scope, 'proposed');

    if (scope === 'priming' && after > PRIMING_HARD_CAP) {
      throw new RangeError(
        `budget ratchet violation: priming budget ${after} exceeds the ${PRIMING_HARD_CAP} token hard cap, ` +
          'which no wave may raise',
      );
    }
    if (after > before) {
      throw new RangeError(
        `budget ratchet violation: ${scope} budget would loosen from ${before} to ${after}; ` +
          'CC5 budgets only ratchet down',
      );
    }
  }
}
