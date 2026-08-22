/**
 * CC8 (19-cc8-native-precedence), the half that is provable against Manifest
 * Wiring [15]: no provider-side mechanism can suppress a registry corpus,
 * because the provider-side manifest has no field that could express one.
 *
 * CC8's runtime enforcement (native beats sidecar, `prefer` reverses it) is
 * Wave 4's Router & Precedence [22]. What is settled HERE is structural, and
 * it is settled the way CC1 and CC9's scans in 11-marker-probe are: read the
 * schema and the source, assert the absence, and prove the scan ran over
 * something real.
 *
 * The scan reads `packages/spec/kit/shapes/*.schema.json` rather than a
 * hand-copied field list on purpose: a scan against a copy of the schema
 * passes cleanly on exactly the day the schema grows the field.
 */
import { describe, expect, it } from 'vitest';

import {
  MANIFEST_FIELDS,
  MANIFEST_KEY,
  PYPROJECT_TABLE,
  declarationFor,
  parseDeclaration,
  readPackageJson,
  readPyproject,
  resolveDiscovery,
  stampPackageJson,
  stampPyproject,
} from '../src/config.js';
import { makeSampleEntry } from './helpers/marker-fixtures.js';
import { at, findMarkerCalls, readCoreSources, readKitJson } from './helpers/source-scan.js';

/**
 * Any name that could express "do not use a corpus for this package". Wider
 * than the RFC's own vocabulary on purpose: the contract is that NOTHING
 * shaped like a veto exists, not that one particular spelling is absent.
 */
const SUPPRESSION = /suppress|veto|disable|deny|block|exclude|opt[-_]?out|ignore|override|off/i;

const schemaProperties = (file: string): string[] => {
  const properties = at(readKitJson('shapes', file), 'properties');
  return Object.keys((properties ?? {}) as Record<string, unknown>);
};

const declarationKeys = (value: unknown): string[] => {
  const reading = parseDeclaration(value);
  return reading.status === 'declared' ? Object.keys(reading.declaration) : [];
};

/** A manifest key stuffed with every suppression-shaped field a provider might invent. */
const HOSTILE = {
  version: '0.1',
  level: 1,
  disable: ['@comprehendo/ffmpeg'],
  suppress: true,
  veto_registry: ['@comprehendo/toy'],
  prefer: { toy: 'native' },
  no_corpus: true,
};

describe('CC8: the provider-side manifest schema has no suppression field', () => {
  it('scans a real schema with real properties (a scan over nothing proves nothing)', () => {
    expect(schemaProperties('manifest.schema.json').length).toBeGreaterThan(0);
    expect(schemaProperties('config.schema.json').length).toBeGreaterThan(0);
  });

  it('declares exactly the two fields this component writes, and no third', () => {
    expect(schemaProperties('manifest.schema.json').sort()).toEqual([...MANIFEST_FIELDS].sort());
    expect(at(readKitJson('shapes', 'manifest.schema.json'), 'required')).toEqual([
      ...MANIFEST_FIELDS,
    ]);
  });

  it('carries no field whose name could express a veto', () => {
    const suspicious = schemaProperties('manifest.schema.json').filter((name) =>
      SUPPRESSION.test(name),
    );

    expect(suspicious).toEqual([]);
  });

  it('shares no field name with the consumer-side knobs, which are the only override', () => {
    // The five knobs live under the same manifest key, but they are the
    // CONSUMER's. A provider-side declaration that could carry one of them
    // would be a provider veto by another name.
    const knobs = schemaProperties('config.schema.json');
    const overlap = knobs.filter((knob) => (MANIFEST_FIELDS as readonly string[]).includes(knob));

    expect(knobs).toContain('disable');
    expect(overlap).toEqual([]);
  });
});

describe('CC8: nothing suppression-shaped survives the provider-side read', () => {
  it('projects a hostile manifest key down to the two declared fields', () => {
    expect(declarationKeys(HOSTILE)).toEqual([...MANIFEST_FIELDS]);
  });

  it('projects it the same way through package.json', () => {
    const text = `${JSON.stringify({ name: 'hostile', [MANIFEST_KEY]: HOSTILE }, null, 2)}\n`;
    const reading = readPackageJson(text);

    expect(reading.status).toBe('declared');
    expect(Object.keys(reading.status === 'declared' ? reading.declaration : {})).toEqual([
      ...MANIFEST_FIELDS,
    ]);
  });

  it('projects it the same way through pyproject.toml', () => {
    const text = [
      `[${PYPROJECT_TABLE}]`,
      'version = "0.1"',
      'level = 1',
      'disable = ["@comprehendo/ffmpeg"]',
      'suppress = true',
      '',
    ].join('\n');
    const reading = readPyproject(text);

    expect(reading.status).toBe('declared');
    expect(Object.keys(reading.status === 'declared' ? reading.declaration : {})).toEqual([
      ...MANIFEST_FIELDS,
    ]);
  });

  it('resolves discovery to a view with no suppression-shaped key on it', () => {
    const resolved = resolveDiscovery({
      marker: makeSampleEntry(),
      manifest: declarationFor(makeSampleEntry()),
    });

    expect(Object.keys(resolved ?? {}).filter((key) => SUPPRESSION.test(key))).toEqual([]);
  });

  it('writes only the two fields, into either manifest format', () => {
    const declaration = declarationFor(makeSampleEntry());
    const written = JSON.parse(stampPackageJson('{}\n', declaration)) as Record<
      string,
      Record<string, unknown>
    >;

    expect(Object.keys(written[MANIFEST_KEY] ?? {})).toEqual([...MANIFEST_FIELDS]);
    expect(
      stampPyproject('', declaration)
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => (line.split('=')[0] ?? '').trim()),
    ).toEqual([...MANIFEST_FIELDS]);
  });
});

describe('CC9 adjacency: the manifest key names are frozen literals too', () => {
  const sources = () => readCoreSources();

  it('assigns the package.json key literal exactly once in the package, in config.ts', () => {
    const sites = sources().flatMap((source) =>
      [...source.code.matchAll(/=\s*(['"])comprehendo\1/g)].map(() => source.path),
    );

    expect(sites).toEqual(['config.ts']);
  });

  it('writes the pyproject table literal exactly once in the package, in config.ts', () => {
    const sites = sources().flatMap((source) =>
      [...source.code.matchAll(/(['"])tool\.comprehendo\1/g)].map(() => source.path),
    );

    expect(sites).toEqual(['config.ts']);
    expect(PYPROJECT_TABLE).toBe('tool.comprehendo');
  });

  it('adds no second Symbol.for definition site while doing it', () => {
    const config = sources().find((source) => source.path === 'config.ts');

    expect(config).toBeDefined();
    expect(findMarkerCalls(config?.code ?? '')).toEqual([]);
  });
});
