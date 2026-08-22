/**
 * 11-marker-probe: the marker symbol and the attach/probe helpers around it.
 * Behavioral tests. The two contract suites live next door:
 * marker-purity.test.ts (CC1) and marker-freeze.test.ts (CC9).
 */
import { describe, expect, it } from 'vitest';

import {
  COMPREHENDO_MARKER,
  attachMarker,
  hasMarker,
  probe,
  type ComprehendoEntry,
} from '../src/marker.js';
import { hostileValues, kitProbeHitEntry, makeSampleEntry } from './helpers/marker-fixtures.js';

describe('COMPREHENDO_MARKER', () => {
  it('is the global-registry symbol an outside consumer reaches with Symbol.for', () => {
    expect(COMPREHENDO_MARKER).toBe(Symbol.for('comprehendo'));
  });

  it('is registered under exactly the key "comprehendo"', () => {
    expect(Symbol.keyFor(COMPREHENDO_MARKER)).toBe('comprehendo');
  });

  it('is a registered symbol keyed on the marker word, never a module-local one', () => {
    expect(typeof COMPREHENDO_MARKER).toBe('symbol');
    expect(COMPREHENDO_MARKER.description).toBe('comprehendo');
    expect(Symbol.keyFor(COMPREHENDO_MARKER)).toBeDefined();
  });
});

describe('attachMarker', () => {
  it("marks a provider's root export so a probe returns the entry", () => {
    const rootExport = { connect: () => undefined };
    const entry = makeSampleEntry();

    const marked = attachMarker(rootExport, entry);

    expect(probe(marked)).toBe(entry);
    expect(marked[COMPREHENDO_MARKER]).toBe(entry);
  });

  it('marks a raised error, so the catcher discovers the protocol mid-failure', () => {
    const entry = makeSampleEntry();

    let caught: unknown;
    try {
      throw attachMarker(new Error('STAGE_UNKNOWN'), entry);
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(probe(caught)).toBe(entry);
  });

  it('marks a controlled handle (a client, a cursor)', () => {
    class Cursor {
      next(): number {
        return 1;
      }
    }
    const entry = makeSampleEntry();

    const cursor = attachMarker(new Cursor(), entry);

    expect(probe(cursor)).toBe(entry);
    expect(cursor.next()).toBe(1);
  });

  it('returns the very object it was given, never a copy', () => {
    const handle = { id: 'handle-1' };

    expect(attachMarker(handle, makeSampleEntry())).toBe(handle);
  });

  it('freezes the entry and its surfaces list, so the claim cannot be edited later', () => {
    const entry = makeSampleEntry();

    attachMarker({}, entry);

    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.surfaces)).toBe(true);
  });

  it('attaches a data property, never a getter, so presence is never lazily computed', () => {
    const target = attachMarker({}, makeSampleEntry());

    const descriptor = Object.getOwnPropertyDescriptor(target, COMPREHENDO_MARKER);

    expect(descriptor).toBeDefined();
    expect(typeof descriptor?.get).toBe('undefined');
    expect(typeof descriptor?.set).toBe('undefined');
    expect(descriptor?.value).toBeDefined();
  });

  it('attaches non-enumerable, non-writable and non-configurable', () => {
    const target = attachMarker({}, makeSampleEntry());

    const descriptor = Object.getOwnPropertyDescriptor(target, COMPREHENDO_MARKER);

    expect(descriptor?.enumerable).toBe(false);
    expect(descriptor?.writable).toBe(false);
    expect(descriptor?.configurable).toBe(false);
  });

  it('re-attaching the same entry is a no-op, not a redefinition', () => {
    const entry = makeSampleEntry();
    const target = attachMarker({}, entry);

    expect(() => attachMarker(target, entry)).not.toThrow();
    expect(probe(target)).toBe(entry);
  });

  it('refuses to overwrite an existing marker with a different entry', () => {
    const target = attachMarker({}, makeSampleEntry());

    expect(() => attachMarker(target, makeSampleEntry())).toThrow(TypeError);
  });

  it('refuses a malformed entry, rather than attaching something probe() can never see', () => {
    // A structurally-typed ComprehendoEntry does not stop a caller from
    // passing parsed JSON or a cast that lies about its shape at runtime.
    // Without a write-time check, this would "succeed" and then be
    // invisible to probe()/hasMarker() forever, an attach that appears to
    // work but silently does nothing observable.
    const malformed = {
      comprehendo: '0.1',
      name: 'mongodb-operator',
      level: 2,
      surfaces: ['docs'],
      identity: 'x',
      // priming missing entirely
    } as unknown as ComprehendoEntry;

    expect(() => attachMarker({}, malformed)).toThrow(TypeError);
  });

  it('a rejected attach never installs a property at all', () => {
    const malformed = { comprehendo: '0.1' } as unknown as ComprehendoEntry;
    const target = {};

    expect(() => attachMarker(target, malformed)).toThrow(TypeError);
    expect(hasMarker(target)).toBe(false);
    expect(Object.getOwnPropertyDescriptor(target, COMPREHENDO_MARKER)).toBeUndefined();
  });

  it('leaves the value serializing exactly as it did before', () => {
    const before = JSON.stringify({ region: 'eu', size: 3 });
    const marked = attachMarker({ region: 'eu', size: 3 }, makeSampleEntry());

    expect(JSON.stringify(marked)).toBe(before);
    expect(Object.keys(marked)).toEqual(['region', 'size']);
  });
});

describe('probe', () => {
  it('returns the exact entry object that was attached, not a copy of it', () => {
    const entry = makeSampleEntry();
    const marked = attachMarker({}, entry);

    expect(probe(marked)).toBe(entry);
    expect(probe(marked)).toBe(probe(marked));
  });

  it('returns undefined for an unmarked object', () => {
    expect(probe({ looks: 'ordinary' })).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'comprehendo'],
    ['a boolean', false],
    ['a symbol', Symbol('other')],
  ])('returns undefined for %s', (_label, value) => {
    expect(probe(value)).toBeUndefined();
  });

  it('returns undefined when the marker carries something that is not an entry', () => {
    const impostor = {};
    Object.defineProperty(impostor, COMPREHENDO_MARKER, { value: true });

    expect(probe(impostor)).toBeUndefined();
    expect(hasMarker(impostor)).toBe(false);
  });

  it('never throws, whatever it is handed', () => {
    for (const value of hostileValues()) {
      expect(() => probe(value)).not.toThrow();
      expect(probe(value)).toBeUndefined();
    }
  });

  it('reads through the plain property access an outside agent would use', () => {
    const entry = makeSampleEntry();
    const marked: object = attachMarker({}, entry);

    const readByHand = (marked as Record<symbol, unknown>)[Symbol.for('comprehendo')];

    expect(readByHand).toBe(probe(marked));
  });
});

describe('hasMarker', () => {
  it('is true for a marked value and false for an unmarked one', () => {
    expect(hasMarker(attachMarker({}, makeSampleEntry()))).toBe(true);
    expect(hasMarker({})).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 0],
  ])('is false, not throwing, for %s', (_label, value) => {
    expect(hasMarker(value)).toBe(false);
  });

  it('returns a real boolean, never the entry itself', () => {
    expect(typeof hasMarker(attachMarker({}, makeSampleEntry()))).toBe('boolean');
  });
});

describe('the entry the probe hands back', () => {
  it('carries the six data fields the kit fixture carries, with the same types', () => {
    const sample: ComprehendoEntry = makeSampleEntry();
    const fromKit = kitProbeHitEntry() as Record<string, unknown>;

    expect(Object.keys(sample).sort()).toEqual(Object.keys(fromKit).sort());
    expect(typeof sample.comprehendo).toBe(typeof fromKit['comprehendo']);
    expect(typeof sample.name).toBe(typeof fromKit['name']);
    expect(typeof sample.level).toBe(typeof fromKit['level']);
    expect(Array.isArray(sample.surfaces)).toBe(Array.isArray(fromKit['surfaces']));
    expect(typeof sample.identity).toBe(typeof fromKit['identity']);
    expect(typeof sample.priming).toBe(typeof fromKit['priming']);
  });
});
