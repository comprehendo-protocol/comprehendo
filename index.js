// The comprehendo npm package's own real public surface: the provider SDK
// built in packages/core, re-exported unchanged. makeProvider() is the
// entry a consumer building native Comprehendo support actually calls; the
// sidecar reading surface (comprehend(raw), docs(pkg, query)) for an
// un-adopted package is Router & Precedence [22], not yet wired to this
// re-export (see the known gap in README.md).
//
// Requires packages/core to be built first (`npm run build`, which this
// package's own build script runs): the real published tarball bundles
// packages/core/dist directly rather than depending on a second npm
// package, since @comprehendo/core is a private workspace package, never
// published on its own.
export * from './packages/core/dist/index.js';
