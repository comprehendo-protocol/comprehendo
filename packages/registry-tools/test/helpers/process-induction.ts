// Generalized from ffmpeg Corpus [32]'s own `ffmpeg-corpus.ts`: loading a
// corpus and inducing every claim it makes out of the REAL target, for any
// target reachable by spawning a real process and reading what it really
// wrote. ffmpeg is a CLI binary; a real Python package's traceback, a real
// Node script's thrown error, and a real git/docker/ssh CLI's stderr are all
// the SAME shape of evidence once a process spawns and its output is text:
// this is the pattern Upstream Watch [34]'s own doc already names as
// generalized, applied here to induction itself, not only to drift-watching.
//
// STILL NEVER A REIMPLEMENTATION of the real gate: `verifyAgainstUpstream`
// (`gate-upstream.ts`) stays the generic path for a package whose failure a
// TypeScript test runner can provoke by importing it directly and catching
// what one exported call throws. This helper exists for everything that
// path cannot reach: a CLI tool with no importable module at all, a Python
// package this runner cannot import, or a JS package whose failure needs
// more than one flat top-level call to provoke (a method chain, a real dev
// server, a real file on disk). Same evidence standard either way: the real
// target, spawned for real, matched through Fingerprint Index & Matcher
// [21]'s REAL index built from the corpus's own twins.json.
//
// VERSION-SCOPED FROM THE START, same shape ffmpeg Corpus [32] was fixed to
// use: a witness carries one or more real, separately-observed captures, one
// per range in the corpus's own `target.versions`, resolved against the
// installed target's real reported version by `version-range.ts`.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parse } from '../../src/corpus-format.js';
import type { CorpusSource } from '../../src/corpus-format.js';
import { fingerprintsOf } from '../../src/gate-fingerprint.js';
import { buildFingerprintIndex } from '../../src/fingerprint.js';
import type { FingerprintIndex } from '../../src/fingerprint.js';
import type { TruthFailure, UpstreamVerification } from '../../src/gate-upstream.js';
import { matchesRange } from '../../src/version-range.js';

/** The corpus, read by Corpus Format [28]'s REAL parser. Never a typed double. */
export const loadCorpus = (corpusDir: string): CorpusSource => parse(corpusDir);

/** The corpus's own compiled index, through Fingerprint Index & Matcher [21]'s REAL builder. */
export const indexOf = (corpus: CorpusSource): FingerprintIndex =>
  buildFingerprintIndex(fingerprintsOf(corpus));

/** One real, version-scoped capture of what a spawned process really wrote. */
export interface VersionedCapture {
  /** The declared range this capture belongs to, e.g. `>=1 <4`. */
  readonly versions: string;
  /** The exit status the process really returned. Never assumed nonzero. */
  readonly status: number;
  /** A literal fragment of the text the process really wrote, this range only. */
  readonly text: string;
}

/** How one cataloged failure is really provoked against the real target. */
export interface ProcessWitness {
  /** The twin `code` this run must produce, per the corpus. */
  readonly code: string;
  /** The program to spawn (a binary on PATH, or an absolute path). */
  readonly program: string;
  /** The real argument vector, minus the program name. */
  readonly argv: readonly string[];
  /** What the workspace needs before the run. Returns nothing; it writes files. */
  readonly setup?: (cwd: string) => void;
  /** Which stream the fingerprint pattern is matched against. Defaults to stderr. */
  readonly stream?: 'stdout' | 'stderr' | 'combined';
  /**
   * Environment variables to remove from the spawned process, never inherited
   * from whoever runs this suite. A witness inducing "no credential is set"
   * would otherwise silently pass or fail depending on the runner's own
   * shell, which is exactly the kind of environment leak CC6 [27]'s
   * no-telemetry discipline already refuses elsewhere in this project.
   */
  readonly unsetEnv?: readonly string[];
  /** Real captures, one per declared range this witness has been re-run against. */
  readonly captures: readonly VersionedCapture[];
}

/** The version-scoped capture for one witness against the target really installed. */
export function captureFor(witness: ProcessWitness, installedVersion: string): VersionedCapture {
  const found = witness.captures.find((capture) => matchesRange(capture.versions, installedVersion));
  if (found === undefined) {
    const ranges = witness.captures.map((capture) => capture.versions).join(', ');
    throw new Error(
      `${installedVersion} matches none of ${witness.code}'s declared capture ranges (${ranges}); ` +
        'this witness has never been re-run against this major',
    );
  }
  return found;
}

/** One real spawn, workspace-isolated. Never a shell: argv is an array. */
function spawnOnce(
  program: string,
  argv: readonly string[],
  cwd: string,
  unsetEnv?: readonly string[],
): { readonly status: number; readonly stdout: string; readonly stderr: string } {
  const env = { ...process.env };
  for (const name of unsetEnv ?? []) delete env[name];
  const result = spawnSync(program, [...argv], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    env,
  });
  if (result.error !== undefined) {
    throw new Error(`could not spawn ${program}: ${result.error.message}`);
  }
  return { status: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

const textOf = (
  stream: ProcessWitness['stream'],
  run: { readonly stdout: string; readonly stderr: string },
): string => {
  if (stream === 'stdout') return run.stdout;
  if (stream === 'combined') return `${run.stdout}\n${run.stderr}`;
  return run.stderr;
};

/** One real, disposable workspace for one spawn. */
function workspace(): { readonly path: string; readonly cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'comprehendo-induce-'));
  return { path, cleanup: (): void => rmSync(path, { recursive: true, force: true }) };
}

export interface Induced {
  readonly code: string;
  readonly status: number;
  /** The status the real, version-scoped capture recorded, for the caller's own assertion. */
  readonly expectedStatus: number;
  readonly text: string;
  readonly outcome: string;
  readonly matched: string;
}

/** Induce one cataloged failure out of the real target and route its output. */
export function induceOne(
  witness: ProcessWitness,
  index: FingerprintIndex,
  installedVersion: string,
): Induced {
  const capture = captureFor(witness, installedVersion);
  const site = workspace();
  try {
    witness.setup?.(site.path);
    const run = spawnOnce(witness.program, witness.argv, site.path, witness.unsetEnv);
    const text = textOf(witness.stream, run);
    const match = index.match(text);
    return {
      code: witness.code,
      status: run.status,
      expectedStatus: capture.status,
      text,
      outcome: match.outcome,
      matched: match.outcome === 'matched' ? match.entry.corpusEntryId : '',
    };
  } finally {
    site.cleanup();
  }
}

/** Why this run did not settle the entry, or `undefined` when it did. */
function routeInduction(
  code: string,
  status: number,
  text: string,
  expectedStatus: number,
  index: FingerprintIndex,
): TruthFailure | undefined {
  // Judged against THIS witness's own real capture, never a blanket "0 means
  // it did not fail": a target's exit status is not always a reliable
  // success signal (verified live on ffmpeg's own >=6 <8 line; see
  // corpora/ffmpeg's Fixed Issues), so the recorded expectation decides.
  if (status !== expectedStatus) {
    return {
      kind: 'not-inducible',
      at: code,
      detail:
        `the witness for ${code} really exited ${String(status)}, ` +
        `the real capture for the installed target recorded ${String(expectedStatus)}`,
    };
  }
  const match = index.match(text);
  if (match.outcome !== 'matched') {
    return {
      kind: match.outcome === 'ambiguous' ? 'misrouted' : 'not-inducible',
      at: code,
      detail: `the output this witness really produced routed as ${match.outcome}`,
    };
  }
  if (match.entry.corpusEntryId !== code) {
    return {
      kind: 'misrouted',
      at: code,
      detail: `the failure this witness really provoked matches ${match.entry.corpusEntryId}`,
    };
  }
  return undefined;
}

/** One process-shaped fix: applied for real (a different argv/setup) and re-run. */
export interface ProcessFix {
  readonly title: string;
  /** The argv that resolves the failure; omitted means this fix is an inert docs pointer. */
  readonly argv?: readonly string[];
  readonly setup?: (cwd: string) => void;
}

/** The real, installed target's version string (whatever `--version`-shaped probe reports). */
export type VersionProbe = () => string;

/**
 * Every claim this corpus makes, checked against the real target, as the
 * `UpstreamVerification` the gate reads. Same evidence standard as
 * `verifyAgainstUpstream`: a twin whose induction did not reproduce, or whose
 * failure routed elsewhere, comes back as a named failure, never a silent
 * omission.
 */
export function induceAll(
  corpus: CorpusSource,
  directory: string,
  witnesses: readonly ProcessWitness[],
  fixesOf: (id: string) => readonly ProcessFix[],
  version: VersionProbe,
): UpstreamVerification {
  const index = indexOf(corpus);
  const installedVersion = version();
  const inducedCodes: string[] = [];
  const verifiedFixes: string[] = [];
  const failures: TruthFailure[] = [];

  for (const twin of corpus.twins) {
    const witness = witnesses.find((entry) => entry.code === twin.code);
    if (witness === undefined) {
      failures.push({
        kind: 'unrunnable-witness',
        at: twin.code,
        detail: `no inducing invocation is supplied for ${twin.code}`,
      });
      continue;
    }
    const capture = captureFor(witness, installedVersion);
    const site = workspace();
    try {
      witness.setup?.(site.path);
      const run = spawnOnce(witness.program, witness.argv, site.path, witness.unsetEnv);
      const text = textOf(witness.stream, run);
      const routed = routeInduction(twin.code, run.status, text, capture.status, index);
      if (routed !== undefined) {
        failures.push(routed);
        continue;
      }
      inducedCodes.push(twin.code);
      for (const fix of fixesOf(twin.id)) {
        if (fix.argv === undefined) continue;
        const key = `${twin.code} :: ${fix.title}`;
        fix.setup?.(site.path);
        const retried = spawnOnce(witness.program, fix.argv, site.path, witness.unsetEnv);
        if (retried.status === 0) {
          verifiedFixes.push(key);
        } else {
          failures.push({
            kind: 'fix-did-not-resolve',
            at: key,
            detail: `applying "${fix.title}" and retrying still failed:\n${retried.stderr}`,
          });
        }
      }
    } finally {
      site.cleanup();
    }
  }

  return Object.freeze({
    directory,
    package: corpus.package,
    resolved: Object.freeze({ name: directory, version: installedVersion }),
    inducedCodes: Object.freeze(inducedCodes),
    verifiedFixes: Object.freeze(verifiedFixes),
    failures: Object.freeze(failures),
  });
}
