// Wrap Opt-In Proxy [24], the error path.
//
// Everything here routes through the REAL router from Router & Precedence
// [22] (`createRouter` over the toy sidecar corpus and 21's real fingerprint
// matcher), never a stand-in comprehend: what is under test is that a caught
// error leaving a wrapped call has already been through that router, and that
// the one place in this system that looks like monkey-patching stays fenced.

import { beforeAll, describe, expect, it } from 'vitest';

import { createRouter } from '../src/router.js';
import type { Router } from '../src/router.js';
import { probe } from '../src/marker.js';
import { UNSTRUCTURED_CODE } from '../src/twin.js';
import type { Twin } from '../src/twin.js';
import { wrap } from '../src/wrap.js';
import {
  TOY,
  TOY_CODE,
  TOY_RAW,
  TOY_RAW_NOVEL,
  markedBare,
  markedError,
  nativeTwin,
  toyEnvironment,
} from './helpers/sidecar.js';
import { FailsOnConstruction, ToyClient, toyFunction } from './helpers/wrap-target.js';

let router: Router;

beforeAll(async () => {
  router = createRouter(await toyEnvironment());
});

/** What the caller actually catches, as a twin-carrying value. */
const caught = (run: () => unknown): { value: unknown; twin: Twin | undefined } => {
  try {
    run();
  } catch (error) {
    return { value: error, twin: (error as { twin?: Twin }).twin };
  }
  throw new Error('expected the wrapped call to throw');
};

const caughtAsync = async (
  run: () => Promise<unknown>,
): Promise<{ value: unknown; twin: Twin | undefined }> => {
  try {
    await run();
  } catch (error) {
    return { value: error, twin: (error as { twin?: Twin }).twin };
  }
  throw new Error('expected the wrapped call to reject');
};

describe('a synchronous throw arrives twinned', () => {
  it('carries the installed corpus twin, with no comprehend() at the call site', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { twin } = caught(() => client.fail());

    expect(twin?.code).toBe(TOY_CODE);
    expect(twin?.fixes.map((fix) => fix.title)).toEqual([
      'Sort on the indexed field the pipeline already filters on',
      'Narrow the match before sorting, so the sort fits the memory ceiling',
    ]);
  });

  it('re-throws the SAME error instance, stack and type intact', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { value } = caught(() => client.fail());

    expect(value).toBeInstanceOf(Error);
    expect((value as Error).message).toBe(TOY_RAW);
    expect(typeof (value as Error).stack).toBe('string');
    expect((value as Error).stack).toContain('fail');
  });

  it('arrives UNSTRUCTURED, raw preserved, when the corpus has no entry', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW_NOVEL), router);

    const { twin } = caught(() => client.fail());

    expect(twin?.code).toBe(UNSTRUCTURED_CODE);
    expect(twin?.received).toBe(TOY_RAW_NOVEL);
    expect(twin?.fixes).toEqual([]);
  });

  it('twins a throw from a wrapped plain function too', () => {
    const call = wrap(toyFunction(TOY_RAW), router);

    expect(call('ok')).toBe('called:ok');
    expect(caught(() => call('throw')).twin?.code).toBe(TOY_CODE);
  });

  it('twins a throw from a wrapped constructor', () => {
    const Failing = wrap(FailsOnConstruction, router);

    expect(caught(() => new Failing(TOY_RAW)).twin?.code).toBe(TOY_CODE);
  });
});

describe('a method returning `this` stays routed for the rest of the chain', () => {
  // Found by review: `invoke` substitutes `this` back to the real target so
  // private fields resolve (see wrap.ts), but a method that RETURNS `this`
  // (the fluent/chainable shape) handed that same real target straight back
  // out. The next call in the chain then ran on the raw target, unwrapped,
  // and an error it threw escaped with no `.twin` at all, not even
  // UNSTRUCTURED, silently breaking the doc's core promise.
  it('keeps a synchronous chained call routed', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { twin } = caught(() => client.chain().fail());

    expect(twin?.code).toBe(TOY_CODE);
  });

  it('keeps an asynchronously chained call routed', async () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { twin } = await caughtAsync(async () => (await client.chainAsync()).fail());

    expect(twin?.code).toBe(TOY_CODE);
  });
});

describe('an asynchronous rejection arrives twinned the same way', () => {
  it('twins a rejected promise identically to the sync throw', async () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const rejected = await caughtAsync(() => client.failAsync());

    expect(rejected.twin?.code).toBe(TOY_CODE);
    expect(rejected.twin).toEqual(caught(() => client.fail()).twin);
  });

  it('routes a rejection the method never threw, only returned', async () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    expect((await caughtAsync(() => client.rejectAsync())).twin?.code).toBe(TOY_CODE);
  });

  it('routes through .catch() and Promise.all, not only await', async () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const viaCatch = await client.rejectAsync().catch((error: unknown) => error);
    const viaAll = await Promise.all([client.rejectAsync()]).catch((error: unknown) => error);

    expect((viaCatch as { twin?: Twin }).twin?.code).toBe(TOY_CODE);
    expect((viaAll as { twin?: Twin }).twin?.code).toBe(TOY_CODE);
  });

  it('leaves the caller unable to tell which kind of method it called', async () => {
    const client = wrap(new ToyClient('toy', TOY_RAW_NOVEL), router);

    const sync = caught(() => client.fail());
    const async_ = await caughtAsync(() => client.failAsync());

    expect(async_.twin).toEqual(sync.twin);
    expect(async_.twin?.code).toBe(UNSTRUCTURED_CODE);
  });
});

describe('values that cannot carry a twin get a carrier, never a lost error', () => {
  it('wraps a thrown string in an Error whose message is the twin reason (CC3)', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { value, twin } = caught(() => client.failWithString());

    expect(twin?.code).toBe(TOY_CODE);
    expect(value).toBeInstanceOf(Error);
    expect((value as Error).message).toBe(twin?.reason);
    expect((value as Error).message).not.toBe(TOY_RAW);
    expect((value as Error).cause).toBe(TOY_RAW);
  });

  it('wraps a frozen error rather than failing to attach', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { value, twin } = caught(() => client.failFrozen());

    expect(twin?.code).toBe(TOY_CODE);
    expect((value as Error).cause).toBeInstanceOf(Error);
    expect(((value as Error).cause as Error).message).toBe(TOY_RAW);
  });
});

describe('precedence and idempotence at the wrap boundary (CC8)', () => {
  it('passes a natively twinned error through untouched', () => {
    const native = markedError(TOY_RAW, nativeTwin('the native implementation explains itself'));
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { value, twin } = caught(() => client.failCarrying(native));

    expect(value).toBe(native);
    expect(twin?.code).toBe('NATIVE_SORT_SPILL');
  });

  it('defers to native for a marked error with no twin, never the sidecar twin', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { twin } = caught(() => client.failCarrying(markedBare(TOY_RAW)));

    expect(twin?.code).toBe(UNSTRUCTURED_CODE);
    expect(twin?.received).toBe(TOY_RAW);
  });

  it('does not even ask the router about an error that is already twinned', () => {
    let asked = 0;
    const counting = (raw: unknown): Twin => {
      asked += 1;
      return router.comprehend(raw);
    };
    const client = wrap(new ToyClient('toy', TOY_RAW), counting);

    caught(() => client.failCarrying(markedError(TOY_RAW, nativeTwin('native answer'))));
    expect(asked).toBe(0);

    caught(() => client.fail());
    expect(asked).toBe(1);
  });

  it('is idempotent: wrapping a wrapped target twins once, not twice', () => {
    const twice = wrap(wrap(new ToyClient('toy', TOY_RAW), router), router);
    const once = wrap(new ToyClient('toy', TOY_RAW), router);

    expect(caught(() => twice.fail()).twin).toEqual(caught(() => once.fail()).twin);
  });

  it('claims no marker: a wrapped throw never reads as natively adopted', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), router);

    const { value, twin } = caught(() => client.fail());

    expect(twin?.code).toBe(TOY_CODE);
    expect(probe(value)).toBeUndefined();
    expect(router.decideFor(TOY, value).source).toBe('sidecar');
  });
});

describe('the router is supplied, never invented', () => {
  it('accepts a bare comprehend function as well as a router object', () => {
    const client = wrap(new ToyClient('toy', TOY_RAW), (raw: unknown) => router.comprehend(raw));

    expect(caught(() => client.fail()).twin?.code).toBe(TOY_CODE);
  });

  it('throws a TypeError naming the fix when no router is given', () => {
    const target = new ToyClient('toy', TOY_RAW);

    expect(() => (wrap as (t: object, v?: unknown) => object)(target)).toThrow(TypeError);
    expect(() => (wrap as (t: object, v?: unknown) => object)(target)).toThrow(/comprehend/);
  });

  it('throws a TypeError for a target a proxy cannot be built over', () => {
    expect(() => (wrap as (t: unknown, v: unknown) => unknown)('not an object', router)).toThrow(
      TypeError,
    );
  });
});
