// The comprehendo npm package's own real public surface: packages/core's
// full built barrel, re-exported unchanged. makeProvider() is the entry a
// package building native Comprehendo support calls; createRouter(environment,
// config) plus discoverInstalledCorpora is the sidecar reading surface an
// agent-side consumer calls for a package that never adopted Comprehendo
// (createRouter returns the bound comprehend(raw)/docs(pkg, query) methods);
// createDocs(corpus, options) answers docs() over one already-loaded packed
// corpus directly; the five consumer config knobs (prefer/pin/disable/
// require/local) come from config.ts. Nothing here re-implements any of it.
//
// Requires packages/core to be built first (`npm run build`, which this
// package's own build script runs): the real published tarball bundles
// packages/core/dist directly rather than depending on a second npm
// package, since @comprehendo/core is a private workspace package, never
// published on its own.
export * from './packages/core/dist/index.js';
