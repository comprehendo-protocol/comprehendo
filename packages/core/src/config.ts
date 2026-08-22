/**
 * Manifest Wiring [15]: the provider-side manifest declaration, written into
 * and read back out of the manifest each ecosystem already has (the
 * `comprehendo` key in package.json, `[tool.comprehendo]` in pyproject.toml).
 *
 * Discovery channel two of four, and the only one that answers BEFORE anything
 * is imported: a tool can learn that a package speaks Comprehendo by reading
 * its manifest, no code loaded, no side effect. The marker (Marker & Probe
 * [11]) is the runtime truth, this is the pre-import truth, and it is
 * ADVISORY: when they disagree, {@link resolveDiscovery} resolves in the
 * marker's favor (the disagreement fixture, Conformance Fixtures [04]).
 *
 * Two contracts land here. CC8, no provider veto: the declaration is exactly
 * `{version, level}` ({@link MANIFEST_FIELDS}) and every read PROJECTS to those
 * two fields, so a provider cannot express "do not use a registry corpus for my
 * package", there being no field for it and nothing to carry one through.
 * Structural, not policy, and scanned for directly (test/config-cc8.test.ts);
 * CC8's runtime half is Router & Precedence [22]'s. CC9, frozen literals: the
 * manifest key names have one definition site each, like the marker symbol.
 *
 * @see .mdd/docs/15-manifest-wiring.md
 * @see .mdd/docs/19-cc8-native-precedence.md
 * @see JUDGMENT-15-manifest-wiring.md
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { ComprehendoEntry, ComprehendoLevel, ComprehendoSurface } from './marker.js';
import type { ManifestDeclaration } from './sdk.js';

export type { ManifestDeclaration } from './sdk.js';

/** THE package.json key. Frozen literal, one definition site (CC9 [10]). */
export const MANIFEST_KEY = 'comprehendo';

/** THE pyproject.toml table. Frozen literal, one definition site (CC9 [10]). */
export const PYPROJECT_TABLE = 'tool.comprehendo';

/**
 * Exactly the fields a provider-side declaration carries (manifest.schema.json),
 * and the projection every read applies. A third field is a CC8 [19] decision.
 */
export const MANIFEST_FIELDS = Object.freeze(['version', 'level'] as const);

/**
 * What a manifest read found. Three states, not two: "makes no claim" and
 * "makes a claim I could not read" are different answers, and conflating them
 * turns a broken manifest into a silent "does not speak Comprehendo".
 */
export type ManifestReading =
  | { readonly status: 'absent' }
  | { readonly status: 'declared'; readonly declaration: ManifestDeclaration }
  | { readonly status: 'unreadable'; readonly reason: string };

/** The resolved discovery view: what a tool should believe, and which channel it came from. */
export interface Discovery {
  readonly comprehendo: string;
  readonly level: ComprehendoLevel;
  /** Present only from the marker: static discovery cannot know the surfaces. */
  readonly surfaces?: readonly ComprehendoSurface[];
  readonly source: 'marker' | 'manifest';
}

/** Both discovery channels, either of which may be missing. */
export interface DiscoveryInput {
  readonly marker?: ComprehendoEntry | undefined;
  readonly manifest?: ManifestDeclaration | undefined;
}

/**
 * Raised when a manifest cannot be WRITTEN (a declaration that would not
 * validate, host text that is not the format it claims to be), or when there
 * is no manifest FILE at all (unknown file name, unreadable path). What a
 * manifest SAYS never raises, it is reported (see {@link ManifestReading}).
 */
export class ManifestError extends Error {
  public override readonly name = 'ManifestError';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Why this value is not a declaration (naming the field), or `undefined` when it is one. */
function declarationProblem(value: unknown): string | undefined {
  const bad = (what: string, got: unknown): string =>
    `the "${MANIFEST_KEY}" declaration ${what}, got ${describe(got)}`;
  if (!isRecord(value)) return bad('must be an object', value);
  const version = value['version'];
  const level = value['level'];
  if (typeof version !== 'string' || version.trim() === '') {
    return bad('needs a non-empty string version', version);
  }
  if (level !== 1 && level !== 2) return bad('needs level 1 or 2 as an integer', level);
  return undefined;
}

/** What a value is, for an error message, without printing the value itself. */
function describe(value: unknown): string {
  if (value === undefined || value === null) return String(value);
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
}

/**
 * The projection CC8 rests on: whatever else rode along under the manifest key
 * (RFC 10.6's endorsement keys, the consumer's knobs, a field a provider
 * invented), out comes these two fields and nothing else.
 */
function project(value: Record<string, unknown>): ManifestDeclaration {
  return Object.freeze({
    version: value['version'] as string,
    level: value['level'] as ComprehendoLevel,
  });
}

/** A declaration this component is about to WRITE, refused loudly when malformed. */
function assertDeclaration(declaration: ManifestDeclaration): ManifestDeclaration {
  const problem = declarationProblem(declaration);
  if (problem !== undefined) {
    throw new ManifestError(`comprehendo: refusing to stamp a manifest, ${problem}`);
  }
  return project(declaration as unknown as Record<string, unknown>);
}

/**
 * The declaration a provider stamps, read off the entry its own values carry.
 * Never hand-set: the level is the one the runtime actually reached (SDK Entry
 * [14] computes it), so a manifest can only overclaim by drifting.
 */
export function declarationFor(entry: ComprehendoEntry): ManifestDeclaration {
  return assertDeclaration({ version: entry.comprehendo, level: entry.level });
}

/** Read the value found AT the manifest key (or the pyproject table) as a declaration. */
export function parseDeclaration(value: unknown): ManifestReading {
  if (value === undefined) return { status: 'absent' };
  const problem = declarationProblem(value);
  if (problem !== undefined) return { status: 'unreadable', reason: problem };
  return { status: 'declared', declaration: project(value as Record<string, unknown>) };
}

/** package.json text as the object it must be, or the reason it is not one. */
function hostJson(text: string): Record<string, unknown> | string {
  let host: unknown;
  try {
    host = JSON.parse(text) as unknown;
  } catch (error) {
    return `package.json is not valid JSON: ${(error as Error).message}`;
  }
  return isRecord(host) ? host : `a package.json must be a JSON object, got ${describe(host)}`;
}

/** Read the `comprehendo` key out of package.json text. Never throws. */
export function readPackageJson(text: string): ManifestReading {
  const host = hostJson(text);
  if (typeof host === 'string') return { status: 'unreadable', reason: host };
  if (!(MANIFEST_KEY in host)) return { status: 'absent' };
  return parseDeclaration(host[MANIFEST_KEY]);
}

/**
 * Write the declaration into package.json text, merging into whatever the key
 * already carries rather than replacing it: the consumer's five knobs
 * (config.schema.json) and RFC 10.6's endorsement keys live under this same
 * key, and a stamp that replaced it would delete a consumer's configuration.
 *
 * @returns the new text: same indentation, same trailing newline, same field
 * order, with `version` and `level` set in place.
 */
export function stampPackageJson(text: string, declaration: ManifestDeclaration): string {
  const stamped = assertDeclaration(declaration);
  const host = hostJson(text);
  if (typeof host === 'string') {
    throw new ManifestError(`comprehendo: refusing to stamp a package.json, ${host}`);
  }
  const existing = host[MANIFEST_KEY];
  host[MANIFEST_KEY] = {
    ...(isRecord(existing) ? existing : {}),
    version: stamped.version,
    level: stamped.level,
  };
  const body = JSON.stringify(host, null, indentOf(text));
  return text.endsWith('\n') || text.trim() === '' ? `${body}\n` : body;
}

/** The indentation the file already used, so a stamp is not also a reformat. */
function indentOf(text: string): number | string {
  const found = /\n([ \t]+)"/.exec(text);
  const whitespace = found?.[1];
  if (whitespace === undefined) return 2;
  return whitespace.startsWith('\t') ? '\t' : whitespace.length;
}

/**
 * The pyproject half is deliberately NOT a TOML parser: `[tool.comprehendo]`
 * is one table of two flat scalars, a line-oriented job, and zero runtime
 * dependencies is a hard constraint. What a minimal reader owes its caller is
 * honesty about the spellings it does not handle, so the inline forms
 * (`[tool]` plus `comprehendo = {...}`, and the dotted assignment) come back
 * `unreadable` with the limitation named, never `absent`: "this package does
 * not speak Comprehendo" is the one wrong answer available about one that does.
 *
 * `header` is the header line's index (-1 when there is none), `end` one past
 * the table's last body line, `inline` the reason it could not be read.
 */
interface TomlTable {
  readonly header: number;
  readonly end: number;
  readonly inline?: string;
}

const TABLE_HEADER = new RegExp(`^\\s*\\[${PYPROJECT_TABLE.replace('.', '\\.')}\\]\\s*(#.*)?$`);
// The array-of-tables spelling, [[tool.comprehendo]]: a third valid TOML way
// to occupy this key, alongside the inline-table and dotted-assignment forms
// already refused below. Checked BEFORE the generic ANY_HEADER match, which
// would otherwise capture the inner "[tool.comprehendo" (double brackets
// confuse the single-bracket capture) as garbage and silently ignore it.
const ARRAY_TABLE_HEADER = new RegExp(`^\\s*\\[\\[${PYPROJECT_TABLE.replace('.', '\\.')}\\]\\]\\s*(#.*)?$`);
const ANY_HEADER = /^\s*\[/;

function locateTable(lines: readonly string[]): TomlTable {
  let current = '';
  for (const [index, line] of lines.entries()) {
    if (ARRAY_TABLE_HEADER.test(line)) {
      return {
        header: -1,
        end: -1,
        inline:
          `[${PYPROJECT_TABLE}] is written as an array of tables ([[...]]) at line ${String(index + 1)}; ` +
          'this build reads and writes only the single-table-header form',
      };
    }
    if (TABLE_HEADER.test(line)) {
      let end = index + 1;
      while (end < lines.length && !ANY_HEADER.test(lines[end] ?? '')) end += 1;
      return { header: index, end };
    }
    const header = /^\s*\[([^\]]+)\]/.exec(line);
    if (header !== null) {
      current = (header[1] ?? '').trim();
      continue;
    }
    const key = /^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line);
    const name = key?.[1] ?? '';
    if (name === PYPROJECT_TABLE || (current === 'tool' && name === MANIFEST_KEY)) {
      return {
        header: -1,
        end: -1,
        inline: `[${PYPROJECT_TABLE}] is written as an inline table at line ${String(index + 1)}; ` +
          'this build reads and writes only the table-header form',
      };
    }
  }
  return { header: -1, end: -1 };
}

/** A TOML line's value, with any trailing comment (outside quotes) removed. */
function tomlValue(line: string): string {
  const equals = line.indexOf('=');
  if (equals === -1) return '';
  let quote = '';
  let end = line.length;
  for (let i = equals + 1; i < line.length; i += 1) {
    const char = line[i] ?? '';
    if (quote !== '') {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '#') {
      end = i;
      break;
    }
  }
  return line.slice(equals + 1, end).trim();
}

const tomlKey = (line: string): string => (/^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line)?.[1] ?? '');

/** Basic strings and integers, the only two value kinds this table can hold. */
function tomlScalar(raw: string): string | number | undefined {
  if (raw.length >= 2 && (raw.startsWith('"') || raw.startsWith("'")) && raw.endsWith(raw[0] ?? '')) {
    return raw.slice(1, -1);
  }
  return /^[+-]?\d+$/.test(raw) ? Number(raw) : undefined;
}

/** Read `[tool.comprehendo]` out of pyproject.toml text. Never throws. */
export function readPyproject(text: string): ManifestReading {
  const lines = text.split(/\r?\n/);
  const table = locateTable(lines);
  if (table.inline !== undefined) return { status: 'unreadable', reason: table.inline };
  if (table.header === -1) return { status: 'absent' };
  const found: Record<string, unknown> = {};
  for (const line of lines.slice(table.header + 1, table.end)) {
    const key = tomlKey(line);
    if (key === '') continue;
    const value = tomlScalar(tomlValue(line));
    if (value !== undefined) found[key] = value;
  }
  return parseDeclaration(found);
}

/**
 * Write the declaration into pyproject.toml text: the table's own `version`
 * and `level` lines are edited in place, everything else (other tables, other
 * keys, comments, spacing) preserved character for character.
 */
export function stampPyproject(text: string, declaration: ManifestDeclaration): string {
  const stamped = assertDeclaration(declaration);
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const table = locateTable(lines);
  if (table.inline !== undefined) {
    throw new ManifestError(
      `comprehendo: refusing to stamp this pyproject.toml, ${table.inline}. ` +
        'Rewrite it as a table header, or set the two fields by hand.',
    );
  }
  const written: Record<string, string> = {
    version: `version = ${JSON.stringify(stamped.version)}`,
    level: `level = ${String(stamped.level)}`,
  };
  if (table.header === -1) {
    const head = text.replace(/\s*$/, '');
    const added = [`[${PYPROJECT_TABLE}]`, written['version'], written['level'], ''].join(newline);
    return head === '' ? added : `${head}${newline}${newline}${added}`;
  }
  const body = lines.slice(table.header + 1, table.end);
  const missing = Object.keys(written).filter((key) => !body.some((line) => tomlKey(line) === key));
  const edited = body.map((line) => written[tomlKey(line)] ?? line);
  let insertAt = edited.length;
  while (insertAt > 0 && (edited[insertAt - 1] ?? '').trim() === '') insertAt -= 1;
  edited.splice(insertAt, 0, ...missing.map((key) => written[key] ?? ''));
  return [...lines.slice(0, table.header + 1), ...edited, ...lines.slice(table.end)].join(newline);
}

/** The two manifests a provider-side declaration can live in, by file name. */
const FORMATS = {
  'package.json': { read: readPackageJson, stamp: stampPackageJson },
  'pyproject.toml': { read: readPyproject, stamp: stampPyproject },
} as const;

function formatFor(path: string): (typeof FORMATS)[keyof typeof FORMATS] {
  const name = basename(path);
  if (!Object.hasOwn(FORMATS, name)) {
    throw new ManifestError(
      `comprehendo: ${name} is not a manifest this build reads or writes ` +
        `(package.json or pyproject.toml, at ${path})`,
    );
  }
  return FORMATS[name as keyof typeof FORMATS];
}

function readHost(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new ManifestError(`comprehendo: cannot read ${path}: ${(error as Error).message}`);
  }
}

/**
 * Read the declaration out of a real manifest on disk. What the manifest SAYS
 * never throws (an unreadable claim is reported); the absence of a readable
 * FILE does, because there is nothing to report about.
 */
export function readManifestFile(path: string): ManifestReading {
  return formatFor(path).read(readHost(path));
}

/**
 * Stamp the declaration into a real manifest on disk.
 *
 * @returns true when the file was written. A manifest already carrying this
 * exact declaration is left untouched, byte for byte, so re-stamping is a
 * no-op rather than a reformat and this is safe to run on every build.
 */
export function stampManifestFile(path: string, declaration: ManifestDeclaration): boolean {
  const format = formatFor(path);
  const stamped = assertDeclaration(declaration);
  const text = readHost(path);
  const current = format.read(text);
  const unchanged =
    current.status === 'declared' &&
    current.declaration.version === stamped.version &&
    current.declaration.level === stamped.level;
  if (unchanged) return false;
  writeFileSync(path, format.stamp(text, stamped), 'utf8');
  return true;
}

/**
 * The rule this whole component is subordinate to: the marker is
 * authoritative, the manifest advisory. When both channels answer, the
 * marker's claim is the resolved one and the manifest's is discarded EVEN
 * WHERE THEY AGREE, so nothing here depends on them happening to match (the
 * disagreement fixture, Conformance Fixtures [04]). A manifest-only answer
 * carries no `surfaces` at all: static discovery cannot know which exist, and
 * an empty list would be a claim that none do.
 */
export function resolveDiscovery(input: DiscoveryInput): Discovery | undefined {
  const { marker, manifest } = input;
  if (marker !== undefined) {
    const { comprehendo, level, surfaces } = marker;
    return Object.freeze({ comprehendo, level, surfaces, source: 'marker' as const });
  }
  if (manifest !== undefined) {
    return Object.freeze({
      comprehendo: manifest.version,
      level: manifest.level,
      source: 'manifest' as const,
    });
  }
  return undefined;
}
