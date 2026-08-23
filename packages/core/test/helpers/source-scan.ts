/**
 * Source-scanning helpers for the two cross-cutting contracts this package's
 * marker module is held to.
 *
 * CC1 (07-cc1-probe-purity): core imports none of fs, net, http, dns,
 * child_process, so the probe path cannot do I/O even transitively.
 * CC9 (10-cc9-marker-freeze): `Symbol.for('comprehendo')` appears as a frozen
 * literal exactly once in the package, never computed, never aliased.
 *
 * These live in the test tree on purpose: the scan needs `node:fs`, and a
 * module under `src/` that imports it would itself break CC1.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Absolute path of the package root (`packages/core`). */
export const PACKAGE_ROOT = join(import.meta.dirname, '..', '..');

/** Absolute path of the package's source tree. */
export const SRC_ROOT = join(PACKAGE_ROOT, 'src');

/** Absolute path of the conformance kit shipped by `@comprehendo/spec`. */
export const KIT_ROOT = join(PACKAGE_ROOT, '..', 'spec', 'kit');

export interface SourceFile {
  /** Path relative to `src/`, POSIX-separated, e.g. `marker.ts`. */
  readonly path: string;
  /** The file's full text, comments included. */
  readonly text: string;
  /** The file's text with every comment blanked out, offsets preserved. */
  readonly code: string;
}

/**
 * The transitive import closure reachable from `entryPath` (relative to
 * `src/`, e.g. `marker.ts`), following only relative specifiers
 * (`./foo.js`, `../bar.js`). This is CC1's actual scope, per the doc's
 * Architecture section: "the scan runs over marker.ts (and any module it
 * imports)", not indiscriminately every file the package happens to
 * contain. A file unrelated to the probe path (docs.ts loading a packed
 * corpus, for instance) is explicitly out of scope, the doc says so:
 * "loading a packed corpus is a Docs Engine [13] concern, not the marker
 * probe's".
 */
export function transitiveImportClosure(entryPath: string): SourceFile[] {
  const all = new Map(readCoreSources().map((source) => [source.path, source]));
  const visited = new Set<string>();
  const queue = [entryPath];

  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined || visited.has(path)) continue;
    visited.add(path);
    const source = all.get(path);
    if (source === undefined) continue;

    for (const match of source.code.matchAll(/from\s*['"](\.[^'"]+)['"]/g)) {
      const specifier = match[1] ?? '';
      if (!specifier.startsWith('.')) continue;
      // Import specifiers are ESM-style ('./foo.js'); source files are .ts.
      const resolved = specifier.replace(/\.js$/, '.ts').replace(/^\.\//, '');
      if (!visited.has(resolved)) queue.push(resolved);
    }
  }

  return [...visited]
    .map((path) => all.get(path))
    .filter((source): source is SourceFile => source !== undefined)
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Every `.ts` file under `src/`, recursively, sorted by path. */
export function readCoreSources(): SourceFile[] {
  return readSourcesUnder(SRC_ROOT);
}

/**
 * Every `.ts` file under an arbitrary source root, recursively, sorted by
 * path. `readCoreSources` is this applied to `SRC_ROOT`; CC6 [27]'s
 * package-wide network scan applies it to a sibling package's `src/` too,
 * which core cannot import (one-way dependency) but can still read as files.
 */
export function readSourcesUnder(root: string): SourceFile[] {
  return walk(root)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      return {
        path: relative(root, file).split(sep).join('/'),
        text,
        code: blankComments(text),
      };
    });
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      found.push(...walk(full));
    } else if (item.isFile()) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Replace every line and block comment with spaces, preserving length and line
 * breaks so reported offsets and line numbers still line up. String and
 * template literals are left intact, because the marker scan has to read the
 * argument of a `Symbol.for(...)` call.
 *
 * Known limitation of a lexer this small: a regex literal containing a quote
 * character (`/don't/`) would confuse the string state. Core carries no such
 * literal, and the scan is a grep-level lint, not a parser.
 */
export function blankComments(source: string): string {
  const out = source.split('');
  let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' = 'code';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line';
      } else if (char === '/' && next === '*') {
        state = 'block';
      } else if (char === "'") {
        state = 'single';
      } else if (char === '"') {
        state = 'double';
      } else if (char === '`') {
        state = 'template';
      }
      if (state === 'line' || state === 'block') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
      }
      continue;
    }
    if (state === 'line') {
      if (char === '\n') {
        state = 'code';
      } else {
        out[i] = ' ';
      }
      continue;
    }
    if (state === 'block') {
      if (char === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
        state = 'code';
      } else if (char !== '\n') {
        out[i] = ' ';
      }
      continue;
    }
    // Inside a string or template literal: skip escapes, watch for the closer.
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (
      (state === 'single' && char === "'") ||
      (state === 'double' && char === '"') ||
      (state === 'template' && char === '`')
    ) {
      state = 'code';
    }
  }
  return out.join('');
}

export interface MarkerCall {
  /** The call exactly as written, e.g. `Symbol.for('comprehendo')`. */
  readonly raw: string;
  /** The call's argument text, untrimmed of nothing but surrounding spaces. */
  readonly argument: string;
  /** True only when the argument is the bare string literal `comprehendo`. */
  readonly frozenLiteral: boolean;
  /** True when the argument names the marker but assembles it at run time. */
  readonly computed: boolean;
}

const MARKER_KEY = 'comprehendo';

/**
 * Find every `Symbol.for(...)` call in a piece of JavaScript or TypeScript
 * source. This is CC9's grep-level lint: one definition site, a frozen
 * literal, nothing assembled at run time.
 */
export function findMarkerCalls(source: string): MarkerCall[] {
  const code = blankComments(source);
  const calls: MarkerCall[] = [];
  const opener = /Symbol\s*\.\s*for\s*\(/g;
  let match: RegExpExecArray | null = opener.exec(code);
  while (match !== null) {
    const argStart = match.index + match[0].length;
    const argEnd = findClosingParen(code, argStart);
    if (argEnd === -1) {
      break;
    }
    const argument = code.slice(argStart, argEnd).trim();
    const frozenLiteral = argument === `'${MARKER_KEY}'` || argument === `"${MARKER_KEY}"`;
    calls.push({
      raw: code.slice(match.index, argEnd + 1),
      argument,
      frozenLiteral,
      computed: !frozenLiteral && !isPlainStringLiteral(argument),
    });
    opener.lastIndex = argEnd + 1;
    match = opener.exec(code);
  }
  return calls;
}

function isPlainStringLiteral(argument: string): boolean {
  return /^'[^']*'$/.test(argument) || /^"[^"]*"$/.test(argument);
}

function findClosingParen(code: string, from: number): number {
  let depth = 1;
  for (let i = from; i < code.length; i += 1) {
    const char = code[i];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * CC1's forbidden modules, exactly the five the contract names. Anything
 * beyond them (tls, https, worker_threads) is a CC6 concern, not this scan's.
 */
export const FORBIDDEN_MODULES = ['fs', 'net', 'http', 'dns', 'child_process'] as const;

/** Every forbidden module a source file imports, statically or dynamically. */
export function findForbiddenImports(source: string): string[] {
  return findModuleImports(source, FORBIDDEN_MODULES);
}

/**
 * Every module named in `modules` that a source file imports, statically or
 * dynamically. `findForbiddenImports` is this applied to CC1's fixed five;
 * CC6 [27]'s package-wide scan applies it to the wider network-module list
 * instead.
 */
export function findModuleImports(source: string, modules: readonly string[]): string[] {
  const code = blankComments(source);
  const found = new Set<string>();
  for (const name of modules) {
    const specifier = `(?:node:)?${name}(?:/[\\w./-]+)?`;
    const patterns = [
      new RegExp(`from\\s*['"]${specifier}['"]`),
      new RegExp(`import\\s*\\(\\s*['"]${specifier}['"]`),
      new RegExp(`require\\s*\\(\\s*['"]${specifier}['"]`),
      new RegExp(`import\\s*['"]${specifier}['"]`),
    ];
    if (patterns.some((pattern) => pattern.test(code))) {
      found.add(name);
    }
  }
  return [...found];
}

/** Read a JSON file from the conformance kit as `unknown`. */
export function readKitJson(...segments: string[]): unknown {
  return JSON.parse(readFileSync(join(KIT_ROOT, ...segments), 'utf8')) as unknown;
}

/** Read a nested property off an `unknown` value without asserting a shape. */
export function at(value: unknown, ...path: string[]): unknown {
  let cursor = value;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

/** Read a nested property that must be a string, failing loudly when it is not. */
export function stringAt(value: unknown, ...path: string[]): string {
  const found = at(value, ...path);
  if (typeof found !== 'string') {
    throw new TypeError(`expected a string at ${path.join('.')}, got ${typeof found}`);
  }
  return found;
}
