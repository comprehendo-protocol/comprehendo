// tailwindcss Corpus: the inducing calls for every cataloged entry, both
// kinds, the same shape `zod-witnesses.ts` established (this corpus's own
// structural template). tailwindcss is a real, direct devDependency of
// this package: `TAILWIND_POSTCSS_PLUGIN_MOVED` is a real, synchronous
// throw, no process to spawn; the two `static-pattern` twins have no throw
// to catch by definition, so their evidence is a real, live-verified build
// outcome instead, checked with the real, installed CLI, never invented.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/** Where a scratch build actually runs: this package's own tree, so its real, installed tailwindcss/postcss resolve. */
const RESOLUTION_ROOT = join(import.meta.dirname, '..', '..');

/** The real, installed tailwindcss's own reported version. Never assumed. */
export function tailwindVersion(): string {
  const pkg = require('tailwindcss/package.json') as { readonly version: string };
  return pkg.version;
}

// --- runtime-error twins: a real call, a real catch ------------------------

export interface RuntimeWitness {
  readonly code: string;
  readonly provoke: () => unknown;
}

export const RUNTIME_WITNESSES: readonly RuntimeWitness[] = Object.freeze([
  {
    // v3's PostCSS integration was the `tailwindcss` package itself, handed
    // to postcss([...]) directly. v4's default export is no longer a valid
    // PostCSS plugin at all, and calling it the way postcss internally
    // would (as a bare function) throws synchronously, before any CSS is
    // touched, real and confirmed live.
    code: 'TAILWIND_POSTCSS_PLUGIN_MOVED',
    provoke: (): void => {
      const plugin = require('tailwindcss') as (...args: readonly unknown[]) => unknown;
      plugin();
    },
  },
]);

/** One real call, really caught. Throws if the call did NOT throw. */
export function induceRuntime(witness: RuntimeWitness): { readonly errorClass: string; readonly text: string } {
  try {
    witness.provoke();
  } catch (error) {
    const err = error as Error;
    return { errorClass: err.constructor.name, text: err.message };
  }
  throw new Error(`${witness.code}'s witness did not throw against the real, installed tailwindcss`);
}

// --- static-pattern twins: no throw to catch, a real build outcome instead -

export interface StaticWitness {
  readonly code: string;
  /** A realistic source snippet the cataloged pattern is written to catch. */
  readonly positiveSample: string;
  /** A structurally-similar snippet that must NOT match (the precision test). */
  readonly nearMiss: string;
  /** Proves the real claim behind the pattern, live, right now. Throws if false. */
  readonly verifyClaim: () => void;
}

const CLI_BIN = join(RESOLUTION_ROOT, 'node_modules', '.bin', 'tailwindcss');

/** One real CLI build, in a fresh, disposable workspace. Returns the real generated CSS. */
function realBuild(files: Readonly<Record<string, string>>): string {
  const site = mkdtempSync(join(RESOLUTION_ROOT, '.tailwind-static-scratch-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(site, name), content, 'utf8');
    }
    execFileSync(CLI_BIN, ['-i', 'input.css', '-o', 'output.css'], { cwd: site, encoding: 'utf8' });
    return require('node:fs').readFileSync(join(site, 'output.css'), 'utf8') as string;
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
}

export const STATIC_WITNESSES: readonly StaticWitness[] = Object.freeze([
  {
    code: 'TAILWIND_V3_DIRECTIVES_SILENT_NOOP',
    positiveSample: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
    nearMiss: '@import "tailwindcss";\n',
    // Real, live claim: the old three-directive entry point builds clean
    // (exit 0, no warning) and produces an effectively empty stylesheet,
    // real markup using a real utility class produces zero occurrences of
    // that class in the real output. The v4-native form, identical markup,
    // produces the real class.
    verifyClaim: (): void => {
      const markup = '<div class="bg-red-500">x</div>';
      const oldCss = realBuild({
        'input.css': '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n',
        'markup.html': markup,
      });
      if (oldCss.includes('bg-red-500')) {
        throw new Error(
          `expected the v3 directives to silently produce nothing against this real tailwindcss; bg-red-500 was present:\n${oldCss}`,
        );
      }
      const newCss = realBuild({
        'input.css': '@import "tailwindcss";\n',
        'markup.html': markup,
      });
      if (!newCss.includes('bg-red-500')) {
        throw new Error(
          `expected @import "tailwindcss"; to produce the real utility class against this real tailwindcss; it did not:\n${newCss}`,
        );
      }
    },
  },
  {
    code: 'TAILWIND_CONFIG_JS_NOT_AUTO_LOADED',
    positiveSample:
      "module.exports = {\n  content: ['./src/**/*.html'],\n  theme: {\n    extend: {\n      colors: { brand: '#123456' },\n    },\n  },\n};\n",
    nearMiss: '@theme {\n  --color-brand: #123456;\n}\n',
    // Real, live claim: a v3-style config declaring a custom color produces
    // zero occurrences of that color with no @config directive present, and
    // the identical config produces the real color once @config is added.
    verifyClaim: (): void => {
      const configJs =
        "module.exports = {\n  content: ['./markup.html'],\n  theme: {\n    extend: {\n      colors: { brand: '#123456' },\n    },\n  },\n};\n";
      const markup = '<div class="bg-brand">x</div>';
      const withoutConfig = realBuild({
        'input.css': '@import "tailwindcss";\n',
        'tailwind.config.js': configJs,
        'markup.html': markup,
      });
      if (withoutConfig.includes('123456')) {
        throw new Error(
          `expected a config file with no @config directive to be silently ignored against this real tailwindcss; the custom color was present:\n${withoutConfig}`,
        );
      }
      const withConfig = realBuild({
        'input.css': '@import "tailwindcss";\n@config "./tailwind.config.js";\n',
        'tailwind.config.js': configJs,
        'markup.html': markup,
      });
      if (!withConfig.includes('123456')) {
        throw new Error(
          `expected @config "./tailwind.config.js"; to load the real custom color against this real tailwindcss; it did not:\n${withConfig}`,
        );
      }
    },
  },
]);
