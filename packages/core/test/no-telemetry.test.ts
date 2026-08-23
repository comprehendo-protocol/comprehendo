/**
 * CC6 No Telemetry [27], the package-wide half: "Zero network imports
 * anywhere in packages/core/, packages/python/, packages/registry-tools/."
 *
 * CC1 [07]'s marker-purity scan (marker-purity.test.ts) is narrower and
 * stricter on purpose, total I/O purity for the marker module's own
 * transitive closure alone, because the probe must do literally nothing.
 * This scan is wider and looser on purpose too: every file under
 * packages/core/src and packages/registry-tools/src, but only the
 * network-capable surface (never fs, which both packages legitimately use
 * throughout to read corpora, config, and manifests). The two scans answer
 * different questions and neither substitutes for the other.
 *
 * `registry-tools` takes no runtime import from core, so its real
 * `NETWORK_MODULES`/`NETWORK_BUILTINS` tables (Submission Gate [29]'s own
 * corpus-content scan, `gate-telemetry.ts`) are loaded the same
 * cross-package dynamic-import way 21's real matcher already is, held to
 * the SAME list this scan runs against, not a second copy that could drift.
 *
 * The Python port's equivalent package-wide scan is not built here: see
 * `.mdd/docs/27-cc6-no-telemetry.md` Known Issues.
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PACKAGE_ROOT, findModuleImports, readSourcesUnder } from './helpers/source-scan.js';

interface TelemetryModule {
  readonly NETWORK_MODULES: readonly string[];
  readonly NETWORK_BUILTINS: readonly string[];
}

const TELEMETRY_SOURCE = join(PACKAGE_ROOT, '..', 'registry-tools', 'src', 'gate-telemetry.ts');

let loading: Promise<TelemetryModule> | undefined;

/** Submission Gate [29]'s real network-surface tables, loaded once. */
async function telemetryModule(): Promise<TelemetryModule> {
  loading ??= import(/* @vite-ignore */ pathToFileURL(TELEMETRY_SOURCE).href) as Promise<unknown> as Promise<TelemetryModule>;
  return loading;
}

const REGISTRY_TOOLS_SRC = join(PACKAGE_ROOT, '..', 'registry-tools', 'src');

describe('CC6: no network-module import anywhere in this package', () => {
  it('finds source files to scan at all (a scan over nothing proves nothing)', () => {
    expect(readSourcesUnder(join(PACKAGE_ROOT, 'src')).length).toBeGreaterThan(20);
    expect(readSourcesUnder(REGISTRY_TOOLS_SRC).length).toBeGreaterThan(5);
  });

  it('imports fs freely: this is a network scan, not an I/O-purity one', () => {
    // The contrast with CC1 stated as a test, not only a comment: fs is not
    // in NETWORK_MODULES, and packages/core/src genuinely does import it
    // (router-discovery.ts, config.ts, docs.ts, the cli/ verbs). A scan that
    // flagged fs would be CC1's job repeated on the wrong surface.
    const files = readSourcesUnder(join(PACKAGE_ROOT, 'src'));
    const usesFs = files.some((file) => /from\s*['"](?:node:)?fs['"]/.test(file.code));

    expect(usesFs).toBe(true);
  });

  it.each(['packages/core/src', 'packages/registry-tools/src'])(
    '%s carries no network-module import, statically or dynamically',
    async (label) => {
      const root = label.endsWith('core/src') ? join(PACKAGE_ROOT, 'src') : REGISTRY_TOOLS_SRC;
      const { NETWORK_MODULES } = await telemetryModule();
      const files = readSourcesUnder(root);

      const violations = files
        .map((file) => ({ path: file.path, hits: findModuleImports(file.code, NETWORK_MODULES) }))
        .filter((entry) => entry.hits.length > 0);

      expect(violations).toEqual([]);
    },
  );

  it.each(['packages/core/src', 'packages/registry-tools/src'])(
    '%s carries no network-exfiltration builtin call',
    async (label) => {
      const root = label.endsWith('core/src') ? join(PACKAGE_ROOT, 'src') : REGISTRY_TOOLS_SRC;
      const { NETWORK_BUILTINS } = await telemetryModule();
      const files = readSourcesUnder(root)
        // gate-telemetry.ts IS the module that declares NETWORK_BUILTINS as
        // data (the literal strings this very scan is built from); checking
        // its own table against itself is not a violation, the same way a
        // dictionary of forbidden words is not itself forbidden.
        .filter((file) => file.path !== 'gate-telemetry.ts');

      const violations = files
        .map((file) => ({
          path: file.path,
          hits: NETWORK_BUILTINS.filter((builtin) => file.code.includes(builtin)),
        }))
        .filter((entry) => entry.hits.length > 0);

      expect(violations).toEqual([]);
    },
  );

  it('has teeth: a planted network import is caught, not silently passed', () => {
    const planted = "import { connect } from 'node:net';\nexport const x = connect;\n";

    expect(findModuleImports(planted, ['net'])).toEqual(['net']);
  });

  it('has teeth: a planted exfiltration call in real code is caught', async () => {
    const { NETWORK_BUILTINS } = await telemetryModule();
    const planted = "export function report() { return fetch('https://example.com/telemetry'); }\n";

    const hits = NETWORK_BUILTINS.filter((builtin) => planted.includes(builtin));

    expect(hits).toContain('fetch(');
  });
});
