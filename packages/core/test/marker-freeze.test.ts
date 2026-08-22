/**
 * CC9 (10-cc9-marker-freeze), enforced against 11-marker-probe.
 *
 * `Symbol.for('comprehendo')` is a frozen literal with exactly one definition
 * site in this package; every other module imports it. The negative kit's
 * computed-marker fixture is this contract's must-fail proof, and it is driven
 * here against the same scan the definition site passes: at run time the two
 * forms are indistinguishable, which is precisely why the gate is a scan.
 */
import { describe, expect, it } from 'vitest';

import * as markerModule from '../src/marker.js';
import { COMPREHENDO_MARKER } from '../src/marker.js';
import { findMarkerCalls, readCoreSources, readKitJson, stringAt } from './helpers/source-scan.js';

interface DefinitionSite {
  readonly path: string;
  readonly raw: string;
  readonly argument: string;
  readonly frozenLiteral: boolean;
  readonly computed: boolean;
}

function definitionSites(): DefinitionSite[] {
  return readCoreSources().flatMap((source) =>
    findMarkerCalls(source.code).map((call) => ({ path: source.path, ...call })),
  );
}

describe('CC9: one definition site', () => {
  it('has exactly one Symbol.for call in the whole core package', () => {
    expect(definitionSites().map((site) => `${site.path}: ${site.raw}`)).toHaveLength(1);
  });

  it('puts that one call in src/marker.ts, where the doc says it lives', () => {
    expect(definitionSites()[0]?.path).toBe('marker.ts');
  });

  it('writes it as a frozen literal, never assembled at run time', () => {
    const site = definitionSites()[0];

    expect(site?.frozenLiteral).toBe(true);
    expect(site?.computed).toBe(false);
    expect(site?.argument).toBe("'comprehendo'");
  });

  it('binds it with const, so the one definition site cannot be reassigned', () => {
    const marker = readCoreSources().find((source) => source.path === 'marker.ts');

    const definitionLine = (marker?.code ?? '')
      .split('\n')
      .find((line) => line.includes('Symbol.for('));

    expect(definitionLine).toMatch(/\bconst\b/);
  });

  it('exports exactly one symbol, so the marker carries no second name', () => {
    const exportedSymbols = Object.values(markerModule).filter(
      (exported) => typeof exported === 'symbol',
    );

    expect(exportedSymbols).toEqual([COMPREHENDO_MARKER]);
    expect(Symbol.keyFor(exportedSymbols[0] as symbol)).toBe('comprehendo');
  });

  it('scans real source, not an empty set (a scan that finds nothing proves nothing)', () => {
    const sources = readCoreSources();

    expect(sources.length).toBeGreaterThan(0);
    expect(sources.find((source) => source.path === 'marker.ts')?.text.length ?? 0).toBeGreaterThan(
      0,
    );
  });
});

describe('CC9: the negative kit is the must-fail proof', () => {
  const fixture = readKitJson('negative', 'computed-marker.json');
  const frozenForm = stringAt(fixture, 'marker', 'frozen', 'javascript');
  const computedForm = stringAt(fixture, 'marker', 'computed', 'javascript');

  it('names this component as the violation it exists to catch', () => {
    expect(stringAt(fixture, 'violation', 'rule')).toBe('CC9');
    expect(stringAt(fixture, 'violation', 'contract')).toBe('10-cc9-marker-freeze');
    expect(stringAt(fixture, 'violation', 'reason')).toBe('computed-marker');
  });

  it("rejects the fixture's computed form", () => {
    const calls = findMarkerCalls(computedForm);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.frozenLiteral).toBe(false);
    expect(calls[0]?.computed).toBe(true);
  });

  it("accepts the fixture's frozen form", () => {
    const calls = findMarkerCalls(frozenForm);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.frozenLiteral).toBe(true);
    expect(calls[0]?.computed).toBe(false);
  });

  it('finds this package writing the marker exactly as the kit writes it', () => {
    expect(definitionSites()[0]?.raw).toBe(frozenForm);
  });

  it('cannot be caught at run time, which is why the gate is a source scan', () => {
    // The registry makes an assembled key and a literal key the same symbol.
    // Demonstrated on a neutral key on purpose: computing the real marker here
    // would put a second, aliased definition site in the repository.
    const neutral = 'not-the-comprehendo-marker';

    expect(Symbol.for(neutral)).toBe(Symbol.for(['not-the', '-comprehendo-marker'].join('')));
  });
});

describe('CC9: what the frozen marker guarantees at run time', () => {
  it('resolves to the same symbol as any other holder of the key', () => {
    expect(COMPREHENDO_MARKER).toBe(Symbol.for('comprehendo'));
    expect(Symbol.keyFor(COMPREHENDO_MARKER)).toBe('comprehendo');
  });

  it('is the same symbol on every import of this module', async () => {
    const reimported = (await import('../src/marker.js')) as typeof markerModule;

    expect(reimported.COMPREHENDO_MARKER).toBe(COMPREHENDO_MARKER);
    expect(reimported.COMPREHENDO_MARKER).toBe(Symbol.for('comprehendo'));
  });
});
