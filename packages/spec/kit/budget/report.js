/**
 * Rendering for the budget records. A budget the build never prints is a
 * budget nobody can ratchet down, so every run reports every scope, passing or
 * not.
 */
import { ENCODINGS } from './tokenizer.js';

const SCOPE_COLUMN = 10;

/**
 * @param {{ scope: string, limit: number, measured: number, pass: boolean }} record
 */
function formatRow(record) {
  const status = record.pass ? 'PASS' : 'FAIL';
  const over = record.pass ? '' : `  OVER BUDGET by ${record.measured - record.limit}`;
  const scope = record.scope.padEnd(SCOPE_COLUMN);
  const measured = String(record.measured).padStart(5);
  return `  ${status}  ${scope}${measured} / ${record.limit}${over}`;
}

/**
 * The human report: one line per scope, with the count and the budget it was
 * compared against, and the encoding set the count came from.
 *
 * @param {{ scope: string, limit: number, measured: number, pass: boolean }[]} records
 * @returns {string}
 */
export function formatReport(records) {
  const failed = records.filter((record) => !record.pass);
  const summary =
    failed.length === 0
      ? `${records.length} of ${records.length} scopes under budget`
      : `${failed.length} of ${records.length} scopes OVER BUDGET: ${failed.map((r) => r.scope).join(', ')}`;

  return [
    `comprehendo budget gate (CC5), tokenizer encodings: ${ENCODINGS.join(', ')}`,
    ...records.map(formatRow),
    summary,
  ].join('\n');
}

/**
 * The build-failing detail, one line per violation. Names the measured count
 * AND the budget it exceeded, never a bare "over budget".
 *
 * @param {{ scope: string, limit: number, measured: number, pass: boolean, encoding?: string }[]} records
 * @returns {string}
 */
export function formatFailure(records) {
  return records
    .filter((record) => !record.pass)
    .map(
      (record) =>
        `budget gate failed: ${record.scope} measured ${record.measured} tokens ` +
        `against a budget of ${record.limit} (OVER BUDGET by ${record.measured - record.limit}` +
        `${record.encoding ? `, ${record.encoding}` : ''})`,
    )
    .join('\n');
}
