/**
 * Wrap Opt-In Proxy [24] test support: a REAL target to wrap.
 *
 * Nothing here knows about `wrap`. It is an ordinary class of the shape a
 * consumer actually wraps (a client with sync and async methods, a getter, a
 * private field, a nested handle, a lazy thenable), so "the wrapped call
 * behaves identically to the unwrapped one" is a claim about a real object
 * rather than about a fixture built to agree with the proxy.
 */

/** A thenable that is NOT a promise and that EXECUTES when `then` is called. */
export class LazyQuery {
  executed = 0;

  constructor(private readonly value: string) {}

  then<R>(onFulfilled: (value: string) => R): Promise<R> {
    this.executed += 1;
    return Promise.resolve(onFulfilled(this.value));
  }
}

/** A client of the shape someone reaches for `wrap()` for. */
export class ToyClient {
  /** Private, so a proxy that gets `this` wrong fails loudly instead of quietly. */
  #calls = 0;

  label: string;

  /** A nested handle: reference identity through the proxy must survive. */
  readonly child: { readonly name: string } = { name: 'nested' };

  /** The last lazy thenable `query()` handed out, for an identity assertion. */
  lastQuery: LazyQuery | undefined;

  static kind = 'toy-client';

  constructor(
    label = 'toy',
    /** The raw text this client's failures carry. */
    private readonly raw = 'boom',
  ) {
    this.label = label;
  }

  get calls(): number {
    return this.#calls;
  }

  bump(by = 1): number {
    this.#calls += by;
    return this.#calls;
  }

  describe(): string {
    return `${this.label}/${this.#calls}`;
  }

  async load(key: string): Promise<string> {
    this.#calls += 1;
    return Promise.resolve(`${this.label}:${key}`);
  }

  /** Lazy, not a promise: calling `then` on it is what runs it. */
  query(): LazyQuery {
    this.lastQuery = new LazyQuery(this.label);
    return this.lastQuery;
  }

  fail(): never {
    this.#calls += 1;
    throw new Error(this.raw);
  }

  failWithString(): never {
    throw this.raw;
  }

  failFrozen(): never {
    throw Object.freeze(new Error(this.raw));
  }

  failCarrying(error: unknown): never {
    throw error;
  }

  async failAsync(): Promise<never> {
    this.#calls += 1;
    throw new Error(this.raw);
  }

  rejectAsync(): Promise<never> {
    return Promise.reject(new Error(this.raw));
  }
}

/** A callable target: `wrap` over a function, not only over an object. */
export function toyFunction(raw: string): (mode: 'ok' | 'throw') => string {
  return (mode) => {
    if (mode === 'throw') throw new Error(raw);
    return `called:${mode}`;
  };
}

/** A class whose CONSTRUCTOR fails, for the `new wrap(Class)()` path. */
export class FailsOnConstruction {
  constructor(raw: string) {
    throw new Error(raw);
  }
}

/**
 * One scripted, deterministic run over a client: every non-error observation
 * this build claims is identical wrapped and unwrapped, collected as data so
 * the two runs can be compared with one assertion.
 */
export async function scriptedRun(client: ToyClient): Promise<unknown[]> {
  const observed: unknown[] = [];
  observed.push(client.label, client.calls, ToyClient.kind);
  observed.push(client.bump(), client.bump(3), client.calls);
  observed.push(client.describe());
  observed.push(await client.load('key'));
  observed.push(client.child.name, client.query().executed);
  client.label = 'renamed';
  observed.push(client.label, client.describe(), Object.keys(client), JSON.stringify(client));
  observed.push(client instanceof ToyClient, typeof client.bump, client.bump.name);
  return observed;
}
