// Package barrel. Re-exports land here as each Wave 2 component ships:
// marker.ts (11), twin.ts (12), docs.ts (13), sdk.ts (14, the primary
// makeProvider() entry consumers actually import), config.ts (15),
// recorder.ts (16). This is the package's real public surface, not a
// re-export of every internal module: one line per component that a
// consumer genuinely calls, added by that component's own build.
//
// docs.ts (13), config.ts (15, itself re-exporting config-consumer.ts) and
// router.ts (22, itself re-exporting router-precedence.ts) shipped in their
// own waves but were never added here: an agent-side consumer had to know
// packages/core's internal file paths to reach comprehend()/docs() at all.
// Found by review; fixed by finishing what this comment always said would
// happen. No export name collides across these files (checked mechanically,
// not by eye, before adding this).

// 14-sdk-entry: makeProvider() and the types tied to it. A provider built
// here already carries the marker (11), its throw-site twins (12), and its
// docs surface (13), so a consumer needs no second import to use them.
export * from './sdk.js';

// 13-docs-engine: createDocs(corpus, options), the standalone docs() surface
// over one already-loaded packed corpus.
export * from './docs.js';

// 15-config-loader: the five consumer knobs (prefer/pin/disable/require/
// local) and the manifest-declaration readers/stampers.
export * from './config.js';

// 22-router-precedence + 19-router-discovery: createRouter(environment,
// config), which is what actually returns the bound comprehend(raw)/
// docs(pkg, query) methods an agent calls, and discoverInstalledCorpora,
// which builds the Environment createRouter needs. Both real entries, not a
// re-export of every internal router module.
export * from './router.js';
export { discoverInstalledCorpora } from './router-discovery.js';
export type { CorpusDescriptor, DiscoveryOptions } from './router-discovery.js';
