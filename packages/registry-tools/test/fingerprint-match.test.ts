// Fingerprint Index & Matcher [21], the matcher.
//
// Precision-first: a match must satisfy every facet the entry declares, and
// more than one surviving candidate is an ambiguity, never a ranked guess
// (the doc's "no heuristic drift"). The CC10 [20] property test lives in
// cc10-honest-miss.property.test.ts; these are the example-based cases.

import { describe, expect, test } from 'vitest';

describe('a confident match needs every declared facet', () => {
  test('an error matching one entry on all its declared facets returns that entry', () => {
    expect.fail('MDD skeleton');
  });

  test('an error-class hit with a message miss is not a match', () => {
    expect.fail('MDD skeleton');
  });

  test('message patterns match literal segments with wildcards, anchored end to end', () => {
    expect.fail('MDD skeleton');
  });

  test('a stack shape matches its frame markers in order; out-of-order frames do not match', () => {
    expect.fail('MDD skeleton');
  });

  test('stderr text with no class and no stack matches on message pattern alone', () => {
    expect.fail('MDD skeleton');
  });
});

describe('an ambiguous match degrades to UNSTRUCTURED with candidates named', () => {
  test('two entries matching every declared facet return UNSTRUCTURED, not either twin', () => {
    expect.fail('MDD skeleton');
  });

  test('the UNSTRUCTURED twin names both candidates as package#entry', () => {
    expect.fail('MDD skeleton');
  });

  test('the UNSTRUCTURED twin preserves the raw message verbatim in received and guesses no fix', () => {
    expect.fail('MDD skeleton');
  });
});

describe('a miss is honest about what was considered', () => {
  test('a near miss names the candidates that were considered and rejected', () => {
    expect.fail('MDD skeleton');
  });

  test('each candidate reports the facets it matched and the facets it was rejected on', () => {
    expect.fail('MDD skeleton');
  });

  test('an input with nothing close returns UNSTRUCTURED with no candidates named', () => {
    expect.fail('MDD skeleton');
  });
});

describe('the static-pattern kind is indexed but not run against runtime errors', () => {
  test('a static-pattern entry never matches a caught error, and never makes one ambiguous', () => {
    expect.fail('MDD skeleton');
  });
});
