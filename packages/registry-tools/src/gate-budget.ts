// CC5 [02]'s context budgets, charged against a corpus at submission time.
//
// The numbers and the counting are NOT reimplemented here. `packages/spec/kit/
// budget` owns both: the budgets ratchet one way in `budgets.js`, and
// `measure.js` counts with a real tiktoken-class tokenizer under every declared
// encoding, billing the larger. A word-count or character-count proxy is wrong
// by 3x to 5x on real corpus content, which is exactly why this module takes
// the meter as a port rather than approximating one.
//
// The port is not an escape hatch: `runSubmissionGate` reports the budget check
// as `not-run` when no meter is supplied, and a check that did not run never
// counts as passed. A gate that cannot measure does not get to say a corpus
// fits.
//
// What is measured is the PACKED docs half, because that is what an agent's
// context is really charged for: the menu (the index, the whole topic list at
// once) and each topic-sized answer on its own.

import type { PackedCorpus } from './corpus-format.js';
import { finding, type GateFinding } from './gate-result.js';

export type BudgetScope = 'index' | 'topic';

export interface BudgetRecord {
  readonly scope: string;
  readonly limit: number;
  readonly measured: number;
  readonly pass: boolean;
}

export type BudgetMeter = (scope: BudgetScope, payload: unknown) => BudgetRecord;

export interface BudgetPayload {
  readonly scope: BudgetScope;
  readonly at: string;
  readonly payload: unknown;
}

/**
 * Every payload a corpus is charged for. The index is measured in the harness's
 * own baseline shape (`{topics: [...]}`), so a corpus's menu is billed exactly
 * the way the kit's reference index is.
 */
export function budgetPayloads(packed: PackedCorpus): readonly BudgetPayload[] {
  return Object.freeze([
    { scope: 'index' as const, at: 'docs.index', payload: { topics: [...packed.docs.index] } },
    ...packed.docs.index.map((topic) => ({
      scope: 'topic' as const,
      at: `docs.topics.${topic}`,
      payload: packed.docs.topics[topic],
    })),
  ]);
}

export function budgetFindings(
  packed: PackedCorpus,
  directory: string,
  meter: BudgetMeter,
): readonly GateFinding[] {
  const found: GateFinding[] = [];
  for (const { scope, at, payload } of budgetPayloads(packed)) {
    const record = meter(scope, payload);
    if (record.pass) continue;
    found.push(
      finding(
        'budget',
        directory,
        at,
        `costs ${String(record.measured)} tokens against the ${scope} budget of ${String(record.limit)}; the index is a menu and a topic is one answer, never a dump`,
      ),
    );
  }
  return Object.freeze(found);
}
