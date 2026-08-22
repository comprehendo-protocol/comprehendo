// Router & Precedence [22], the `comprehend(raw)` surface.
//
// Whatever the agent caught goes in, a twin or an honest UNSTRUCTURED comes
// out, with no cooperation from the target package and no side effects. The
// match itself belongs to Fingerprint Index & Matcher [21] and is not
// re-tested here; what is tested is that the router dispatches to it, builds
// the corpus twin through Twin Builder [12], and never invents an answer.

import { describe, expect, it } from 'vitest';

describe('comprehend(raw) on an un-adopted package', () => {
  it('returns the installed corpus twin for a caught error that fingerprints', () => {
    expect.fail('MDD skeleton');
  });

  it('carries the corpus entry code, reason and fixes in author order', () => {
    expect.fail('MDD skeleton');
  });

  it('routes bare stderr text the same way as a caught error', () => {
    expect.fail('MDD skeleton');
  });

  it('returns a frozen twin', () => {
    expect.fail('MDD skeleton');
  });

  it('needs no cooperation: the target package is never loaded or touched', () => {
    expect.fail('MDD skeleton');
  });
});

describe('an unknown error is UNSTRUCTURED, never a wrong match', () => {
  it('returns code UNSTRUCTURED with no fixes when nothing fingerprints', () => {
    expect.fail('MDD skeleton');
  });

  it('preserves the raw message verbatim in received', () => {
    expect.fail('MDD skeleton');
  });

  it('names the candidates it considered on an ambiguous match (CC10)', () => {
    expect.fail('MDD skeleton');
  });

  it('never returns one of the ambiguous candidates twins', () => {
    expect.fail('MDD skeleton');
  });
});

describe('native precedence at the comprehend surface (CC8)', () => {
  it('returns the packages own twin for a marked error, never the sidecar one', () => {
    expect.fail('MDD skeleton');
  });

  it('returns UNSTRUCTURED for a marked error carrying no twin of its own', () => {
    expect.fail('MDD skeleton');
  });

  it('returns the sidecar twin for that same marked error under prefer sidecar', () => {
    expect.fail('MDD skeleton');
  });
});

describe('comprehend(raw) is side-effect free', () => {
  it('does not mutate the raw value', () => {
    expect.fail('MDD skeleton');
  });

  it('only reads properties of the raw value', () => {
    expect.fail('MDD skeleton');
  });

  it('reaches no I/O: the routing module imports no node builtin', () => {
    expect.fail('MDD skeleton');
  });

  it('returns equal twins for repeated calls with the same input', () => {
    expect.fail('MDD skeleton');
  });
});
