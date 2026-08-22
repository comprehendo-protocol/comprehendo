#!/usr/bin/env node
/**
 * The CC5 budget gate, as CI invokes it.
 *
 *   node kit/budget/run.js                          measure the kit baselines
 *   node kit/budget/run.js --json                   the same, as budget records
 *   node kit/budget/run.js --scope topic --file X   measure one real artifact
 *
 * Exit codes: 0 every scope under budget, 1 at least one scope OVER budget
 * (red, never a warning), 2 a usage error (unknown scope, missing artifact).
 * stdout is the report, stderr is the reason a build failed, so `--json`
 * output stays parseable in every case.
 */
import { parseArgs } from 'node:util';
import { SCOPES } from './budgets.js';
import { measureBaselines, measureFile } from './measure.js';
import { formatFailure, formatReport } from './report.js';

const EXIT_OK = 0;
const EXIT_OVER_BUDGET = 1;
const EXIT_USAGE = 2;

const USAGE = [
  'Usage: comprehendo-budget [--json] [--scope <scope> --file <path>]',
  '',
  `  --scope   one of: ${SCOPES.join(', ')}`,
  '  --file    the artifact to measure (.json is parsed as a response payload)',
  '  --json    emit budget records instead of the human report',
  '',
  'With no --scope/--file the kit baseline fixtures are measured.',
].join('\n');

const out = (text) => process.stdout.write(`${text}\n`);
const err = (text) => process.stderr.write(`${text}\n`);

function parse(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      json: { type: 'boolean', default: false },
      scope: { type: 'string' },
      file: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });
  if (Boolean(values.scope) !== Boolean(values.file)) {
    throw new RangeError('--scope and --file are used together: name the scope and the artifact');
  }
  return values;
}

/**
 * @param {string[]} argv
 * @returns {number} the process exit code
 */
export function main(argv) {
  let values;
  let records;
  try {
    values = parse(argv);
    if (values.help) {
      out(USAGE);
      return EXIT_OK;
    }
    records = values.scope ? [measureFile(values.scope, values.file)] : measureBaselines();
  } catch (cause) {
    err(cause.message);
    err(USAGE);
    return EXIT_USAGE;
  }

  out(values.json ? JSON.stringify(records, null, 2) : formatReport(records));

  if (records.every((record) => record.pass)) {
    return EXIT_OK;
  }
  err(formatFailure(records));
  return EXIT_OVER_BUDGET;
}

process.exitCode = main(process.argv.slice(2));
