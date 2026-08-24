// The CC5 [02] budget harness itself, not a copy of its numbers. Shared
// across every corpus's own gate test (ffmpeg's own copy stays where it is;
// new corpora import this one, so there is exactly one place that resolves
// the real meter module).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { BudgetMeter, BudgetRecord, BudgetScope } from '../../src/gate-budget.js';

export async function specMeter(): Promise<BudgetMeter> {
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(import.meta.dirname, '..', '..', '..', 'spec', 'kit', 'budget', 'measure.js'),
    ).href
  )) as { measureScope: (scope: string, payload: unknown) => BudgetRecord };
  return (scope: BudgetScope, payload: unknown): BudgetRecord => module.measureScope(scope, payload);
}
