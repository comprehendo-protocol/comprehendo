// CC11 Registry Truth [25], the executable half: `verifyAgainstUpstream`.
//
// A corpus is a set of falsifiable claims about a real package, and this is
// where they are falsified. The gate loads the package CI really installed,
// really calls it until it really throws, and matches the thrown error through
// Fingerprint Index & Matcher [21]'s REAL matcher. A fingerprint the real
// package cannot be induced to produce is rejected by name, so routing cannot
// be hijacked by claiming another package's error patterns, and a fix is
// proved by applying it and retrying rather than by the author saying so.
//
// WHAT THIS FUNCTION DOES NOT DO, DELIBERATELY: it does not install anything.
// CC6 [27] says registry-tools contains no network code and no child_process,
// and `npm install` is both. The install is the CI job's own step (it is a
// workflow line, in the registry repo), and what arrives here is `installRoot`,
// a real node_modules tree with the real package unpacked in it. That split is
// what lets this component stay network-free while still being the thing that
// verifies against reality.
//
// THE WITNESS, and the gap it names. Nothing in the authoring corpus format
// carries "here is the call that provokes this failure": a fix's `apply` is the
// call that AVOIDS it, and the inverse is not derivable. So the inducing calls
// arrive as `witnesses`, supplied by the PR alongside the corpus, and the gate
// trusts none of them: a witness is a claim that gets run, and a claim that
// does not reproduce is a failure with a name (see the feature doc's Known
// Issues, which records the format slot this owes).
//
// TYPOSQUAT PROTECTION IS STRUCTURAL, per 25: the directory name must
// exact-match a package that really resolves in the install root AND that
// really declares that name. Resembling a real package is not matching one.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CorpusSource } from './corpus-source.js';
import { buildFingerprintIndex } from './fingerprint.js';
import { fingerprintsOf } from './gate-fingerprint.js';
import { fixKey, induce, messageOf, proveFix } from './gate-induce.js';
import type { InductionWitness, ModuleLoader, Router, TruthFailure } from './gate-induce.js';

export { fixKey, readCalls } from './gate-induce.js';
export type {
  Call,
  InductionWitness,
  ModuleLoader,
  TruthFailure,
  TruthFailureKind,
} from './gate-induce.js';

export interface UpstreamOptions {
  readonly corpus: CorpusSource;
  readonly directory: string;
  /** Where CI really installed the target package (a real node_modules root). */
  readonly installRoot: string;
  readonly witnesses: readonly InductionWitness[];
  readonly load?: ModuleLoader;
}

export interface UpstreamVerification {
  readonly directory: string;
  readonly package: string;
  readonly resolved?: { readonly name: string; readonly version: string };
  /** Twin codes a real thrown error really matched, this run. */
  readonly inducedCodes: readonly string[];
  /** `code :: fix title` for every fix whose apply really resolved the failure. */
  readonly verifiedFixes: readonly string[];
  readonly failures: readonly TruthFailure[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function pickExport(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return undefined;
  for (const key of ['import', 'module', 'node', 'default']) {
    const found = value[key];
    if (typeof found === 'string') return found;
  }
  return undefined;
}

/** The entry file of an installed package, without guessing past what it says. */
function entryOf(home: string, manifest: Record<string, unknown>): string {
  const exported = manifest['exports'];
  const candidate =
    typeof exported === 'string'
      ? exported
      : isRecord(exported)
        ? pickExport(exported['.'] ?? exported)
        : undefined;
  const main = typeof manifest['main'] === 'string' ? manifest['main'] : undefined;
  return join(home, candidate ?? main ?? 'index.js');
}

/** The real loader: the installed module, imported by file URL. Nothing else. */
const importModule: ModuleLoader = async (entryPath: string) =>
  (await import(/* @vite-ignore */ pathToFileURL(entryPath).href)) as Record<string, unknown>;

interface Resolved {
  readonly home: string;
  readonly manifest: Record<string, unknown>;
  readonly name: string;
  readonly version: string;
}

/** Which installed package this directory names, or why it names none. */
function resolveInstalled(
  installRoot: string,
  directory: string,
): Resolved | TruthFailure {
  const home = join(installRoot, 'node_modules', ...directory.split('/'));
  const manifestPath = join(home, 'package.json');
  if (!existsSync(manifestPath)) {
    return {
      kind: 'no-such-package',
      at: directory,
      detail: `no package named "${directory}" is installed at ${installRoot}; a corpus directory must exact-match a package that really exists on the target registry`,
    };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  const declared = (key: string): string => {
    const value = manifest[key];
    return typeof value === 'string' ? value : '';
  };
  const name = declared('name');
  if (name !== directory) {
    return {
      kind: 'directory-mismatch',
      at: directory,
      detail: `the package installed at ${directory} declares itself "${name}"; a corpus directory names the package it is a corpus FOR, exactly`,
    };
  }
  return { home, manifest, name, version: declared('version') };
}

/** The corpus's own compiled index, as the router the induction matches through. */
function routerFor(corpus: CorpusSource): Router | TruthFailure {
  try {
    const index = buildFingerprintIndex(fingerprintsOf(corpus));
    return (raw: unknown) => {
      const result = index.match(raw);
      return {
        outcome: result.outcome,
        ...(result.outcome === 'matched' ? { id: result.entry.corpusEntryId } : {}),
        candidates: result.candidates.map((candidate) => candidate.corpusEntryId),
      };
    };
  } catch (error) {
    return {
      kind: 'unrunnable-witness',
      at: 'fingerprints',
      detail: `this corpus's own fingerprint index does not build, so no failure it induces can be routed: ${messageOf(error)}`,
    };
  }
}

const isFailure = (value: unknown): value is TruthFailure =>
  isRecord(value) && typeof value['kind'] === 'string' && typeof value['detail'] === 'string';

/** Every witness, run in order, with each induced twin's fixes proved after it. */
async function runWitnesses(
  options: UpstreamOptions,
  module: Record<string, unknown>,
  match: Router,
  induced: string[],
  verified: string[],
  failures: TruthFailure[],
): Promise<void> {
  const { corpus } = options;
  for (const witness of options.witnesses) {
    const twin = corpus.twins.find((entry) => entry.code === witness.code);
    if (twin === undefined) {
      failures.push({
        kind: 'unrunnable-witness',
        at: witness.code,
        detail: `the witness names ${witness.code}, which this corpus does not catalog`,
      });
      continue;
    }
    const outcome = await induce(witness, twin.code, module, match);
    if (outcome.failure !== undefined) failures.push(outcome.failure);
    if (outcome.induced === undefined) continue;
    induced.push(outcome.induced);
    for (const fix of corpus.fixes[twin.id] ?? []) {
      if (fix.apply === undefined) continue;
      const failure = await proveFix({ title: fix.title, apply: fix.apply }, twin.code, module);
      if (failure === undefined) verified.push(fixKey(twin.code, fix.title));
      else failures.push(failure);
    }
  }
}

/** The result value, frozen, however far the verification got. */
const verification = (
  directory: string,
  target: string,
  resolved: { readonly name: string; readonly version: string } | undefined,
  inducedCodes: readonly string[],
  verifiedFixes: readonly string[],
  failures: readonly TruthFailure[],
): UpstreamVerification =>
  Object.freeze({
    directory,
    package: target,
    ...(resolved === undefined ? {} : { resolved: Object.freeze({ ...resolved }) }),
    inducedCodes: Object.freeze([...inducedCodes]),
    verifiedFixes: Object.freeze([...verifiedFixes]),
    failures: Object.freeze([...failures]),
  });

/**
 * Verify a corpus against the package CI really installed.
 *
 * Mandatory before any consumer treats a corpus as publishable (this feature's
 * `integration_contracts`): Scoped Publisher [31] may not pack what nobody
 * checked against reality. Every claim it cannot confirm comes back as a named
 * failure, never as a silent omission.
 */
export async function verifyAgainstUpstream(
  options: UpstreamOptions,
): Promise<UpstreamVerification> {
  const { corpus, directory, installRoot } = options;
  const failures: TruthFailure[] = [];
  const inducedCodes: string[] = [];
  const verifiedFixes: string[] = [];
  const done = (resolved?: { name: string; version: string }): UpstreamVerification =>
    verification(directory, corpus.package, resolved, inducedCodes, verifiedFixes, failures);

  const target = resolveInstalled(installRoot, directory);
  if (isFailure(target)) {
    failures.push(target);
    return done();
  }
  const resolved = { name: target.name, version: target.version };
  if (corpus.package !== directory) {
    failures.push({
      kind: 'directory-mismatch',
      at: directory,
      detail: `the corpus targets "${corpus.package}" while it lives in the directory "${directory}"`,
    });
  }

  let module: Record<string, unknown>;
  try {
    module = await (options.load ?? importModule)(entryOf(target.home, target.manifest));
  } catch (error) {
    failures.push({
      kind: 'unloadable',
      at: directory,
      detail: `the installed package could not be loaded, so no claim about it could be checked: ${messageOf(error)}`,
    });
    return done(resolved);
  }

  const match = routerFor(corpus);
  if (isFailure(match)) {
    failures.push(match);
    return done(resolved);
  }
  await runWitnesses(options, module, match, inducedCodes, verifiedFixes, failures);
  return done(resolved);
}
