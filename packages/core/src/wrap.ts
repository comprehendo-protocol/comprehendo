// Wrap Opt-In Proxy [24]: the one deliberately-scoped exception to "nothing
// global is mutated".
//
// `wrap(target, router)` returns a real `Proxy` over the object a caller
// explicitly handed in. Every property read, every method call, every write
// goes straight through to that target unchanged; the ONLY thing that differs
// is the error path, where a caught throw (or a rejected promise) is routed
// through Router & Precedence [22]'s `comprehend(raw)` before it continues on
// its way, so the call site catches an already-twinned (or honestly
// UNSTRUCTURED) error with no `try/catch` plus `comprehend()` of its own.
//
// The fence, which is the point of this module:
//
// - Importing this file mutates NOTHING. No prototype is touched, no global
//   is written, no module-level state exists at all. Every function here is a
//   value in, a value out.
// - `wrap()` affects exactly ONE object: the one passed to it. Another
//   instance of the same class, the class itself, and every other package are
//   untouched, because the proxy IS the wrapper and the target never learns
//   it was wrapped.
// - The router is a required argument (JUDGMENT-24-wrap-proxy.md, call 1).
//   There is no singleton to reach for: whether a module-level `comprehend`
//   exists at all is Distribution (Wave 7)'s call, and 22 deferred it too.
//
// @see .mdd/docs/24-wrap-proxy.md
// @see .mdd/docs/22-router-precedence.md

import type { Twin } from './twin.js';

/** The plain-function form of the routing surface. */
export type ComprehendFn = (raw: unknown) => Twin;

/**
 * The object form. Router & Precedence [22]'s `Router` satisfies this
 * structurally with no adaptation, and so does anything else that can answer
 * "what is this error", which keeps this module independent of how Wave 7
 * eventually assembles the package's entry points.
 */
export interface ComprehendSurface {
  comprehend(raw: unknown): Twin;
}

/** What `wrap` routes through: a router, or the bare call. */
export type ComprehendSource = ComprehendFn | ComprehendSurface;

/** An error that has been through the router, however it got there. */
interface TwinCarrier {
  readonly twin?: unknown;
}

type AnyFunction = (...args: readonly unknown[]) => unknown;

/** Objects and functions can be proxied; nothing else can. */
const isWrappable = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function';

/**
 * A twin the value is already carrying. Same structural check the router
 * makes on a caught value: a `twin` field that is actually twin-shaped, not
 * whatever happens to occupy the name.
 */
function carriedTwin(raw: unknown): Twin | undefined {
  if (!isWrappable(raw)) return undefined;
  const twin = (raw as TwinCarrier).twin;
  if (typeof twin !== 'object' || twin === null) return undefined;
  const shape = twin as Partial<Twin>;
  const usable =
    typeof shape.comprehendo === 'string' &&
    typeof shape.code === 'string' &&
    typeof shape.reason === 'string' &&
    Array.isArray(shape.fixes);
  return usable ? (twin as Twin) : undefined;
}

/** Normalize the injected router, loudly, at the wrap call rather than at the first failure. */
function comprehendFrom(via: ComprehendSource): ComprehendFn {
  if (typeof via === 'function') return via;
  if (isWrappable(via) && typeof via.comprehend === 'function') {
    return (raw: unknown) => via.comprehend(raw);
  }
  throw new TypeError(
    'comprehendo: wrap(target, router) needs something that can comprehend a caught ' +
      'error: a router from createRouter(), or a comprehend(raw) function. There is no ' +
      'implicit global router, wrapping is opt-in per call site.',
  );
}

/**
 * The twin goes onto the caught error itself, so the caller catches the SAME
 * value it would have caught unwrapped: same stack, same prototype (an
 * `instanceof` check at the call site still answers), same custom fields, now
 * carrying `.twin`.
 *
 * No marker is attached. `Symbol.for('comprehendo')` is a claim that the
 * value came from a package that speaks the protocol natively, and a sidecar
 * twin a consumer routed through their own `wrap()` call is not that claim
 * (CC8 [19]).
 */
function attachSidecarTwin(raw: unknown, twin: Twin): unknown {
  if (isWrappable(raw)) {
    try {
      Object.defineProperty(raw, 'twin', {
        value: twin,
        enumerable: true,
        writable: false,
        configurable: false,
      });
      return raw;
    } catch {
      // Frozen, sealed, or already carrying a non-configurable `twin` of some
      // other shape. Fall through: a twin the caller cannot read is worse
      // than a carrier error that says everything.
    }
  }
  // The message is the twin's reason, never the raw text (CC3 [08]), and the
  // raw value is kept verbatim as `cause` so nothing is paraphrased away.
  const carrier = new Error(twin.reason, { cause: raw });
  Object.defineProperty(carrier, 'twin', {
    value: twin,
    enumerable: true,
    writable: false,
    configurable: false,
  });
  return carrier;
}

/** Native promises only: a lazy thenable must not be executed by being observed. */
const isNativePromise = (value: unknown): value is Promise<unknown> =>
  value instanceof Promise || Object.prototype.toString.call(value) === '[object Promise]';

/**
 * One `wrap()` call's world. It exists per call, never at module scope: two
 * wrapped targets share nothing, and importing this file allocates none of it.
 * `proxy` is filled in the moment the proxy exists, because the traps have to
 * recognise their own proxy to substitute `this` back to the real target.
 */
interface Wrapping<T extends object> {
  readonly target: T;
  readonly comprehend: ComprehendFn;
  readonly wrappers: WeakMap<AnyFunction, AnyFunction>;
  proxy?: object;
}

/**
 * Route one caught value. An error that already carries a usable twin is
 * returned exactly as caught, and the router is not even asked: a natively
 * adopted package's own twin wins (CC8 [19]), and `wrap(wrap(x))` twins once,
 * not twice.
 */
const routed = <T extends object>(state: Wrapping<T>, raw: unknown): unknown =>
  carriedTwin(raw) === undefined ? attachSidecarTwin(raw, state.comprehend(raw)) : raw;

/**
 * A method that returns `this` (the fluent/chainable-API shape: a query
 * builder's `.where()`, an HTTP client's `.header()`) hands back the real
 * target, since `invoke` substituted the receiver to the target before the
 * call ran (see the `this` substitution above). Left alone, that raw target
 * would leak out of the wrapper: the NEXT call in the chain would run
 * unwrapped, and an error it throws would escape completely unrouted rather
 * than come back UNSTRUCTURED. Found by review. Reversing the exact
 * substitution `invoke` already makes for `this` keeps `wrapped.a().b()`
 * routed all the way down the chain.
 */
const reflect = <T extends object>(state: Wrapping<T>, value: unknown): unknown =>
  value === state.target ? state.proxy : value;

/** A rejection is a throw that happened later; it routes identically. */
const settle = <T extends object>(state: Wrapping<T>, result: unknown): unknown =>
  isNativePromise(result)
    ? result.then(
        (value) => reflect(state, value),
        (raw: unknown) => {
          throw routed(state, raw);
        },
      )
    : reflect(state, result);

/** Every call through a wrapped surface funnels here, sync and async alike. */
function invoke<T extends object>(
  state: Wrapping<T>,
  fn: AnyFunction,
  thisArg: unknown,
  args: readonly unknown[],
): unknown {
  try {
    // `this` is substituted back to the real target when the call came off
    // the proxy: a method reading a `#private` field throws with the proxy as
    // receiver. A `.call(other)` at the call site is passed through as written.
    const receiver = thisArg === state.proxy ? state.target : thisArg;
    return settle(state, Reflect.apply(fn, receiver, args));
  } catch (raw) {
    throw routed(state, raw);
  }
}

/**
 * One wrapper per underlying function, so `proxy.method === proxy.method`
 * holds, and a Proxy (not a closure) so `name`, `length` and every other
 * property of the real method survive.
 */
function wrapperFor<T extends object>(state: Wrapping<T>, fn: AnyFunction): AnyFunction {
  const existing = state.wrappers.get(fn);
  if (existing !== undefined) return existing;
  const wrapper = new Proxy(fn, {
    apply: (inner, thisArg, args: readonly unknown[]) => invoke(state, inner, thisArg, args),
  });
  state.wrappers.set(fn, wrapper);
  return wrapper;
}

/** The traps, all three of them. Everything not listed forwards by default. */
function handlerFor<T extends object>(state: Wrapping<T>): ProxyHandler<T> {
  type Constructor = new (...values: readonly unknown[]) => object;
  return {
    get(inner, property) {
      // Read with the target as receiver, for the same private-field reason.
      const value: unknown = Reflect.get(inner, property, inner);
      if (typeof value !== 'function') return value;
      // `constructor` is an identity slot, not a method: `x.constructor ===
      // SomeClass` is a check real code makes (and the language itself makes,
      // resolving a promise's species). A wrapper there would be a visible
      // difference on the NON-error path, which outranks routing a call
      // almost nobody makes through an instance's constructor property.
      if (property === 'constructor') return value;
      const own = Reflect.getOwnPropertyDescriptor(inner, property);
      // The `get` trap invariant: a non-configurable, non-writable own data
      // property must be reported exactly as it is, wrapper or not.
      if (own !== undefined && own.configurable === false && own.writable === false) return value;
      return wrapperFor(state, value as AnyFunction);
    },
    apply: (inner, thisArg, args: readonly unknown[]) =>
      invoke(state, inner as AnyFunction, thisArg, args),
    construct(inner, args, newTarget) {
      const constructor = inner as Constructor;
      try {
        return Reflect.construct(
          constructor,
          args,
          (newTarget === state.proxy ? constructor : newTarget) as Constructor,
        );
      } catch (raw) {
        throw routed(state, raw);
      }
    },
  };
}

/**
 * `wrap(target, router)`: a transparent proxy over `target` whose only
 * difference is that caught errors have already been through `comprehend`.
 *
 * @param target the object, class instance, class, or function to wrap. Only
 * this object is affected, and only because it was passed here.
 * @param via a Router (or a bare `comprehend(raw)` function) to route through.
 * @returns a proxy with the same surface as `target`. Never a copy.
 */
export function wrap<T extends object>(target: T, via: ComprehendSource): T {
  if (!isWrappable(target)) {
    throw new TypeError(
      `comprehendo: wrap() needs an object, class or function to wrap, got ${typeof target}. ` +
        'A primitive has no calls to route.',
    );
  }
  const state: Wrapping<T> = {
    target,
    comprehend: comprehendFrom(via),
    wrappers: new WeakMap<AnyFunction, AnyFunction>(),
  };
  const proxy: T = new Proxy(target, handlerFor(state));
  state.proxy = proxy;
  return proxy;
}
