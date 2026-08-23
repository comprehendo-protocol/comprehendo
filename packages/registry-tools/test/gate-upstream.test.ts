// CC11 Registry Truth [25], enforced by Submission Gate [29]'s
// `verifyAgainstUpstream`: a corpus is a set of falsifiable claims about a real
// package, and this is where they are falsified.
//
// "Installs the actual target package" is the load-bearing verb in 25, so every
// test here runs against a package `npm pack` really packed and `npm install`
// really unpacked into a real node_modules tree. The gate then loads that
// installed module and calls it. Nothing is mocked, nothing is asserted about a
// shape: the failure is really thrown, and it is matched through Fingerprint
// Index & Matcher [21]'s real matcher.

import { afterEach, describe, expect, it } from 'vitest';

import { verifyAgainstUpstream, fixKey } from '../src/gate-upstream.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import {
  EMPTY_INPUT,
  EMPTY_INPUT_WITNESS,
  NO_PREFIX,
  NO_PREFIX_WITNESS,
  cleanAll,
  driftTarget,
  fixture,
  installTarget,
  plantMislabelled,
} from './helpers/gate-fixture.js';
import type { Fixture } from './helpers/gate-fixture.js';

afterEach(cleanAll);

const kinds = (verified: UpstreamVerification): readonly string[] =>
  verified.failures.map((failure) => failure.kind);

async function verified(
  made: Fixture,
  witnesses: readonly { code: string; induce: unknown }[] = [
    EMPTY_INPUT_WITNESS,
    NO_PREFIX_WITNESS,
  ],
  directory = made.name,
): Promise<UpstreamVerification> {
  return verifyAgainstUpstream({
    corpus: made.source(),
    directory,
    installRoot: installTarget(made),
    witnesses,
  });
}

describe('the gate verifies a corpus against the really-installed package', () => {
  it('resolves the package CI installed, by name and version', async () => {
    const made = await fixture();

    const result = await verified(made);

    expect(result.resolved).toEqual({ name: 'toy-encoder', version: '1.0.0' });
  });

  it('induces every cataloged failure out of the real package and reports its code', async () => {
    const made = await fixture();

    const result = await verified(made);

    expect([...result.inducedCodes].sort()).toEqual([EMPTY_INPUT, NO_PREFIX]);
    expect(result.failures).toEqual([]);
  });

  it("proves each fix by really applying it and retrying, never by the author's word", async () => {
    const made = await fixture();

    const result = await verified(made);

    expect(result.verifiedFixes).toContain(
      fixKey(EMPTY_INPUT, 'Call encode with a value it accepts'),
    );
    expect(result.verifiedFixes).toContain(
      fixKey(NO_PREFIX, 'Call decode with a value it accepts'),
    );
  });

  it('rejects a fingerprint the real package cannot be induced to produce, naming it', async () => {
    const made = await fixture();
    driftTarget(made);

    const result = await verified(made, [EMPTY_INPUT_WITNESS]);

    expect(kinds(result)).toContain('not-inducible');
    expect(result.failures.map((failure) => failure.at)).toContain(EMPTY_INPUT);
    expect(result.inducedCodes).not.toContain(EMPTY_INPUT);
  });

  it('rejects a witness whose real failure routes to a DIFFERENT cataloged entry', async () => {
    const made = await fixture();

    // The call really throws, and the thrown error really matches the corpus,
    // just not the entry the witness claims. Claiming another entry's error
    // patterns is exactly the routing hijack 25 exists to prevent.
    const result = await verified(made, [{ code: NO_PREFIX, induce: { encode: [''] } }]);

    expect(kinds(result)).toContain('misrouted');
    expect(result.failures.map((failure) => failure.detail).join(' ')).toContain(EMPTY_INPUT);
  });

  it("rejects a fix whose apply does not resolve the failure on retry", async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      fixes: Object.fromEntries(
        Object.entries(corpus.fixes).map(([id, list]) => [
          id,
          list.map((fix) => (id.includes('#encode#') ? { ...fix, apply: { encode: [''] } } : fix)),
        ]),
      ),
    }));

    const result = await verified(made, [EMPTY_INPUT_WITNESS]);

    expect(kinds(result)).toContain('fix-did-not-resolve');
    expect(result.verifiedFixes).not.toContain(
      fixKey(EMPTY_INPUT, 'Call encode with a value it accepts'),
    );
  });

  it('rejects a corpus directory that exact-matches no installed package (no typosquats)', async () => {
    const made = await fixture();

    const result = await verified(made, [EMPTY_INPUT_WITNESS], 'toy-encodr');

    expect(kinds(result)).toContain('no-such-package');
    expect(result.resolved).toBeUndefined();
  });

  it('rejects a directory whose installed package declares a different name', async () => {
    const made = await fixture();
    const installRoot = installTarget(made);
    plantMislabelled(installRoot, 'toy-encoderr', 'toy-encoder');

    const result = await verifyAgainstUpstream({
      corpus: made.source(),
      directory: 'toy-encoderr',
      installRoot,
      witnesses: [EMPTY_INPUT_WITNESS],
    });

    expect(kinds(result)).toContain('directory-mismatch');
  });

  it('reports an unloadable installed package rather than treating it as verified', async () => {
    const made = await fixture();
    const installRoot = installTarget(made);
    plantMislabelled(installRoot, 'toy-broken', 'toy-broken');

    const result = await verifyAgainstUpstream({
      corpus: made.source(),
      directory: 'toy-broken',
      installRoot,
      witnesses: [EMPTY_INPUT_WITNESS],
      load: () => Promise.reject(new SyntaxError('Unexpected end of input')),
    });

    expect(kinds(result)).toContain('unloadable');
    expect(result.inducedCodes).toEqual([]);
  });

  it('reports a witness naming an operation the package does not export', async () => {
    const made = await fixture();

    const result = await verified(made, [{ code: EMPTY_INPUT, induce: { transcode: [''] } }]);

    expect(kinds(result)).toContain('unrunnable-witness');
  });

  it('reports a witness for a code the corpus does not catalog', async () => {
    const made = await fixture();

    const result = await verified(made, [{ code: 'TOY_NOT_CATALOGED', induce: { encode: [''] } }]);

    expect(kinds(result)).toContain('unrunnable-witness');
  });
});
