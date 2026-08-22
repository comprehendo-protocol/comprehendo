/**
 * Shared fixtures and observation harnesses for the marker tests.
 *
 * The sample entry is kept structurally identical to the conformance kit's
 * `probe-hit` entry (packages/spec/kit/fixtures/probe-hit.json); a drift test
 * asserts that, so this file can never quietly diverge from the kit.
 */
import { COMPREHENDO_MARKER, type ComprehendoEntry } from '../../src/marker.js';
import { at, readKitJson } from './source-scan.js';

/** A fresh, unfrozen entry. Fresh per call: attaching freezes it. */
export function makeSampleEntry(): ComprehendoEntry {
  return {
    comprehendo: '0.1',
    name: 'mongodb-operator',
    level: 2,
    surfaces: ['docs', 'validate', 'explain'],
    identity: 'mongodb-operator is a pipeline-first wrapper over a document database.',
    priming: 'The packages in this project speak Comprehendo. Probe the handle or the caught error.',
  };
}

/** The entry the kit's `probe-hit` fixture says a successful probe returns. */
export function kitProbeHitEntry(): unknown {
  return at(readKitJson('fixtures', 'probe-hit.json'), 'steps', '0', 'response');
}

export interface Watched<T extends object> {
  /** The proxy to hand to the code under observation. */
  readonly value: T;
  /** Every trap that fired, in order, as `trap:key`. */
  readonly traps: string[];
}

/**
 * Wrap a value in a Proxy that records every trap. This is how the purity test
 * proves "one property read, nothing else": a mutating probe would show a
 * `set`, `defineProperty`, or `deleteProperty` trap, and a caching one would
 * show extra reads.
 */
export function watch<T extends object>(target: T): Watched<T> {
  const traps: string[] = [];
  const note = (trap: string, key: PropertyKey = ''): void => {
    traps.push(`${trap}:${String(key)}`);
  };
  const value = new Proxy(target, {
    get(object, key, receiver) {
      note('get', key);
      return Reflect.get(object, key, receiver) as unknown;
    },
    set(object, key, incoming: unknown, receiver) {
      note('set', key);
      return Reflect.set(object, key, incoming, receiver);
    },
    has(object, key) {
      note('has', key);
      return Reflect.has(object, key);
    },
    deleteProperty(object, key) {
      note('deleteProperty', key);
      return Reflect.deleteProperty(object, key);
    },
    defineProperty(object, key, descriptor) {
      note('defineProperty', key);
      return Reflect.defineProperty(object, key, descriptor);
    },
    getOwnPropertyDescriptor(object, key) {
      note('getOwnPropertyDescriptor', key);
      return Reflect.getOwnPropertyDescriptor(object, key);
    },
    ownKeys(object) {
      note('ownKeys');
      return Reflect.ownKeys(object);
    },
    getPrototypeOf(object) {
      note('getPrototypeOf');
      return Reflect.getPrototypeOf(object) as object | null;
    },
    preventExtensions(object) {
      note('preventExtensions');
      return Reflect.preventExtensions(object);
    },
  });
  return { value, traps };
}

/** A structural snapshot of a value, used to prove probing changed nothing. */
export function snapshot(value: object): string {
  const describe = (key: PropertyKey): unknown => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      return null;
    }
    return {
      key: String(key),
      enumerable: descriptor.enumerable,
      writable: descriptor.writable,
      configurable: descriptor.configurable,
      accessor: typeof descriptor.get === 'function' || typeof descriptor.set === 'function',
      value: typeof descriptor.value === 'object' ? '[object]' : String(descriptor.value),
    };
  };
  return JSON.stringify({
    keys: Object.keys(value),
    symbols: Object.getOwnPropertySymbols(value).map(String),
    descriptors: [...Object.getOwnPropertyNames(value), ...Object.getOwnPropertySymbols(value)].map(
      describe,
    ),
    frozen: Object.isFrozen(value),
    sealed: Object.isSealed(value),
    extensible: Object.isExtensible(value),
    json: JSON.stringify(value),
  });
}

/**
 * Values a probe may be handed by a router that catches whatever the runtime
 * threw. Every one of them must answer "no marker" instead of throwing.
 */
export function hostileValues(): unknown[] {
  const throwingGetter = {};
  Object.defineProperty(throwingGetter, COMPREHENDO_MARKER, {
    get() {
      throw new Error('hostile getter');
    },
    configurable: false,
  });

  const throwingProxy = new Proxy(
    {},
    {
      get() {
        throw new Error('hostile proxy');
      },
    },
  );

  const revocable = Proxy.revocable({}, {});
  revocable.revoke();

  const nullPrototype: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  nullPrototype['shape'] = 'null-prototype';

  return [
    null,
    undefined,
    0,
    Number.NaN,
    '',
    'comprehendo',
    true,
    10n,
    Symbol('not-a-marker'),
    {},
    [],
    () => undefined,
    class Handle {},
    new Error('plain error'),
    new Date(0),
    new Map(),
    Object.freeze({}),
    nullPrototype,
    throwingGetter,
    throwingProxy,
    revocable.proxy,
  ];
}
