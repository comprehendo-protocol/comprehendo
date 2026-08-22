// Router & Precedence [22], the `comprehend(raw)` surface.
//
// Whatever the agent caught goes in, a twin or an honest UNSTRUCTURED comes
// out, with no cooperation from the target package and no side effects. The
// match itself belongs to Fingerprint Index & Matcher [21] and is not
// re-tested here; what is tested is that the router dispatches to it, builds
// the corpus twin through Twin Builder [12], and never invents an answer.

import { beforeAll, describe, expect, it } from 'vitest';

import { createRouter } from '../src/router.js';
import type { Environment, Router } from '../src/router.js';
import { UNSTRUCTURED_CODE } from '../src/twin.js';
import { snapshot, watch } from './helpers/marker-fixtures.js';
import { FORBIDDEN_MODULES, findForbiddenImports, readCoreSources } from './helpers/source-scan.js';
import {
  RIVAL_FINGERPRINT,
  TOY,
  TOY_CODE,
  TOY_FINGERPRINT,
  TOY_RAW,
  TOY_RAW_NOVEL,
  markedBare,
  markedError,
  nativeTwin,
  toyEnvironment,
} from './helpers/sidecar.js';

let environment: Environment;
let router: Router;

beforeAll(async () => {
  environment = await toyEnvironment();
  router = createRouter(environment);
});

describe('comprehend(raw) on an un-adopted package', () => {
  it('returns the installed corpus twin for a caught error that fingerprints', () => {
    const twin = router.comprehend(new Error(TOY_RAW));

    expect(twin.code).toBe(TOY_CODE);
    expect(twin.comprehendo).toBe('0.1');
  });

  it('carries the corpus entry code, reason and fixes in author order', () => {
    const twin = router.comprehend(new Error(TOY_RAW));

    expect(twin.reason).toContain('no index to satisfy it');
    expect(twin.fixes.map((fix) => fix.title)).toEqual([
      'Sort on the indexed field the pipeline already filters on',
      'Narrow the match before sorting, so the sort fits the memory ceiling',
    ]);
    expect(twin.received).toBe(TOY_RAW);
  });

  it('routes bare stderr text the same way as a caught error', () => {
    expect(router.comprehend(TOY_RAW).code).toBe(TOY_CODE);
    expect(router.comprehend(TOY_RAW)).toEqual(router.comprehend(new Error(TOY_RAW)));
  });

  it('returns a frozen twin', () => {
    const twin = router.comprehend(TOY_RAW);

    expect(Object.isFrozen(twin)).toBe(true);
    expect(Object.isFrozen(twin.fixes)).toBe(true);
  });

  it('needs no cooperation: the target package is never loaded or touched', () => {
    // The input is a bare string. Nothing was imported from the target
    // package, nothing was probed on it, and it declared nothing: the corpus
    // and the fingerprint index are the only things in play.
    expect(router.packages).toEqual([TOY]);
    expect(router.comprehend(TOY_RAW).code).toBe(TOY_CODE);
  });
});

describe('an unknown error is UNSTRUCTURED, never a wrong match', () => {
  it('returns code UNSTRUCTURED with no fixes when nothing fingerprints', () => {
    const twin = router.comprehend(new Error(TOY_RAW_NOVEL));

    expect(twin.code).toBe(UNSTRUCTURED_CODE);
    expect(twin.fixes).toEqual([]);
  });

  it('preserves the raw message verbatim in received', () => {
    expect(router.comprehend(new Error(TOY_RAW_NOVEL)).received).toBe(TOY_RAW_NOVEL);
    expect(router.comprehend(TOY_RAW_NOVEL).received).toBe(TOY_RAW_NOVEL);
  });

  it('names the candidates it considered on an ambiguous match (CC10)', async () => {
    const ambiguous = createRouter(
      await toyEnvironment({ fingerprints: [TOY_FINGERPRINT, RIVAL_FINGERPRINT] }),
    );

    const twin = ambiguous.comprehend(TOY_RAW);

    expect(twin.code).toBe(UNSTRUCTURED_CODE);
    expect([...(twin.accepts ?? [])].sort()).toEqual([
      'mongodb-operator#SORT_UNINDEXED_SPILL',
      'other-store#MEMORY_CEILING',
    ]);
  });

  it('never returns one of the ambiguous candidates twins', async () => {
    const ambiguous = createRouter(
      await toyEnvironment({ fingerprints: [TOY_FINGERPRINT, RIVAL_FINGERPRINT] }),
    );

    const twin = ambiguous.comprehend(TOY_RAW);

    expect(twin.code).not.toBe(TOY_CODE);
    expect(twin.fixes).toEqual([]);
  });
});

describe('native precedence at the comprehend surface (CC8)', () => {
  it('returns the packages own twin for a marked error, never the sidecar one', () => {
    const raised = markedError(TOY_RAW, nativeTwin('the native implementation explains itself'));

    const twin = router.comprehend(raised);

    expect(twin.code).toBe('NATIVE_SORT_SPILL');
    expect(router.decideFor(TOY, raised).source).toBe('native');
  });

  it('returns UNSTRUCTURED for a marked error carrying no twin of its own', () => {
    // Native won, and native has no entry for this failure. The honest answer
    // is the one the native provider would give, never the sidecar's twin.
    const twin = router.comprehend(markedBare(TOY_RAW));

    expect(twin.code).toBe(UNSTRUCTURED_CODE);
    expect(twin.received).toBe(TOY_RAW);
  });

  it('returns the sidecar twin for that same marked error under prefer sidecar', () => {
    const preferring = createRouter(environment, { prefer: { [TOY]: 'sidecar' } });

    expect(preferring.comprehend(markedBare(TOY_RAW)).code).toBe(TOY_CODE);
    expect(
      preferring.comprehend(markedError(TOY_RAW, nativeTwin('native answer'))).code,
    ).toBe(TOY_CODE);
  });
});

describe('comprehend(raw) is side-effect free', () => {
  it('does not mutate the raw value', () => {
    const raw = new Error(TOY_RAW);
    const before = snapshot(raw);

    router.comprehend(raw);

    expect(snapshot(raw)).toBe(before);
  });

  it('only reads properties of the raw value', () => {
    const watched = watch(new Error(TOY_RAW));

    router.comprehend(watched.value);

    const mutations = watched.traps.filter((trap) =>
      /^(set|defineProperty|deleteProperty|preventExtensions):/.test(trap),
    );
    expect(mutations).toEqual([]);
    expect(watched.traps.length).toBeGreaterThan(0);
  });

  it.each([...FORBIDDEN_MODULES])('reaches no I/O: the routing modules import no %s', (name) => {
    const routing = readCoreSources().filter(
      (source) => source.path === 'router.ts' || source.path === 'router-precedence.ts',
    );

    expect(routing).toHaveLength(2);
    const offenders = routing
      .filter((source) => findForbiddenImports(source.text).includes(name))
      .map((source) => source.path);

    expect(offenders).toEqual([]);
  });

  it('returns equal twins for repeated calls with the same input', () => {
    const raw = new Error(TOY_RAW);

    expect(router.comprehend(raw)).toEqual(router.comprehend(raw));
    expect(router.comprehend(TOY_RAW_NOVEL)).toEqual(router.comprehend(TOY_RAW_NOVEL));
  });
});
