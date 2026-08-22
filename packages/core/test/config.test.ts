/**
 * Manifest Wiring [15]: the provider-side static-discovery channel.
 *
 * Two halves, both here. The manifest READ/WRITE half (the `comprehendo` key
 * in package.json, `[tool.comprehendo]` in pyproject.toml, as text and as real
 * files on disk), and the RESOLUTION half, driven by the conformance kit's own
 * disagreement fixture (Conformance Fixtures [04]): when the manifest and the
 * runtime marker disagree, the marker is authoritative, always.
 *
 * The CC8-relevant scan (no field in this schema could suppress a registry
 * corpus) lives next door in config-cc8.test.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MANIFEST_FIELDS,
  MANIFEST_KEY,
  ManifestError,
  PYPROJECT_TABLE,
  declarationFor,
  parseDeclaration,
  readManifestFile,
  readPackageJson,
  readPyproject,
  resolveDiscovery,
  stampManifestFile,
  stampPackageJson,
  stampPyproject,
  type ManifestDeclaration,
  type ManifestReading,
} from '../src/config.js';
import { emptyCorpus } from '../src/cli/index.js';
import type { ComprehendoEntry } from '../src/marker.js';
import { makeProvider } from '../src/sdk.js';
import { makeSampleEntry } from './helpers/marker-fixtures.js';
import { at, readKitJson } from './helpers/source-scan.js';
import { cleanupWorkspaces, makeWorkspace } from './helpers/toy-corpus.js';
import { toyCorpus, toyHooks } from './helpers/toy-provider.js';

afterEach(cleanupWorkspaces);

const DECLARATION: ManifestDeclaration = { version: '0.1', level: 1 };

/** The declaration a reading must have found, failing loudly when it found none. */
const declared = (reading: ManifestReading): ManifestDeclaration => {
  if (reading.status !== 'declared') {
    throw new Error(
      `expected a declared manifest, got ${reading.status}` +
        (reading.status === 'unreadable' ? `: ${reading.reason}` : ''),
    );
  }
  return reading.declaration;
};

/** The reason an unreadable reading gave, failing loudly when it was readable. */
const unreadable = (reading: ManifestReading): string => {
  if (reading.status !== 'unreadable') {
    throw new Error(`expected an unreadable manifest, got ${reading.status}`);
  }
  return reading.reason;
};

const packageJson = (extra: Record<string, unknown> = {}): string =>
  `${JSON.stringify({ name: 'toy-encoder', version: '1.0.0', ...extra }, null, 2)}\n`;

const PYPROJECT = [
  '[project]',
  'name = "comprehendo"',
  'version = "0.0.1"',
  '',
  '[build-system]',
  'requires = ["hatchling"]',
  '',
].join('\n');

/** The kit's disagreement fixture (04), the same file the spec suite drives. */
const disagreement = (): unknown => readKitJson('fixtures', 'disagreement.json');

const fixtureStep = (surface: string): unknown => {
  const steps = at(disagreement(), 'steps');
  const found = (Array.isArray(steps) ? steps : []).find(
    (step) => at(step, 'surface') === surface,
  ) as unknown;
  if (found === undefined) throw new Error(`the disagreement fixture has no ${surface} step`);
  return at(found, 'response');
};

const fixtureMarker = (): ComprehendoEntry => fixtureStep('probe') as ComprehendoEntry;

describe('the declaration a provider stamps', () => {
  it('is exactly the two fields the manifest schema names, read off the entry', () => {
    const entry = makeSampleEntry();

    const declaration = declarationFor(entry);

    expect(declaration).toEqual({ version: entry.comprehendo, level: entry.level });
    expect(Object.keys(declaration).sort()).toEqual([...MANIFEST_FIELDS].sort());
  });

  it('is the same declaration makeProvider already computed, so the two cannot drift', () => {
    const provider = makeProvider(toyCorpus(), toyHooks());

    expect(declarationFor(provider.entry)).toEqual(provider.manifest);
  });

  it('carries the level the runtime actually reached, never an aspirational one', () => {
    const entry: ComprehendoEntry = { ...makeSampleEntry(), level: 1, surfaces: ['docs'] };

    expect(declarationFor(entry).level).toBe(1);
  });

  it('satisfies every key manifest.schema.json requires', () => {
    const required = at(readKitJson('shapes', 'manifest.schema.json'), 'required');
    const declaration = declarationFor(makeSampleEntry()) as unknown as Record<string, unknown>;

    expect(Array.isArray(required)).toBe(true);
    for (const key of required as string[]) {
      expect(declaration[key]).toBeDefined();
    }
    expect(typeof declaration['version']).toBe('string');
    expect(Number.isInteger(declaration['level'])).toBe(true);
  });

  it('freezes what it hands back, so a stamped claim cannot be edited afterwards', () => {
    expect(Object.isFrozen(declarationFor(makeSampleEntry()))).toBe(true);
  });
});

describe('reading the comprehendo key out of a package.json', () => {
  it('reads the declaration a conforming package carries', () => {
    const text = packageJson({ [MANIFEST_KEY]: { version: '0.1', level: 2 } });

    expect(declared(readPackageJson(text))).toEqual({ version: '0.1', level: 2 });
  });

  it('says absent, not unreadable, for a package that makes no claim', () => {
    expect(readPackageJson(packageJson()).status).toBe('absent');
  });

  it('says unreadable, not absent, for text that is not JSON at all', () => {
    expect(unreadable(readPackageJson('{ not json'))).toMatch(/json/i);
  });

  it('says unreadable for JSON that is not an object', () => {
    expect(unreadable(readPackageJson('[1, 2, 3]'))).toMatch(/object/i);
  });

  it('says unreadable when the key is present but is not an object', () => {
    expect(unreadable(readPackageJson(packageJson({ [MANIFEST_KEY]: true })))).toMatch(
      new RegExp(MANIFEST_KEY),
    );
  });

  it('says unreadable, naming the field, when version is missing', () => {
    const text = packageJson({ [MANIFEST_KEY]: { level: 1 } });

    expect(unreadable(readPackageJson(text))).toMatch(/version/);
  });

  it('says unreadable, naming the field, when level is not 1 or 2', () => {
    expect(unreadable(readPackageJson(packageJson({ [MANIFEST_KEY]: { version: '0.1', level: 3 } })))).toMatch(
      /level/,
    );
  });

  it('refuses a level written as a string, which the schema calls an integer', () => {
    const text = packageJson({ [MANIFEST_KEY]: { version: '0.1', level: '2' } });

    expect(unreadable(readPackageJson(text))).toMatch(/level/);
  });

  it('projects exactly the declaration when the key also carries endorsement fields', () => {
    // manifest.schema.json is an open object: RFC 10.6's `corpus`/`owners`
    // ride the same key. They are not the provider-side declaration.
    const text = packageJson({
      [MANIFEST_KEY]: { version: '0.1', level: 1, corpus: '@comprehendo/toy', owners: ['a'] },
    });

    expect(declared(readPackageJson(text))).toEqual(DECLARATION);
  });
});

describe('parseDeclaration, the value at the key on its own', () => {
  it('reads a well-formed declaration', () => {
    expect(declared(parseDeclaration({ version: '0.1', level: 2 }))).toEqual({
      version: '0.1',
      level: 2,
    });
  });

  it('calls undefined absent, and a malformed value unreadable', () => {
    expect(parseDeclaration(undefined).status).toBe('absent');
    expect(parseDeclaration(null).status).toBe('unreadable');
    expect(parseDeclaration('0.1').status).toBe('unreadable');
  });

  it('reads the manifest hint the corpus generator writes for an author to paste', () => {
    const hint = emptyCorpus('toy-encoder', {
      package: 'toy-encoder',
      version: '1.0.0',
      source: 'src',
    }).manifest_hint[MANIFEST_KEY];

    expect(declared(parseDeclaration(hint))).toEqual({ version: hint.version, level: hint.level });
  });
});

describe('stamping a package.json', () => {
  it('writes the key, and the result reads back as the same declaration', () => {
    const stamped = stampPackageJson(packageJson(), DECLARATION);

    expect(declared(readPackageJson(stamped))).toEqual(DECLARATION);
  });

  it('leaves every other field of the manifest exactly as it was', () => {
    const before = JSON.parse(packageJson({ scripts: { test: 'vitest run' } })) as Record<
      string,
      unknown
    >;

    const after = JSON.parse(
      stampPackageJson(packageJson({ scripts: { test: 'vitest run' } }), DECLARATION),
    ) as Record<string, unknown>;

    for (const [key, value] of Object.entries(before)) {
      expect(after[key]).toEqual(value);
    }
    expect(Object.keys(after).filter((key) => !(key in before))).toEqual([MANIFEST_KEY]);
  });

  it("never deletes the consumer's own knobs, which live under the same key", () => {
    // config.schema.json puts prefer/pin/disable/require/local under this exact
    // key. A provider-side stamp that replaced it would delete a consumer's
    // configuration.
    const text = packageJson({
      [MANIFEST_KEY]: { disable: ['legacy-pkg'], prefer: { ffmpeg: 'sidecar' } },
    });

    const after = JSON.parse(stampPackageJson(text, DECLARATION)) as Record<
      string,
      Record<string, unknown>
    >;

    expect(after[MANIFEST_KEY]).toEqual({
      disable: ['legacy-pkg'],
      prefer: { ffmpeg: 'sidecar' },
      version: '0.1',
      level: 1,
    });
  });

  it('updates an existing declaration in place rather than appending a second one', () => {
    const text = packageJson({ [MANIFEST_KEY]: { version: '0.0.1', level: 2, corpus: 'x' } });

    const after = stampPackageJson(text, DECLARATION);

    expect(declared(readPackageJson(after))).toEqual(DECLARATION);
    expect(Object.keys((JSON.parse(after) as Record<string, object>)[MANIFEST_KEY] ?? {})).toEqual([
      'version',
      'level',
      'corpus',
    ]);
  });

  it('is idempotent: stamping the same declaration twice is byte-identical', () => {
    const once = stampPackageJson(packageJson(), DECLARATION);

    expect(stampPackageJson(once, DECLARATION)).toBe(once);
  });

  it('keeps the indentation the file already used, and its trailing newline', () => {
    const text = `${JSON.stringify({ name: 'four-space' }, null, 4)}\n`;

    const after = stampPackageJson(text, DECLARATION);

    expect(after.split('\n')[1]).toMatch(/^ {4}"/);
    expect(after.endsWith('\n')).toBe(true);
  });

  it('refuses a declaration the schema would reject, rather than writing it', () => {
    const bad = { version: '0.1', level: 3 } as unknown as ManifestDeclaration;

    expect(() => stampPackageJson(packageJson(), bad)).toThrow(ManifestError);
    expect(() => stampPackageJson(packageJson(), bad)).toThrow(/level/);
  });

  it('refuses host text it cannot parse, rather than replacing it', () => {
    expect(() => stampPackageJson('{ not json', DECLARATION)).toThrow(ManifestError);
  });
});

describe('reading [tool.comprehendo] out of a pyproject.toml', () => {
  const withTable = (body: string[]): string =>
    `${PYPROJECT}[${PYPROJECT_TABLE}]\n${body.join('\n')}\n`;

  it('reads the table a conforming Python package carries', () => {
    const text = withTable(['version = "0.1"', 'level = 2']);

    expect(declared(readPyproject(text))).toEqual({ version: '0.1', level: 2 });
  });

  it('says absent for a pyproject that makes no claim', () => {
    expect(readPyproject(PYPROJECT).status).toBe('absent');
  });

  it('reads through comments, blank lines, and single-quoted strings', () => {
    const text = withTable([
      '# the provider-side declaration',
      "version = '0.1'   # advisory, the marker wins",
      '',
      '  level   =   1  ',
    ]);

    expect(declared(readPyproject(text))).toEqual(DECLARATION);
  });

  it('stops at the next table, so a sub-table cannot overwrite what it read', () => {
    const text = `${withTable(['version = "0.1"', 'level = 1'])}\n[tool.comprehendo.notes]\nlevel = 2\n`;

    expect(declared(readPyproject(text))).toEqual(DECLARATION);
  });

  it('stops at the next table, so a later table cannot leak into it', () => {
    const text = `${withTable(['version = "0.1"', 'level = 1'])}\n[tool.ruff]\nversion = "9.9"\n`;

    expect(declared(readPyproject(text))).toEqual(DECLARATION);
  });

  it('says unreadable, naming the inline form, rather than lying about absence', () => {
    // The one wrong answer available here is "this package does not speak
    // Comprehendo" about a package that does.
    const text = `${PYPROJECT}[tool]\ncomprehendo = { version = "0.1", level = 1 }\n`;

    expect(unreadable(readPyproject(text))).toMatch(/inline|table/i);
  });

  it('says unreadable for the dotted-key spelling too', () => {
    const text = `${PYPROJECT}${PYPROJECT_TABLE} = { version = "0.1", level = 1 }\n`;

    expect(unreadable(readPyproject(text))).toMatch(/inline|dotted|table/i);
  });

  it('says unreadable for the array-of-tables spelling too, not absent', () => {
    // [[tool.comprehendo]] is a third valid way to occupy this key, beside
    // the inline-table and dotted-key forms above. The bug this guards:
    // the double bracket confused the single-bracket header capture and
    // this spelling fell through as silently absent.
    const text = `${PYPROJECT}[[${PYPROJECT_TABLE}]]\nversion = "0.1"\nlevel = 1\n`;

    expect(unreadable(readPyproject(text))).toMatch(/array|table/i);
  });

  it('says unreadable, naming the field, when the table is incomplete', () => {
    expect(unreadable(readPyproject(withTable(['version = "0.1"'])))).toMatch(/level/);
    expect(unreadable(readPyproject(withTable(['level = 1'])))).toMatch(/version/);
  });

  it('says unreadable when level is not an integer 1 or 2', () => {
    expect(unreadable(readPyproject(withTable(['version = "0.1"', 'level = "2"'])))).toMatch(
      /level/,
    );
    expect(unreadable(readPyproject(withTable(['version = "0.1"', 'level = 7'])))).toMatch(/level/);
  });
});

describe('stamping a pyproject.toml', () => {
  it('appends the table when there is none, leaving the rest byte-identical', () => {
    const after = stampPyproject(PYPROJECT, DECLARATION);

    expect(after.startsWith(PYPROJECT)).toBe(true);
    expect(after).toContain(`[${PYPROJECT_TABLE}]`);
    expect(declared(readPyproject(after))).toEqual(DECLARATION);
  });

  it('updates the table in place, keeping its other keys and comments', () => {
    const text = `${PYPROJECT}[${PYPROJECT_TABLE}]\n# hand-written\nversion = "0.0.1"\ncorpus = "@comprehendo/toy"\nlevel = 2\n`;

    const after = stampPyproject(text, DECLARATION);

    expect(after).toContain('# hand-written');
    expect(after).toContain('corpus = "@comprehendo/toy"');
    expect(after).toContain('version = "0.1"');
    expect(after).toContain('level = 1');
    expect(declared(readPyproject(after))).toEqual(DECLARATION);
  });

  it('writes exactly one table, never a second one beside the first', () => {
    const after = stampPyproject(stampPyproject(PYPROJECT, DECLARATION), { version: '0.2', level: 2 });

    expect(after.split(`[${PYPROJECT_TABLE}]`)).toHaveLength(2);
    expect(declared(readPyproject(after))).toEqual({ version: '0.2', level: 2 });
  });

  it('is idempotent: stamping the same declaration twice is byte-identical', () => {
    const once = stampPyproject(PYPROJECT, DECLARATION);

    expect(stampPyproject(once, DECLARATION)).toBe(once);
  });

  it('leaves every other table untouched, character for character', () => {
    const text = `${PYPROJECT}[tool.ruff]\nline-length = 100\n`;

    const after = stampPyproject(text, DECLARATION);

    expect(after).toContain('[tool.ruff]\nline-length = 100\n');
    expect(after.trimEnd().endsWith('level = 1')).toBe(true);
  });

  it('refuses the inline spelling rather than writing a duplicate table into it', () => {
    const text = `${PYPROJECT}[tool]\ncomprehendo = { version = "0.1", level = 1 }\n`;

    expect(() => stampPyproject(text, DECLARATION)).toThrow(ManifestError);
  });

  it('refuses the array-of-tables spelling rather than writing a conflicting table into it', () => {
    const text = `${PYPROJECT}[[${PYPROJECT_TABLE}]]\nversion = "0.1"\nlevel = 1\n`;

    expect(() => stampPyproject(text, DECLARATION)).toThrow(ManifestError);
  });

  it('refuses a declaration the schema would reject', () => {
    const bad = { version: '', level: 1 } as ManifestDeclaration;

    expect(() => stampPyproject(PYPROJECT, bad)).toThrow(ManifestError);
  });
});

describe('through a real manifest file on disk', () => {
  it('stamps a real package.json and reads it back off the filesystem', () => {
    const workspace = makeWorkspace();
    const path = join(workspace.target, 'package.json');

    const wrote = stampManifestFile(path, DECLARATION);

    expect(wrote).toBe(true);
    expect(declared(readManifestFile(path))).toEqual(DECLARATION);
    expect((JSON.parse(readFileSync(path, 'utf8')) as { name?: string }).name).toBe('toy-encoder');
  });

  it('does not touch a file that already carries the declaration', () => {
    const workspace = makeWorkspace();
    const path = join(workspace.target, 'package.json');
    stampManifestFile(path, DECLARATION);
    const before = readFileSync(path, 'utf8');

    const wrote = stampManifestFile(path, DECLARATION);

    expect(wrote).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });

  it('stamps a real pyproject.toml and reads it back off the filesystem', () => {
    const workspace = makeWorkspace();
    const path = join(workspace.target, 'pyproject.toml');
    writeFileSync(path, PYPROJECT, 'utf8');

    expect(stampManifestFile(path, { version: '0.1', level: 2 })).toBe(true);
    expect(declared(readManifestFile(path))).toEqual({ version: '0.1', level: 2 });
    expect(readFileSync(path, 'utf8').startsWith(PYPROJECT)).toBe(true);
  });

  it('says absent for a real manifest that makes no claim', () => {
    const workspace = makeWorkspace();

    expect(readManifestFile(join(workspace.target, 'package.json')).status).toBe('absent');
  });

  it('refuses a manifest format it does not know, by name', () => {
    const workspace = makeWorkspace();
    const path = join(workspace.target, 'setup.cfg');
    writeFileSync(path, '[metadata]\n', 'utf8');

    expect(() => readManifestFile(path)).toThrow(ManifestError);
    expect(() => stampManifestFile(path, DECLARATION)).toThrow(/setup\.cfg/);
  });

  it('refuses a path that does not exist, rather than creating a manifest', () => {
    const workspace = makeWorkspace();

    expect(() => readManifestFile(join(workspace.target, 'nope', 'package.json'))).toThrow(
      ManifestError,
    );
  });
});

describe('the marker is authoritative (disagreement fixture, 04)', () => {
  it("reads the fixture's manifest step as a declaration this component understands", () => {
    expect(declared(parseDeclaration(fixtureStep('manifest')))).toEqual({
      version: '0.2',
      level: 2,
    });
  });

  it("resolves to exactly the fixture's own resolved view", () => {
    const manifest = declared(parseDeclaration(fixtureStep('manifest')));

    const resolved = resolveDiscovery({ marker: fixtureMarker(), manifest });

    expect(resolved).toEqual(at(disagreement(), 'resolved'));
  });

  it('resolves every disagreement the fixture lists in the marker\'s favor', () => {
    const rows = at(disagreement(), 'disagreements') as {
      marker_key: string;
      marker_value: unknown;
      manifest_value: unknown;
      wins: string;
    }[];
    const manifest = declared(parseDeclaration(fixtureStep('manifest')));

    const resolved = resolveDiscovery({ marker: fixtureMarker(), manifest }) as unknown as Record<
      string,
      unknown
    >;

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.wins).toBe('marker');
      expect(resolved[row.marker_key]).toEqual(row.marker_value);
      expect(resolved[row.marker_key]).not.toEqual(row.manifest_value);
    }
  });

  it('never claims a surface the runtime does not offer, whatever the manifest declared', () => {
    const manifest = declared(parseDeclaration(fixtureStep('manifest')));

    const resolved = resolveDiscovery({ marker: fixtureMarker(), manifest });

    expect(manifest.level).toBe(2);
    expect(resolved?.level).toBe(1);
    expect(resolved?.surfaces).toEqual(['docs']);
  });

  it('names the marker as the source even when the two agree, so the rule never depends on luck', () => {
    const marker = fixtureMarker();

    const resolved = resolveDiscovery({ marker, manifest: declarationFor(marker) });

    expect(resolved?.source).toBe('marker');
  });

  it('falls back to the manifest only when no marker is present', () => {
    const resolved = resolveDiscovery({ manifest: { version: '0.2', level: 2 } });

    expect(resolved).toEqual({ comprehendo: '0.2', level: 2, source: 'manifest' });
  });

  it('claims no surfaces at all from a manifest, because static discovery cannot know them', () => {
    const resolved = resolveDiscovery({ manifest: DECLARATION });

    expect(resolved).not.toHaveProperty('surfaces');
  });

  it('resolves from the marker alone when there is no manifest', () => {
    const marker = fixtureMarker();

    expect(resolveDiscovery({ marker })).toEqual({
      comprehendo: marker.comprehendo,
      level: marker.level,
      surfaces: marker.surfaces,
      source: 'marker',
    });
  });

  it('answers undefined when neither channel says anything', () => {
    expect(resolveDiscovery({})).toBeUndefined();
  });

  it('resolves off a package built by makeProvider, end to end through both channels', () => {
    const provider = makeProvider(toyCorpus(), toyHooks());
    const stamped = stampPackageJson(packageJson(), provider.manifest);

    const resolved = resolveDiscovery({
      marker: provider.entry,
      manifest: declared(readPackageJson(stamped)),
    });

    expect(resolved).toEqual({
      comprehendo: provider.entry.comprehendo,
      level: provider.level,
      surfaces: provider.surfaces,
      source: 'marker',
    });
  });
});
