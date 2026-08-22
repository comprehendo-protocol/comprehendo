/**
 * CC1 (07-cc1-probe-purity), enforced against 11-marker-probe, the only
 * component implementing the probe surface.
 *
 * Two enforcement halves, both here: the static scan (core imports none of
 * fs/net/http/dns/child_process, transitively included) and the runtime
 * 10,000-iteration test (identical results, zero observable side effects,
 * allocates only the entry).
 */
import { describe, expect, it } from 'vitest';

import { COMPREHENDO_MARKER, attachMarker, hasMarker, probe } from '../src/marker.js';
import { hostileValues, makeSampleEntry, snapshot, watch } from './helpers/marker-fixtures.js';
import {
  FORBIDDEN_MODULES,
  findForbiddenImports,
  readCoreSources,
  transitiveImportClosure,
} from './helpers/source-scan.js';

const ITERATIONS = 10_000;
const MARKER_GET = `get:${String(COMPREHENDO_MARKER)}`;

describe('CC1: the probe does no I/O', () => {
  it('finds source files to scan at all (a scan over nothing proves nothing)', () => {
    const sources = readCoreSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.map((source) => source.path)).toContain('marker.ts');
  });

  // CC1's scan is scoped to marker.ts and whatever IT imports, transitively,
  // per the doc's own Architecture section, not indiscriminately every file
  // the core package happens to contain. A file unrelated to the probe path
  // (docs.ts loading a packed corpus with node:fs, for instance) is
  // explicitly out of this scan's scope; the doc says so out loud.
  it.each([...FORBIDDEN_MODULES])(
    "imports %s nowhere in the marker module's transitive closure",
    (moduleName) => {
      const closure = transitiveImportClosure('marker.ts');
      const offenders = closure
        .filter((source) => findForbiddenImports(source.text).includes(moduleName))
        .map((source) => source.path);

      expect(offenders).toEqual([]);
    },
  );

  it('leaves the marker module importing nothing, so there is no transitive path to hide I/O in', () => {
    const marker = readCoreSources().find((source) => source.path === 'marker.ts');

    const imports = [...(marker?.code ?? '').matchAll(/from\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1] ?? '',
    );

    expect(imports).toEqual([]);
  });

  it("the marker's transitive closure is exactly itself, today", () => {
    // Documents the current, trivial closure (marker.ts imports nothing) so
    // the day marker.ts DOES import something, this test names the new
    // member instead of the forbidden-import test silently widening scope.
    const closure = transitiveImportClosure('marker.ts');

    expect(closure.map((source) => source.path)).toEqual(['marker.ts']);
  });
});

describe(`CC1: ${ITERATIONS.toLocaleString('en-US')} probes are identical and side-effect free`, () => {
  it('returns the reference-identical entry every single time', () => {
    const entry = makeSampleEntry();
    const handle = attachMarker({ id: 'handle-1' }, entry);

    const distinct = new Set<unknown>();
    for (let i = 0; i < ITERATIONS; i += 1) {
      distinct.add(probe(handle));
    }

    expect(distinct.size).toBe(1);
    expect([...distinct][0]).toBe(entry);
  });

  it('leaves the probed value structurally untouched', () => {
    const handle = attachMarker({ id: 'handle-1', depth: { nested: true } }, makeSampleEntry());
    const before = snapshot(handle);

    for (let i = 0; i < ITERATIONS; i += 1) {
      probe(handle);
    }

    expect(snapshot(handle)).toBe(before);
  });

  it('touches the probed value exactly once per probe, and only by reading the marker', () => {
    const watched = watch(attachMarker({ id: 'handle-1' }, makeSampleEntry()));

    for (let i = 0; i < ITERATIONS; i += 1) {
      probe(watched.value);
    }

    expect(watched.traps.length).toBe(ITERATIONS);
    expect(new Set(watched.traps)).toEqual(new Set([MARKER_GET]));
  });

  it('touches an unmarked value exactly the same way, and never marks it in passing', () => {
    const watched = watch({ id: 'not-a-provider' });

    for (let i = 0; i < ITERATIONS; i += 1) {
      expect(probe(watched.value)).toBeUndefined();
    }

    expect(watched.traps.length).toBe(ITERATIONS);
    expect(new Set(watched.traps)).toEqual(new Set([MARKER_GET]));
    expect(Object.getOwnPropertySymbols(watched.value)).toEqual([]);
  });

  it('accumulates no state across distinct values, so no probe can poison a later one', () => {
    const entry = makeSampleEntry();
    const marked = attachMarker({ id: 'marked' }, entry);

    for (let i = 0; i < ITERATIONS; i += 1) {
      expect(probe({ id: `fresh-${String(i)}` })).toBeUndefined();
    }

    expect(probe(marked)).toBe(entry);
    expect(probe({ id: 'still-unmarked' })).toBeUndefined();
  });

  it('answers hasMarker identically every time, for a hit and for a miss', () => {
    const marked = attachMarker({}, makeSampleEntry());
    const plain = {};

    const hits = new Set<boolean>();
    const misses = new Set<boolean>();
    for (let i = 0; i < ITERATIONS; i += 1) {
      hits.add(hasMarker(marked));
      misses.add(hasMarker(plain));
    }

    expect([...hits]).toEqual([true]);
    expect([...misses]).toEqual([false]);
  });

  it('never throws over the whole hostile table, repeated to the same iteration count', () => {
    const values = hostileValues();

    expect(() => {
      for (let i = 0; i < ITERATIONS; i += 1) {
        probe(values[i % values.length]);
      }
    }).not.toThrow();
  });

  it('costs nothing until asked: a value is never probed by attaching it', () => {
    const watched = watch({ id: 'handle-1' });

    attachMarker(watched.value, makeSampleEntry());

    expect(watched.traps.filter((trap) => trap.startsWith('get:'))).toEqual([MARKER_GET]);
  });
});
