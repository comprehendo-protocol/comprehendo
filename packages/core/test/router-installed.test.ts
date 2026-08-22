// Router & Precedence [22], against a real installed tree.
//
// This is the suite that stops the router's precedence rules from being a
// story told to a mock. Every corpus here is a real package written to a real
// temp directory, discovered by reading real files; the fingerprint index is
// built by Fingerprint Index & Matcher [21]'s real matcher; and the "native
// toy is installed" step writes, imports and RUNS a real natively adopted
// package, catches the error it really throws, and hands it to the same
// router instance that answered from the sidecar a moment earlier.
//
// Acceptance criterion 4 ("installing the native toy flips precedence
// automatically, no router reconfiguration") is only meaningful if nothing is
// reconfigured, so the router object built in the first half is the one used
// in the second.

import { describe, expect, it } from 'vitest';

describe('discovering installed corpora from a real node_modules tree', () => {
  it('finds a real @comprehendo/<toy> package on disk and names its target', () => {
    expect.fail('MDD skeleton');
  });

  it('loads the compiled fingerprint artifact through the real matcher', () => {
    expect.fail('MDD skeleton');
  });

  it('reports a corpus package missing its artifacts as a defect, never silently', () => {
    expect.fail('MDD skeleton');
  });

  it('reads the target package real manifest as native evidence', () => {
    expect.fail('MDD skeleton');
  });

  it('ignores a non-corpus package sitting in the same scope directory', () => {
    expect.fail('MDD skeleton');
  });
});

describe('an un-adopted toy package, end to end', () => {
  it('comprehends a real caught error into the sidecar twin', () => {
    expect.fail('MDD skeleton');
  });

  it('answers docs(toy, query) from the corpus packages real packed artifact', () => {
    expect.fail('MDD skeleton');
  });

  it('returns UNSTRUCTURED for an error the installed corpus does not cover', () => {
    expect.fail('MDD skeleton');
  });
});

describe('installing the native toy flips precedence, no reconfiguration', () => {
  it('the generated native toy really speaks the protocol', () => {
    expect.fail('MDD skeleton');
  });

  it('the same router instance routes the newly native toy to native', () => {
    expect.fail('MDD skeleton');
  });

  it('returns the toys own twin, never the sidecar twin', () => {
    expect.fail('MDD skeleton');
  });

  it('a fresh discovery sees the native manifest stamped into the toy package.json', () => {
    expect.fail('MDD skeleton');
  });

  it('prefer sidecar still routes the natively installed toy to the sidecar', () => {
    expect.fail('MDD skeleton');
  });
});
