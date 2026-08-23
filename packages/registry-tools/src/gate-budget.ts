// RED-GATE STUB, replaced in the implement phase.

import type { PackedCorpus } from './corpus-format.js';
import type { GateFinding } from './gate-result.js';

export type BudgetScope = 'index' | 'topic';

export interface BudgetRecord {
  readonly scope: string;
  readonly limit: number;
  readonly measured: number;
  readonly pass: boolean;
}

export type BudgetMeter = (scope: BudgetScope, payload: unknown) => BudgetRecord;

export function budgetPayloads(
  _packed: PackedCorpus,
): readonly { readonly scope: BudgetScope; readonly at: string; readonly payload: unknown }[] {
  throw new Error('MDD skeleton');
}

export function budgetFindings(
  _packed: PackedCorpus,
  _directory: string,
  _meter: BudgetMeter,
): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}
