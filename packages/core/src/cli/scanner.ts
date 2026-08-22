// Corpus Generator [17]: what a machine can know about a target package.
//
// Exported declarations and their signatures, the docstring written directly
// above each one, and every `throw new X(...)` site with its exception type and
// message. That is the whole machine-derivable set; everything else a corpus
// needs (why a failure happens, what fixes it, how to say it in another tool's
// vocabulary) is a human's to write, and this module never guesses at it.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { CliError } from './errors.js';
import type { SymbolKind } from './format.js';
import { blankComments, firstStringArgument, lineAt, oneLine, scanTo } from './lexer.js';

export interface ExportedSymbol {
  readonly name: string;
  readonly kind: SymbolKind;
  readonly signature: string;
  /** The JSDoc block written immediately above the declaration, or ''. */
  readonly docstring: string;
  readonly file: string;
  readonly line: number;
}

export interface ThrowSite {
  /** Stable identity across versions. Line numbers are excluded on purpose. */
  readonly id: string;
  readonly exception: string;
  readonly message_pattern: string;
  readonly raised_by: string;
  readonly file: string;
  readonly line: number;
}

export interface TargetScan {
  readonly package: string;
  readonly version: string;
  readonly source: string;
  readonly exports: readonly ExportedSymbol[];
  readonly throws: readonly ThrowSite[];
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'coverage', 'comprehendo']);
const SKIP_FILES = /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/;

const EXPORTED = new RegExp(
  ['export\\s+(?:declare\\s+)?(?:async\\s+)?(?:abstract\\s+)?',
    '(function|class|interface|type|const|let|var|enum)\\s+\\*?\\s*([A-Za-z_$][\\w$]*)'].join(''),
  'g',
);
const THROW_SITE = /throw\s+new\s+([A-Za-z_$][\w$]*)\s*\(/g;

const KINDS: Readonly<Record<string, SymbolKind>> = {
  function: 'function', class: 'class', interface: 'interface',
  type: 'type', const: 'const', let: 'const', var: 'const', enum: 'enum',
};

/** Every source file under `root`, depth first, sorted, POSIX-relative paths. */
function sourceFiles(root: string, base: string): string[] {
  const found: string[] = [];
  for (const item of readdirSync(root, { withFileTypes: true })) {
    if (item.name.startsWith('.') || SKIP_DIRECTORIES.has(item.name)) continue;
    const full = join(root, item.name);
    if (item.isDirectory()) {
      found.push(...sourceFiles(full, base));
      continue;
    }
    if (!SOURCE_EXTENSIONS.some((extension) => item.name.endsWith(extension))) continue;
    if (SKIP_FILES.test(item.name)) continue;
    found.push(relative(base, full).split(sep).join('/'));
  }
  return found.sort();
}

/** The JSDoc block ending immediately above `offset`, stripped of its markers. */
function docstringAbove(raw: string, offset: number): string {
  const before = raw.slice(0, offset);
  if (!/\*\/\s*$/.test(before)) return '';
  const opened = before.lastIndexOf('/**');
  if (opened === -1) return '';
  return before
    .slice(opened + 3, before.lastIndexOf('*/'))
    .split('\n')
    .map((line) => line.replace(/^\s*\*/, '').trim())
    .join('\n')
    .trim();
}

/** Where a declaration's header ends: the body brace, the initializer, the `;`. */
function headerEnd(code: string, from: number, kind: SymbolKind): number {
  if (kind === 'type') {
    const semicolon = scanTo(code, from, [';']);
    const newline = scanTo(code, from, ['\n']);
    return semicolon === -1 ? (newline === -1 ? code.length : newline) : semicolon;
  }
  if (kind !== 'const') {
    const brace = scanTo(code, from, ['{', ';']);
    return brace === -1 ? code.length : brace;
  }
  const assign = scanTo(code, from, ['=', ';']);
  if (assign === -1) return code.length;
  if (code[assign] !== '=' || code.slice(from, assign).includes(':')) return assign;
  // An un-annotated arrow function keeps its parameter list: that IS the signature.
  const rest = code.slice(assign + 1).trimStart();
  if (!rest.startsWith('(') && !rest.startsWith('async') && !rest.startsWith('<')) return assign;
  const arrow = scanTo(code, assign + 1, ['=>']);
  return arrow === -1 ? assign : arrow;
}

function readExports(file: string, raw: string, code: string): ExportedSymbol[] {
  const symbols: ExportedSymbol[] = [];
  for (const match of code.matchAll(EXPORTED)) {
    const kind = KINDS[match[1] ?? ''] ?? 'const';
    const name = match[2] ?? '';
    const start = match.index;
    const end = headerEnd(code, start + match[0].length, kind);
    const signature = oneLine(code.slice(start, end)).replace(/^export\s+/, '').replace(/\s*=$/, '');
    symbols.push({
      name,
      kind,
      signature,
      docstring: docstringAbove(raw, start),
      file,
      line: lineAt(raw, start),
    });
  }
  return symbols;
}

const slug = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

function readThrows(file: string, raw: string, code: string, exports: readonly ExportedSymbol[]): ThrowSite[] {
  const sites: ThrowSite[] = [];
  for (const match of code.matchAll(THROW_SITE)) {
    const exception = match[1] ?? 'Error';
    const start = match.index;
    const line = lineAt(raw, start);
    const enclosing = [...exports].reverse().find((symbol) => symbol.line <= line);
    const raised_by = enclosing?.name ?? '';
    const message = firstStringArgument(code, start + match[0].length - 1);
    sites.push({
      id: `${file}#${raised_by === '' ? 'module' : raised_by}#${exception}#${slug(message)}`,
      exception,
      message_pattern: message,
      raised_by,
      file,
      line,
    });
  }
  return sites;
}

interface TargetManifest {
  readonly name?: unknown;
  readonly version?: unknown;
}

/** Reads the target's own manifest. A package with none is not a target. */
export function readTargetManifest(targetRoot: string): { name: string; version: string } {
  const manifestPath = join(targetRoot, 'package.json');
  if (!existsSync(manifestPath)) {
    throw new CliError(`no package.json in ${targetRoot}: point comprehendo at a package root`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as TargetManifest;
  const name = typeof manifest.name === 'string' ? manifest.name : '';
  if (name === '') {
    throw new CliError(`${manifestPath} declares no package name`);
  }
  return { name, version: typeof manifest.version === 'string' ? manifest.version : '0.0.0' };
}

/** `src/` when the target has one, the package root otherwise. */
export const chooseSourceDir = (targetRoot: string, override?: string): string =>
  override ?? (existsSync(join(targetRoot, 'src')) ? 'src' : '.');

/**
 * Walk a target package and return everything a machine can know about it. The
 * same code path serves a published dependency and a `local` corpus for an
 * internal package: a target is a directory with a package.json, nothing more.
 */
export function scanTarget(targetRoot: string, sourceDir?: string): TargetScan {
  const manifest = readTargetManifest(targetRoot);
  const chosen = chooseSourceDir(targetRoot, sourceDir);
  const sourceRoot = join(targetRoot, chosen);
  if (!existsSync(sourceRoot) || !statSync(sourceRoot).isDirectory()) {
    throw new CliError(`no source directory at ${sourceRoot}`);
  }
  const exports: ExportedSymbol[] = [];
  const throws: ThrowSite[] = [];
  for (const file of sourceFiles(sourceRoot, targetRoot)) {
    const raw = readFileSync(join(targetRoot, file), 'utf8');
    const code = blankComments(raw);
    const fileExports = readExports(file, raw, code);
    exports.push(...fileExports);
    throws.push(...readThrows(file, raw, code, fileExports));
  }
  return {
    package: manifest.name,
    version: manifest.version,
    source: chosen,
    exports,
    throws,
  };
}
