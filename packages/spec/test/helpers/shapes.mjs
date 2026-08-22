// Shared test helper for the shape-schema suite.
//
// One place that knows where the schemas live, which shapes the RFC names,
// and how to compile them. Every test file imports from here; nothing
// re-inlines the loader or the shape list.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';

export const SHAPES_DIR = fileURLToPath(
  new URL('../../kit/shapes/', import.meta.url),
);

export const SCHEMA_ID_BASE = 'https://comprehendo.dev/schemas/0.1/';

/**
 * The shapes the RFC names, one row per schema file.
 *
 * `rfc` is the section of MDs/comprehendo-spec.md that defines the shape;
 * `surface` is the row of the Protocol Surface table (mdd-comprehendo-spec.md
 * lines 553-576) the shape belongs to. Business rule: no schema exists that
 * the RFC does not name, and no named shape lacks a schema.
 */
export const NAMED_SHAPES = [
  { file: 'twin.schema.json', rfc: '5.1.1', surface: 'twinned errors' },
  { file: 'fix.schema.json', rfc: '5.1.2', surface: 'twinned errors' },
  { file: 'topic.schema.json', rfc: '5.2.2', surface: 'docs(query?)' },
  { file: 'index.schema.json', rfc: '5.2.1', surface: 'docs(query?)' },
  { file: 'entry.schema.json', rfc: '4.2', surface: 'identity + priming' },
  { file: 'undocumented.schema.json', rfc: '5.2.3', surface: 'docs(query?)' },
  { file: 'unvalidatable.schema.json', rfc: '5.3.2', surface: 'validate(input)' },
  { file: 'explanation.schema.json', rfc: '5.4', surface: 'explain(input)' },
  { file: 'manifest.schema.json', rfc: '4.3', surface: 'identity + priming' },
  { file: 'config.schema.json', rfc: '10.5', surface: 'consumer configuration' },
];

/** Every schema file actually present on disk, sorted. */
export function listSchemaFiles() {
  return readdirSync(SHAPES_DIR)
    .filter((name) => name.endsWith('.schema.json'))
    .sort();
}

/** Read one schema file as parsed JSON. Throws if absent or malformed. */
export function readSchema(file) {
  return JSON.parse(readFileSync(join(SHAPES_DIR, file), 'utf8'));
}

/** Read every schema file on disk as a Map of file name to parsed JSON. */
export function readAllSchemas() {
  return new Map(listSchemaFiles().map((file) => [file, readSchema(file)]));
}

/**
 * An Ajv instance with every schema on disk registered, so cross-file
 * `$ref`s (twin -> fix) resolve. `strict` stays on: a typo'd keyword in a
 * schema that is the project's frozen contract must be an error, never a
 * silently ignored annotation.
 */
export function makeValidator() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  for (const schema of readAllSchemas().values()) ajv.addSchema(schema);
  return ajv;
}

/** Compile the validator for one shape file. */
export function compile(ajv, file) {
  return ajv.getSchema(SCHEMA_ID_BASE + file);
}

/** Walk every node of a parsed schema, yielding [pointer, node] pairs. */
export function* walk(node, pointer = '') {
  if (node === null || typeof node !== 'object') return;
  yield [pointer || '/', node];
  for (const [key, value] of Object.entries(node)) {
    yield* walk(value, `${pointer}/${key}`);
  }
}
