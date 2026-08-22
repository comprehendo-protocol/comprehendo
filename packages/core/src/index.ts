// Package barrel. Re-exports land here as each Wave 2 component ships:
// marker.ts (11), twin.ts (12), docs.ts (13), sdk.ts (14, the primary
// makeProvider() entry consumers actually import), config.ts (15),
// recorder.ts (16). This is the package's real public surface, not a
// re-export of every internal module: one line per component that a
// consumer genuinely calls, added by that component's own build.

// 14-sdk-entry: makeProvider() and the types tied to it. A provider built
// here already carries the marker (11), its throw-site twins (12), and its
// docs surface (13), so a consumer needs no second import to use them.
export * from './sdk.js';
