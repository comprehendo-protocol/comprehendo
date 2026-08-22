// Wrap Opt-In Proxy [24], the transparency half and the fence.
//
// The doc's must-not is two claims, and this file is both of them: every
// non-error-path call through the proxy behaves identically to the same call
// on the unwrapped target, and nothing global is ever mutated (importing the
// module changes nothing, wrapping one target changes nothing about any other
// instance, the class, or any built-in).
//
// This file compares METHOD REFERENCES on purpose (`proxy.bump` against
// itself, `ToyClient.prototype.fail` and `Promise.prototype.then` before and
// after), which is precisely what `unbound-method` exists to flag. Nothing
// here calls an unbound method; the identity IS the assertion.
/* eslint-disable @typescript-eslint/unbound-method */

import { types } from 'node:util';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createRouter } from '../src/router.js';
import type { Router } from '../src/router.js';
import { readCoreSources } from './helpers/source-scan.js';
import { TOY_RAW, toyEnvironment } from './helpers/sidecar.js';
import { LazyQuery, ToyClient, scriptedRun } from './helpers/wrap-target.js';
import { wrap } from '../src/wrap.js';

let router: Router;

beforeAll(async () => {
  router = createRouter(await toyEnvironment());
});

const client = (): ToyClient => new ToyClient('toy', TOY_RAW);

describe('the proxy forwards reads unchanged', () => {
  it('returns the same values as the unwrapped target, nested handles included', () => {
    const target = client();
    const wrapped = wrap(target, router);

    expect(wrapped.label).toBe(target.label);
    expect(wrapped.child).toBe(target.child);
    expect(wrapped.calls).toBe(target.calls);
    expect(Object.keys(wrapped)).toEqual(Object.keys(target));
    expect(JSON.stringify(wrapped)).toBe(JSON.stringify(target));
  });

  it('keeps the prototype chain, so instanceof and the constructor still answer', () => {
    const target = client();
    const wrapped = wrap(target, router);

    expect(wrapped).toBeInstanceOf(ToyClient);
    expect(Object.getPrototypeOf(wrapped)).toBe(ToyClient.prototype);
    expect(wrapped.constructor).toBe(ToyClient);
    expect(types.isProxy(wrapped)).toBe(true);
  });

  it('hands back a stable, correctly named function for a method', () => {
    const wrapped = wrap(client(), router);

    expect(typeof wrapped.bump).toBe('function');
    expect(wrapped.bump).toBe(wrapped.bump);
    expect(wrapped.bump.name).toBe('bump');
    expect(wrapped.bump.length).toBe(ToyClient.prototype.bump.length);
  });

  it('writes through to the target, it is one object and not a copy', () => {
    const target = client();
    const wrapped = wrap(target, router);

    wrapped.label = 'renamed';
    wrapped.bump(2);

    expect(target.label).toBe('renamed');
    expect(target.calls).toBe(2);
    expect(wrapped.calls).toBe(2);
  });
});

describe('the proxy forwards calls unchanged', () => {
  it('binds `this` to the real target, so private fields still resolve', () => {
    const target = client();
    const wrapped = wrap(target, router);

    expect(wrapped.bump()).toBe(1);
    expect(wrapped.describe()).toBe('toy/1');
    expect(target.calls).toBe(1);
  });

  it('runs a whole scripted session identically wrapped and unwrapped', async () => {
    const bare = await scriptedRun(client());
    const proxied = await scriptedRun(wrap(client(), router));

    expect(proxied).toEqual(bare);
  });

  it('resolves an async method to the identical value, through a real promise', async () => {
    const target = client();
    const wrapped = wrap(target, router);

    const pending = wrapped.load('key');

    expect(pending).toBeInstanceOf(Promise);
    expect(await pending).toBe('toy:key');
    expect(await wrapped.load('key')).toBe(await target.load('key'));
  });

  it('returns a lazy thenable untouched, and never executes it', () => {
    const target = client();
    const wrapped = wrap(target, router);

    const query = wrapped.query();

    expect(query).toBe(target.lastQuery);
    expect(query).toBeInstanceOf(LazyQuery);
    expect(query.executed).toBe(0);
  });
});

describe('nothing global is mutated', () => {
  const subjects = (): readonly object[] => [
    Object,
    Object.prototype,
    Function.prototype,
    Array.prototype,
    Promise,
    Promise.prototype,
    Error,
    Error.prototype,
    Reflect,
    JSON,
    globalThis,
  ];

  const snapshot = (): string =>
    JSON.stringify([
      subjects().map((subject) => [
        Object.getOwnPropertyNames(subject),
        Object.getOwnPropertySymbols(subject).map(String),
      ]),
      [Promise.prototype.then.name, Object.prototype.hasOwnProperty.name],
    ]);

  it('importing the module, wrapping, and throwing through it leaves globals identical', async () => {
    const before = snapshot();
    const then = Promise.prototype.then;
    const apply = Reflect.apply;

    vi.resetModules();
    const fresh = await import('../src/wrap.js');
    const wrapped = fresh.wrap(client(), router);
    wrapped.bump();
    expect(() => wrapped.fail()).toThrow();

    expect(snapshot()).toBe(before);
    expect(Promise.prototype.then).toBe(then);
    expect(Reflect.apply).toBe(apply);
  });

  it('leaves every other instance, and the class itself, completely unmodified', () => {
    const sibling = client();
    const descriptor = Object.getOwnPropertyDescriptor(ToyClient.prototype, 'fail');
    const method = ToyClient.prototype.fail;

    const wrapped = wrap(client(), router);
    expect(() => wrapped.fail()).toThrow();

    let raw: unknown;
    try {
      sibling.fail();
    } catch (error) {
      raw = error;
    }
    expect(raw).toBeInstanceOf(Error);
    expect((raw as { twin?: unknown }).twin).toBeUndefined();
    expect(ToyClient.prototype.fail).toBe(method);
    expect(Object.getOwnPropertyDescriptor(ToyClient.prototype, 'fail')).toEqual(descriptor);
  });

  it('leaves the wrapped target itself unmodified by the act of wrapping', () => {
    const target = client();
    const names = Object.getOwnPropertyNames(target);
    const proto = Object.getPrototypeOf(target) as object;

    wrap(target, router);

    expect(Object.getOwnPropertyNames(target)).toEqual(names);
    expect(Object.getPrototypeOf(target)).toBe(proto);
    expect(types.isProxy(target)).toBe(false);
  });

  it('assigns to no prototype and no global, structurally', () => {
    const source = readCoreSources().find((file) => file.path === 'wrap.ts');
    const forbidden = [/\.prototype\s*\[?[\w$]*\]?\s*=[^=]/, /\bglobalThis\b/, /\bglobal\b\s*\./];

    expect(source).toBeDefined();
    expect(forbidden.filter((pattern) => pattern.test(source?.code ?? '')).map(String)).toEqual([]);
    expect(types.isProxy(wrap(client(), router))).toBe(true);
  });
});
