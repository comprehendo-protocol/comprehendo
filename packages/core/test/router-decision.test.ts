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

describe('no native implementation present', () => {
  it('routes to the sidecar unconditionally', () => {
    expect.fail('MDD skeleton');
  });

  it('names the package and states why in the decision', () => {
    expect.fail('MDD skeleton');
  });

  it('routes to the sidecar for a package with no installed corpus either', () => {
    expect.fail('MDD skeleton');
  });
});

describe('native present, no override: native handles the call', () => {
  it('a marker on the caught value routes to native', () => {
    expect.fail('MDD skeleton');
  });

  it('a manifest declaration with no marker routes to native on the pre-import hint', () => {
    expect.fail('MDD skeleton');
  });

  it('records which discovery channel answered', () => {
    expect.fail('MDD skeleton');
  });

  it('an unreadable manifest is not a native claim', () => {
    expect.fail('MDD skeleton');
  });
});

describe('the marker is authoritative, the manifest is a hint', () => {
  it('resolves the kit disagreement fixture in the marker favour', () => {
    expect.fail('MDD skeleton');
  });

  it('discards the manifest claim even where the two agree', () => {
    expect.fail('MDD skeleton');
  });
});

describe('the consumer prefer knob reverses precedence, per package', () => {
  it('prefer sidecar routes to the sidecar with a marker present', () => {
    expect.fail('MDD skeleton');
  });

  it('prefer sidecar for another package leaves this one native', () => {
    expect.fail('MDD skeleton');
  });

  it('a prefer value that is not sidecar does not flip precedence', () => {
    expect.fail('MDD skeleton');
  });
});

describe('CC8: no provider-side suppression is possible', () => {
  it('a suppression-shaped field in a provider manifest changes nothing', () => {
    expect.fail('MDD skeleton');
  });

  it('the decision carries only what a manifest reading projects to', () => {
    expect.fail('MDD skeleton');
  });

  it('the router source reads no suppression-shaped field from provider input', () => {
    expect.fail('MDD skeleton');
  });
});
