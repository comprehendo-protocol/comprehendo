// Package barrel. Re-exports land here as each Wave 2 component ships:
// marker.ts (11), twin.ts (12), docs.ts (13), sdk.ts (14, the primary
// makeProvider() entry consumers actually import), config.ts (15),
// recorder.ts (16). Intentionally empty until sdk.ts (14-sdk-entry) exists,
// since that is this package's real public surface, not a re-export of
// every internal module.
export {};
