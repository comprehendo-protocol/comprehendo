// Set-level integrity of the shape schemas.
//
// Acceptance criterion 1: every shape named in the RFC's Protocol Surface
// table has a corresponding JSON Schema file in packages/spec/kit/shapes/.
// Business rule: no schema exists that the RFC does not name, and no named
// shape lacks a schema.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NAMED_SHAPES,
  SCHEMA_ID_BASE,
  listSchemaFiles,
  makeValidator,
  readSchema,
  walk,
} from './helpers/shapes.mjs';

describe('shape schema set', () => {
  test('the files on disk are exactly the shapes the RFC names', () => {
    const expected = NAMED_SHAPES.map((s) => s.file).sort();
    assert.deepEqual(listSchemaFiles(), expected);
  });

  for (const shape of NAMED_SHAPES) {
    describe(shape.file, () => {
      test(`is valid JSON (RFC ${shape.rfc})`, () => {
        const schema = readSchema(shape.file);
        assert.equal(typeof schema, 'object');
        assert.notEqual(schema, null);
      });

      test('declares JSON Schema draft 2020-12', () => {
        assert.equal(
          readSchema(shape.file).$schema,
          'https://json-schema.org/draft/2020-12/schema',
        );
      });

      test('declares the canonical $id for its file name', () => {
        assert.equal(readSchema(shape.file).$id, SCHEMA_ID_BASE + shape.file);
      });

      test('carries a title and a description', () => {
        const schema = readSchema(shape.file);
        assert.equal(typeof schema.title, 'string');
        assert.ok(schema.title.length > 0, 'title must not be empty');
        assert.equal(typeof schema.description, 'string');
        assert.ok(schema.description.length > 0, 'description must not be empty');
      });

      test('cites the RFC section it comes from', () => {
        const schema = readSchema(shape.file);
        assert.match(
          schema.description,
          new RegExp(`RFC \\u00a7${shape.rfc.replace('.', '\\.')}`),
          `description must cite RFC §${shape.rfc}`,
        );
      });

      test('compiles under Ajv strict mode', () => {
        const ajv = makeValidator();
        const validate = ajv.getSchema(SCHEMA_ID_BASE + shape.file);
        assert.equal(typeof validate, 'function');
      });

      // RFC §11: within a major, fields are only ever added, and agents and
      // implementations MUST ignore fields they do not recognize. A schema
      // that closes its object rejects a conforming future document, which
      // is exactly the failure the forward-compat fixture [04] hunts.
      test('never closes an object against future fields', () => {
        for (const [pointer, node] of walk(readSchema(shape.file))) {
          assert.notEqual(
            node.additionalProperties,
            false,
            `additionalProperties: false at ${pointer}`,
          );
          assert.notEqual(
            node.unevaluatedProperties,
            false,
            `unevaluatedProperties: false at ${pointer}`,
          );
        }
      });
    });
  }

  test('every $ref between schemas resolves', () => {
    const ajv = makeValidator();
    for (const shape of NAMED_SHAPES) {
      const validate = ajv.getSchema(SCHEMA_ID_BASE + shape.file);
      assert.equal(typeof validate, 'function', `${shape.file} did not resolve`);
    }
  });
});
