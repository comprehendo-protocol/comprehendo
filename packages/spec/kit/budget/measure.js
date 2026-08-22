/**
 * Turns an artifact into a CC5 budget record:
 * `{ scope, limit, measured, pass }` (plus the encoding that produced the
 * count, so a number is never ambiguous about what it counted).
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUDGETS, SCOPES } from './budgets.js';
import { countTokensDetailed } from './tokenizer.js';

/**
 * The kit's own worked examples. These set the Wave-1 numbers and are
 * re-measured on every run; later waves point the harness at real output
 * instead (`--scope <scope> --file <path>`).
 */
export const BASELINE_FIXTURES = Object.freeze({
  index: 'fixtures/index.baseline.json',
  topic: 'fixtures/topic.baseline.json',
  priming: 'fixtures/priming.reference.md',
});

const fixturePath = (relative) => fileURLToPath(new URL(`./${relative}`, import.meta.url));

function assertScope(scope) {
  if (!SCOPES.includes(scope)) {
    throw new RangeError(
      `unknown budget scope "${scope}"; CC5 defines: ${SCOPES.join(', ')}`,
    );
  }
}

/**
 * The exact text a budget is charged for. A response object costs what its
 * serialized payload costs, so it is measured compact, the way it crosses into
 * an agent's context; a text artifact costs its own text, trimmed, because
 * trailing newlines in a file are not part of the snippet.
 *
 * @param {unknown} payload
 * @returns {string}
 */
export function renderPayload(payload) {
  return typeof payload === 'string' ? payload.trim() : JSON.stringify(payload);
}

/**
 * @param {string} scope
 * @param {unknown} payload
 * @returns {{ scope: string, limit: number, measured: number, pass: boolean, encoding: string }}
 */
export function measureScope(scope, payload) {
  assertScope(scope);
  const limit = BUDGETS[scope];
  const { measured, encoding } = countTokensDetailed(renderPayload(payload));
  return { scope, limit, measured, pass: measured <= limit, encoding };
}

/**
 * Measure an artifact on disk. `.json` is parsed and measured as the response
 * payload it represents; anything else is measured as its own text.
 *
 * @param {string} scope
 * @param {string} path
 */
export function measureFile(scope, path) {
  assertScope(scope);
  if (!existsSync(path)) {
    throw new Error(`cannot measure ${scope} budget: no such artifact at ${path}`);
  }
  const raw = readFileSync(path, 'utf8');
  const payload = path.endsWith('.json') ? JSON.parse(raw) : raw;
  return measureScope(scope, payload);
}

/**
 * One record per scope, measured against the kit's baseline fixtures. This is
 * what the harness reports when CI runs it with no arguments.
 *
 * @returns {ReturnType<typeof measureScope>[]}
 */
export function measureBaselines() {
  return SCOPES.map((scope) => measureFile(scope, fixturePath(BASELINE_FIXTURES[scope])));
}
