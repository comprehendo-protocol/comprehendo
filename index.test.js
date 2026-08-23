// The root npm package's real public surface: makeProvider(), re-exported
// from packages/core's REAL build, never a stub. Requires packages/core to
// be built first (`npm run build`); a missing dist fails this test naming
// the real ENOENT rather than a mock standing in for it.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { makeProvider } from './index.js';

describe('the root package re-exports the real provider SDK, not a placeholder', () => {
  it('makeProvider is a real function, not a stub string return', () => {
    assert.equal(typeof makeProvider, 'function');
  });

  it('is the SAME function packages/core/dist/index.js exports, not a copy', async () => {
    const core = await import('./packages/core/dist/index.js');

    assert.equal(makeProvider, core.makeProvider);
  });
});
