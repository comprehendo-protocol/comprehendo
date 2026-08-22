// Router & Precedence [22], the precedence decision.
//
// CC8 [19]'s runtime half: native beats sidecar by default, the consumer
// `prefer` knob is the only thing that reverses it, and no provider-side
// field can suppress a registry corpus at all. The structural half of CC8
// (the manifest schema has no suppression field) is already settled in
// config-cc8.test.ts; what is settled HERE is what the router DOES.
//
// Discovery reads both channels: the runtime marker (Marker & Probe [11],
// authoritative) and the static manifest (Manifest Wiring [15], advisory).
// The disagreement fixture (Conformance Fixtures [04]) is the arbiter, and it
// is read from the kit rather than restated here.

import { describe, expect, it } from 'vitest';

import { parseDeclaration, readPackageJson } from '../src/config.js';
import type { ManifestReading } from '../src/config.js';
import { decideRoute } from '../src/router.js';
import type { ComprehendoEntry, ComprehendoLevel } from '../src/marker.js';
import { at, readCoreSources, readKitJson } from './helpers/source-scan.js';
import { TOY, nativeEntry } from './helpers/sidecar.js';

/** The kit's disagreement fixture: a manifest that has drifted ahead of the build. */
const disagreement = (): unknown => readKitJson('fixtures', 'disagreement.json');

const declared = (version: string, level: ComprehendoLevel): ManifestReading =>
  parseDeclaration({ version, level });

const markerFrom = (fixture: unknown): ComprehendoEntry =>
  at(fixture, 'steps', '1', 'response') as ComprehendoEntry;

describe('no native implementation present', () => {
  it('routes to the sidecar unconditionally', () => {
    expect(decideRoute(TOY).source).toBe('sidecar');
    expect(decideRoute(TOY, {}).source).toBe('sidecar');
  });

  it('names the package and states why in the decision', () => {
    const decision = decideRoute(TOY, {});

    expect(decision.package).toBe(TOY);
    expect(decision.reason).toContain('no native implementation');
    expect(decision.discovery).toBeUndefined();
  });

  it('routes to the sidecar for a package with no installed corpus either', () => {
    // The decision is about tiers, not inventory: whether a corpus is
    // actually installed is what comprehend() answers with, not what
    // precedence is computed from.
    expect(decideRoute('never-heard-of-it').source).toBe('sidecar');
  });
});

describe('native present, no override: native handles the call', () => {
  it('a marker on the caught value routes to native', () => {
    expect(decideRoute(TOY, { marker: nativeEntry() }).source).toBe('native');
  });

  it('a manifest declaration with no marker routes to native on the pre-import hint', () => {
    const decision = decideRoute(TOY, { manifest: declared('0.1', 1) });

    expect(decision.source).toBe('native');
    expect(decision.discovery?.source).toBe('manifest');
  });

  it('records which discovery channel answered', () => {
    const byMarker = decideRoute(TOY, { marker: nativeEntry(), manifest: declared('0.1', 1) });

    expect(byMarker.discovery?.source).toBe('marker');
    expect(byMarker.reason).toContain('authoritative');
  });

  it('an unreadable manifest is not a native claim', () => {
    const unreadable = parseDeclaration({ level: 1 });

    expect(unreadable.status).toBe('unreadable');
    expect(decideRoute(TOY, { manifest: unreadable }).source).toBe('sidecar');
  });
});

describe('the marker is authoritative, the manifest is a hint', () => {
  it('resolves the kit disagreement fixture in the marker favour', () => {
    const fixture = disagreement();
    const resolved = at(fixture, 'resolved') as { comprehendo: string; level: number };

    const decision = decideRoute(TOY, {
      marker: markerFrom(fixture),
      manifest: declared('0.2', 2),
    });

    expect(decision.source).toBe('native');
    expect(decision.discovery?.source).toBe('marker');
    expect(decision.discovery?.comprehendo).toBe(resolved.comprehendo);
    expect(decision.discovery?.level).toBe(resolved.level);
  });

  it('discards the manifest claim even where the two agree', () => {
    const decision = decideRoute(TOY, { marker: nativeEntry(), manifest: declared('0.1', 1) });

    expect(decision.discovery?.source).toBe('marker');
    // The manifest's identical claim is not what was returned: the surfaces
    // list only the marker can know is present.
    expect(decision.discovery?.surfaces).toEqual(['docs']);
  });
});

describe('the consumer prefer knob reverses precedence, per package', () => {
  it('prefer sidecar routes to the sidecar with a marker present', () => {
    const decision = decideRoute(TOY, { marker: nativeEntry() }, { prefer: { [TOY]: 'sidecar' } });

    expect(decision.source).toBe('sidecar');
    expect(decision.reason).toContain('reverses native precedence');
    // The native implementation is still there and still reported; what the
    // knob changed is who answers, not what is true.
    expect(decision.discovery?.source).toBe('marker');
  });

  it('prefer sidecar for another package leaves this one native', () => {
    const config = { prefer: { 'some-other-package': 'sidecar' } };

    expect(decideRoute(TOY, { marker: nativeEntry() }, config).source).toBe('native');
  });

  it('a prefer value that is not sidecar does not flip precedence', () => {
    const config = { prefer: { [TOY]: 'native' } };

    expect(decideRoute(TOY, { marker: nativeEntry() }, config).source).toBe('native');
    expect(decideRoute(TOY, {}, config).source).toBe('sidecar');
  });
});

describe('CC8: no provider-side suppression is possible', () => {
  it('a suppression-shaped field in a provider manifest changes nothing', () => {
    // A provider trying every spelling it can think of, in the one place a
    // provider gets to write anything at all.
    const hostile = JSON.stringify({
      name: TOY,
      comprehendo: {
        version: '0.1',
        level: 1,
        suppress: [`@comprehendo/${TOY}`],
        disableSidecar: true,
        prefer: { [TOY]: 'native' },
      },
    });

    const reading = readPackageJson(hostile);
    const withCorpus = decideRoute(TOY, { manifest: reading });
    const preferred = decideRoute(TOY, { manifest: reading }, { prefer: { [TOY]: 'sidecar' } });

    // Native, because it declared a version and a level, and for no other
    // reason; and the consumer's own knob still reverses it.
    expect(withCorpus.source).toBe('native');
    expect(preferred.source).toBe('sidecar');
  });

  it('the decision carries only what a manifest reading projects to', () => {
    const reading = readPackageJson(
      JSON.stringify({ comprehendo: { version: '0.1', level: 1, veto: 'everything' } }),
    );

    expect(reading.status).toBe('declared');
    const decision = decideRoute(TOY, { manifest: reading });

    expect(Object.keys(decision.discovery ?? {}).sort()).toEqual(['comprehendo', 'level', 'source']);
  });

  it('the router source reads no suppression-shaped field from provider input', () => {
    // Same shape as config-cc8's scan: assert the ABSENCE over something
    // real. A field named anything like a veto never appears in the routing
    // modules, so there is no channel for one to arrive through.
    const suppression =
      /suppress|veto|deny|block|exclude|opt[-_]?out|optOut|noSidecar|disableSidecar/i;
    const routing = readCoreSources().filter((source) => source.path.startsWith('router'));

    expect(routing.map((source) => source.path)).toContain('router-precedence.ts');
    for (const source of routing) {
      expect({ file: source.path, hit: suppression.test(source.code) }).toEqual({
        file: source.path,
        hit: false,
      });
    }
  });
});
