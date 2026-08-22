/**
 * Config Loader [23], the reading half: the five consumer-side knobs
 * (`prefer`, `pin`, `disable`, `require`, `local`) read out of the consuming
 * project's OWN manifest.
 *
 * The knobs live under the same `comprehendo` key a provider declares
 * `{version, level}` under, which is exactly why CC8 [19] is asserted here as
 * well as in `config-cc8.test.ts`: the same bytes in a PROVIDER's manifest
 * express nothing, because the provider-side read projects to two fields and
 * has no channel for a third. The knob set itself is checked against the
 * conformance kit's `config.schema.json` rather than a hand-copied list: a
 * check against a copy passes cleanly on the day the schema grows a knob.
 *
 * @see .mdd/docs/23-config-loader.md
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
  CONFIG_KNOBS,
  MANIFEST_FIELDS,
  MANIFEST_KEY,
  ManifestError,
  TRUST_LEVELS,
  parseConsumerConfig,
  readConsumerConfigFile,
  readPackageJson,
} from '../src/config.js';
import { at, readKitJson } from './helpers/source-scan.js';

/** The RFC §10.5 worked example, one entry per knob. */
const KNOBS = {
  prefer: { zod: 'sidecar' },
  pin: { '@comprehendo/ffmpeg': '1.4.2' },
  disable: ['some-noisy-pkg'],
  require: { zod: 'endorsed' },
  local: { 'our-internal-lib': './comprehendo/our-internal-lib' },
};

const roots: string[] = [];

/** A real consuming project's package.json, on a real disk. */
function project(host: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'comprehendo-consumer-'));
  roots.push(root);
  const path = join(root, 'package.json');
  writeFileSync(path, `${JSON.stringify(host, null, 2)}\n`, 'utf8');
  return path;
}

const schemaKnobs = (): string[] =>
  Object.keys(at(readKitJson('shapes', 'config.schema.json'), 'properties') ?? {});

afterAll(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('the five knobs, read from the consuming project own manifest', () => {
  it('reads all five off a real package.json', () => {
    const reading = readConsumerConfigFile(project({ name: 'app', [MANIFEST_KEY]: KNOBS }));

    expect(reading.problems).toEqual([]);
    expect(reading.config).toEqual(KNOBS);
  });

  it('reads no knobs from a project that configured none', () => {
    const reading = readConsumerConfigFile(project({ name: 'app' }));

    expect(reading.config).toEqual({});
    expect(reading.problems).toEqual([]);
  });

  it('reads no knobs from a manifest carrying only a provider declaration', () => {
    // `version` and `level` are the PROVIDER's two fields under the same key.
    // They are not knobs, and reading them as configuration would invent one.
    const reading = readConsumerConfigFile(
      project({ name: 'app', [MANIFEST_KEY]: { version: '0.1', level: 1 } }),
    );

    expect(reading.config).toEqual({});
    expect(reading.problems).toEqual([]);
  });

  it('ignores keys under the manifest key that belong to other components', () => {
    // RFC §10.6's endorsement keys (`corpus`, `owners`) live under this same
    // key and are Owner Endorsement [30]'s, not this loader's.
    const reading = readConsumerConfigFile(
      project({ [MANIFEST_KEY]: { ...KNOBS, corpus: 'sha256-...', owners: ['github:someone'] } }),
    );

    expect(reading.config).toEqual(KNOBS);
    expect(reading.problems).toEqual([]);
  });

  it('parses each knob independently, so one knob is a complete config', () => {
    for (const knob of CONFIG_KNOBS) {
      const only = { [knob]: KNOBS[knob] };

      expect(parseConsumerConfig(only)).toEqual({ config: only, problems: [] });
    }
  });

  it('refuses a consumer manifest this build cannot read knobs out of, by name', () => {
    const root = mkdtempSync(join(tmpdir(), 'comprehendo-consumer-'));
    roots.push(root);
    const path = join(root, 'pyproject.toml');
    writeFileSync(path, '[tool.comprehendo.prefer]\nzod = "sidecar"\n', 'utf8');

    expect(() => readConsumerConfigFile(path)).toThrow(ManifestError);
    expect(() => readConsumerConfigFile(path)).toThrow(/pyproject\.toml/);
  });

  it('throws for a manifest file that is not there at all', () => {
    expect(() => readConsumerConfigFile(join(tmpdir(), 'no-such-project', 'package.json'))).toThrow(
      ManifestError,
    );
  });
});

describe('a knob that cannot be read is reported, never guessed', () => {
  it('reports package.json text that is not JSON, and reads no knobs from it', () => {
    const root = mkdtempSync(join(tmpdir(), 'comprehendo-consumer-'));
    roots.push(root);
    const path = join(root, 'package.json');
    writeFileSync(path, '{ not json at all', 'utf8');

    const reading = readConsumerConfigFile(path);

    expect(reading.config).toEqual({});
    expect(reading.problems).toHaveLength(1);
    expect(reading.problems[0]).toMatch(/not valid JSON/);
  });

  it('drops a knob of the wrong shape and names it', () => {
    const reading = parseConsumerConfig({ disable: { zod: true }, prefer: ['zod'] });

    expect(reading.config).toEqual({});
    expect(reading.problems).toHaveLength(2);
    expect(reading.problems.join(' ')).toContain('"disable"');
    expect(reading.problems.join(' ')).toContain('"prefer"');
  });

  it('drops one bad entry and keeps the rest of the same knob', () => {
    const reading = parseConsumerConfig({ pin: { '@comprehendo/ffmpeg': 142, zod: '1.0.0' } });

    expect(reading.config.pin).toEqual({ zod: '1.0.0' });
    expect(reading.problems.join(' ')).toContain('@comprehendo/ffmpeg');
  });

  it('drops a non-string entry from disable and names the index', () => {
    const reading = parseConsumerConfig({ disable: ['zod', 7] });

    expect(reading.config.disable).toEqual(['zod']);
    expect(reading.problems).toHaveLength(1);
  });

  it('reports a require value that is not on the trust ladder, and keeps it', () => {
    // Kept on purpose: the router refuses to route rather than treating an
    // unreadable demand as no demand. Reported so the typo is visible.
    const reading = parseConsumerConfig({ require: { zod: 'trustworthy' } });

    expect(reading.config.require).toEqual({ zod: 'trustworthy' });
    expect(reading.problems.join(' ')).toContain('trustworthy');
    expect(reading.problems.join(' ')).toContain([...TRUST_LEVELS].join(', '));
  });

  it('reads a manifest key that is not an object as no configuration at all', () => {
    expect(parseConsumerConfig('sidecar').config).toEqual({});
    expect(parseConsumerConfig('sidecar').problems).toHaveLength(1);
    expect(parseConsumerConfig(undefined)).toEqual({ config: {}, problems: [] });
  });
});

describe('the parsed config is a value, frozen all the way down', () => {
  it('freezes the config, every knob record, and the disable list', () => {
    const { config } = parseConsumerConfig(KNOBS);
    const mutable = config as {
      prefer?: Record<string, string>;
      disable?: string[];
    };

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.prefer)).toBe(true);
    expect(Object.isFrozen(config.disable)).toBe(true);
    expect(() => {
      (mutable.prefer ?? {})['zod'] = 'native';
    }).toThrow(TypeError);
    expect(() => (mutable.disable ?? []).push('anything')).toThrow(TypeError);
  });

  it('does not alias the manifest object it was read from', () => {
    const host: Record<string, unknown> = { disable: ['zod'] };
    const { config } = parseConsumerConfig(host);

    (host['disable'] as string[]).push('mutated-after-the-read');

    expect(config.disable).toEqual(['zod']);
  });
});

describe('the knob set is the conformance kit shape, not a copy of it', () => {
  it('parses exactly the knobs config.schema.json declares', () => {
    expect(schemaKnobs().length).toBe(5);
    expect([...CONFIG_KNOBS].sort()).toEqual(schemaKnobs().sort());
  });

  it('accepts the kit worked example whole, with nothing reported', () => {
    const reading = parseConsumerConfig(KNOBS);

    expect(Object.keys(reading.config).sort()).toEqual(schemaKnobs().sort());
    expect(reading.problems).toEqual([]);
  });

  it('spells the trust ladder as the RFC does, lowest rung first', () => {
    expect([...TRUST_LEVELS]).toEqual(['community', 'endorsed', 'native']);
    expect(Object.isFrozen(TRUST_LEVELS)).toBe(true);
  });
});

describe('CC8: the same bytes in a provider manifest express nothing', () => {
  it('shares no name with the provider-side declaration fields', () => {
    const overlap = [...CONFIG_KNOBS].filter((knob) =>
      (MANIFEST_FIELDS as readonly string[]).includes(knob),
    );

    expect(overlap).toEqual([]);
  });

  it('projects a provider manifest carrying all five knobs to two fields', () => {
    const text = `${JSON.stringify({ name: 'greedy', [MANIFEST_KEY]: { version: '0.1', level: 1, ...KNOBS } })}\n`;

    const provider = readPackageJson(text);

    expect(provider.status).toBe('declared');
    expect(Object.keys(provider.status === 'declared' ? provider.declaration : {})).toEqual([
      ...MANIFEST_FIELDS,
    ]);
  });

  it('reads the knobs only when the manifest is the CONSUMER own', () => {
    // The identical object, read through the two paths. The consumer's read
    // returns five knobs; the provider's returns a version and a level. The
    // asymmetry is the whole of CC8's consumer-side half.
    const host = { name: 'app', [MANIFEST_KEY]: { version: '0.1', level: 1, ...KNOBS } };
    const consumer = readConsumerConfigFile(project(host));

    expect(consumer.config).toEqual(KNOBS);
    expect(Object.keys(consumer.config).sort()).toEqual([...CONFIG_KNOBS].sort());
  });
});
