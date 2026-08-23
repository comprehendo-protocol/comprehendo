// Upstream Watch [34]: the lock over ffmpeg's surface, re-probed against the
// REAL binary, and proved to fail loudly when the surface moves.
//
// Nothing here asserts that the lock file looks plausible. Every locked
// element is re-observed by spawning the really-installed ffmpeg (and, for the
// one entry that catalogs it, the really-installed ffprobe), and the drift
// report is computed from what those runs really did. The teeth are the
// synthetic-drift block: three locked elements deliberately made false, run
// against the same real binary, each named by the report.
//
// A missing binary fails this suite loudly (see ffmpeg-cli.ts): a watch that
// skips itself when the tool is absent reports green having observed nothing,
// which is exactly the failure this feature exists to prevent.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import { folkloreFindings, registryTruthFindings } from '../src/gate-folklore.js';
import { elementKindOf, parseLock, readLock, subjectOf } from '../src/upstream-lock.js';
import type { LockEntry, UpstreamLock } from '../src/upstream-lock.js';
import {
  computeSurfaceDrift,
  driftAsTruthFailures,
  formatWatchReport,
  watchExitCode,
  watchReport,
  withWatchDrift,
} from '../src/upstream-watch.js';
import type { SurfaceObservation } from '../src/upstream-watch.js';
import { requireFfmpeg } from './helpers/ffmpeg-cli.js';
import { FFMPEG_DIRECTORY, induceAll, loadFfmpegCorpus } from './helpers/ffmpeg-corpus.js';
import { WITNESSES } from './helpers/ffmpeg-witnesses.js';
import {
  FFMPEG_LOCK_PATH,
  REPO_ROOT,
  probeAll,
  probeOne,
  scannedVersion,
} from './helpers/ffmpeg-upstream-probe.js';

/** The lock, read fresh per test: a missing one is a failure, never a skip. */
const lock = (): UpstreamLock => readLock(FFMPEG_LOCK_PATH);

/** The corpus this lock exists to protect, through 28's REAL parser. */
const corpus = (): CorpusSource => loadFfmpegCorpus();

/** One real probe pass over every locked element. */
const observed = (of: UpstreamLock): readonly SurfaceObservation[] => probeAll(of);

const entriesOfKind = (of: UpstreamLock, kind: 'flag' | 'behavior' | 'stderrPattern'): LockEntry[] =>
  of.entries.filter((entry) => elementKindOf(entry) === kind);

/** A lock carrying exactly one entry, for the synthetic-drift cases. */
const lockOf = (from: UpstreamLock, entry: LockEntry): UpstreamLock =>
  Object.freeze({ ...from, entries: Object.freeze([entry]) });

describe('the lock enumerates what the ffmpeg corpus actually depends on', () => {
  it('reads as a lock file and names the tool the corpus wraps', () => {
    const read = lock();

    expect(read.upstreamWatch).toBe(1);
    expect(read.target).toBe(corpus().package);
    expect(read.provider).toBe(corpus().provider);
    expect(read.entries.length).toBeGreaterThan(0);
  });

  it('locks the stderr pattern of every cataloged twin, verbatim from twins.json', () => {
    const read = lock();
    const cataloged = corpus()
      .twins.map((twin) => twin.fingerprint.messagePattern ?? '')
      .sort();
    const locked = entriesOfKind(read, 'stderrPattern')
      .map((entry) => entry.stderrPattern ?? '')
      .sort();

    expect(locked).toEqual(cataloged);
  });

  it('locks every operation the corpus declares as its own call surface', () => {
    const read = lock();
    const declared = [...(corpus().declaredSchema?.operations ?? [])].sort();
    const flags = entriesOfKind(read, 'flag').map((entry) => entry.flag ?? '');

    for (const operation of declared) expect(flags).toContain(operation);
  });

  it('locks the corrected behavior of every fix that carries an apply', () => {
    const read = lock();
    const source = corpus();
    const executable = source.twins.flatMap((twin) =>
      (source.fixes[twin.id] ?? [])
        .map((fix, index) => ({ id: twin.id, index, apply: fix.apply }))
        .filter((fix) => fix.apply !== undefined),
    );
    const traces = entriesOfKind(read, 'behavior').flatMap((entry) => entry.tracesTo);

    expect(executable.length).toBeGreaterThan(0);
    for (const fix of executable) expect(traces).toContain(`fix:${fix.id}#${String(fix.index)}`);
  });

  it('traces every locked element back into the corpus, and locks nothing else', () => {
    const read = lock();
    const source = corpus();
    const unresolved = read.entries.flatMap((entry) =>
      entry.tracesTo.filter((trace) => !resolves(trace, source)).map((trace) => `${subjectOf(entry)}: ${trace}`),
    );

    expect(unresolved).toEqual([]);
  });

  it("re-probes each cataloged failure with 32's own inducing invocation", () => {
    const read = lock();
    const byPattern = new Map(
      corpus().twins.map((twin) => [twin.fingerprint.messagePattern ?? '', twin.code]),
    );

    for (const entry of entriesOfKind(read, 'stderrPattern')) {
      const code = byPattern.get(entry.stderrPattern ?? '');
      const witness = WITNESSES.find((one) => one.code === code);

      expect([entry.stderrPattern, entry.probe.argv]).toEqual([entry.stderrPattern, witness?.argv]);
      expect([entry.stderrPattern, entry.probe.fixture !== undefined]).toEqual([
        entry.stderrPattern,
        witness?.setup !== undefined,
      ]);
    }
  });
});

describe('the watch re-observes every locked element against the real binary', () => {
  it('is the real binary, and the report carries the version it really scanned', () => {
    const version = requireFfmpeg();
    const read = lock();
    const report = watchReport(read, observed(read), scannedVersion());

    expect(version).toMatch(/^ffmpeg version /);
    expect(report.scanned_version).toBe(version);
    expect(report.target).toBe(read.target);
  });

  it('probes every locked element and finds no drift on this build', () => {
    const read = lock();
    const report = watchReport(read, observed(read), scannedVersion());

    // The report is the CI job's evidence, so it is printed, not only asserted.
    console.log(formatWatchReport(report).join('\n'));

    expect(report.drift).toEqual([]);
    expect(report.locked).toBe(read.entries.length);
    expect(watchExitCode(report)).toBe(0);
  });
});

describe('a changed upstream surface fails the watch, naming the element', () => {
  it('names a flag the binary no longer carries', () => {
    const read = lock();
    const real = entriesOfKind(read, 'flag')[0] as LockEntry;
    const drifted: LockEntry = {
      ...real,
      flag: '-vfx',
      probe: { ...real.probe, argv: ['-nostdin', '-vfx', 'scale=32:32'] },
      expect: { stderrExcludes: "Unrecognized option 'vfx'." },
    };
    const synthetic = lockOf(read, drifted);
    const report = watchReport(synthetic, [probeOne(drifted)], scannedVersion());

    expect(report.drift.map((record) => [record.kind, record.subject])).toEqual([
      ['flag-changed', '-vfx'],
    ]);
    expect(formatWatchReport(report).join('\n')).toContain('-vfx');
    expect(watchExitCode(report)).toBe(1);
  });

  it('names a stderr pattern the binary no longer writes', () => {
    const read = lock();
    const real = entriesOfKind(read, 'stderrPattern')[0] as LockEntry;
    const drifted: LockEntry = { ...real, stderrPattern: '*width not divisible by 3 (*)*' };
    const synthetic = lockOf(read, drifted);
    const report = watchReport(synthetic, [probeOne(drifted)], scannedVersion());

    expect(report.drift.map((record) => record.kind)).toEqual(['pattern-unmatched']);
    expect(report.drift[0]?.subject).toBe('*width not divisible by 3 (*)*');
    expect(report.drift[0]?.now ?? '').not.toBe('');
    expect(watchExitCode(report)).toBe(1);
  });

  it('names a behavior whose real result changed', () => {
    const read = lock();
    const real = entriesOfKind(read, 'behavior').find(
      (entry) => entry.expect.capture !== undefined,
    ) as LockEntry;
    const drifted: LockEntry = { ...real, expect: { ...real.expect, capture: '999,999' } };
    const synthetic = lockOf(read, drifted);
    const report = watchReport(synthetic, [probeOne(drifted)], scannedVersion());

    expect(report.drift.map((record) => [record.kind, record.subject])).toEqual([
      ['behavior-changed', subjectOf(real)],
    ]);
    expect(report.drift[0]?.was).toContain('999,999');
    expect(report.drift[0]?.now).toContain(real.expect.capture ?? '');
  });

  it('treats an element nobody probed as drift, never as a silent pass', () => {
    const read = lock();
    const drift = computeSurfaceDrift(read, []);

    expect(drift.length).toBe(read.entries.length);
    expect(new Set(drift.map((record) => record.kind))).toEqual(new Set(['element-unprobed']));
    expect(drift.map((record) => record.subject).sort()).toEqual(
      read.entries.map((entry) => subjectOf(entry)).sort(),
    );
  });
});

describe("a watch failure routes into CC4 [26]'s drift-failure handling", () => {
  const driftedTwinReport = (): { readonly lock: UpstreamLock; readonly code: string } => {
    const read = lock();
    const twin = corpus().twins.find((one) => one.code === 'FFMPEG_ODD_DIMENSION');
    const real = entriesOfKind(read, 'stderrPattern').find(
      (entry) => entry.stderrPattern === (twin?.fingerprint.messagePattern ?? ''),
    ) as LockEntry;
    return {
      lock: lockOf(read, { ...real, stderrPattern: '*width not divisible by 3 (*)*' }),
      code: 'FFMPEG_ODD_DIMENSION',
    };
  };

  it("turns drift into the gate's own failure value, named at the traced twin", () => {
    const drifted = driftedTwinReport();
    const entry = drifted.lock.entries[0] as LockEntry;
    const report = watchReport(drifted.lock, [probeOne(entry)], scannedVersion());
    const failures = driftAsTruthFailures(drifted.lock, report);

    expect(failures.length).toBeGreaterThan(0);
    expect(failures.map((failure) => failure.at)).toContain(drifted.code);
    expect(failures.map((failure) => failure.kind)).toContain('not-inducible');
  });

  it('makes the REAL folklore and registry-truth checks report it, not ignore it', () => {
    const drifted = driftedTwinReport();
    const entry = drifted.lock.entries[0] as LockEntry;
    const report = watchReport(drifted.lock, [probeOne(entry)], scannedVersion());
    const source = corpus();
    const submission = { directory: FFMPEG_DIRECTORY, source };
    const verification = withWatchDrift(induceAll(source), driftAsTruthFailures(drifted.lock, report));

    const folklore = folkloreFindings(submission, verification);
    const truth = registryTruthFindings(submission, verification);

    expect(folklore.map((found) => found.message).join('\n')).toContain(drifted.code);
    expect(folklore.map((found) => found.message).join('\n')).toContain('drift');
    expect(folklore.map((found) => found.check)).toContain('folklore');
    expect(truth.map((found) => found.locator)).toContain(drifted.code);
  });

  it('leaves the gate exactly as it found it when nothing drifted', () => {
    const read = lock();
    const report = watchReport(read, observed(read), scannedVersion());
    const source = corpus();
    const clean = induceAll(source);

    expect(driftAsTruthFailures(read, report)).toEqual([]);
    expect(withWatchDrift(clean, [])).toEqual(clean);
    expect(folkloreFindings({ directory: FFMPEG_DIRECTORY, source }, clean)).toEqual([]);
  });
});

describe("the report reuses comprehendo diff [17]'s drift-report contract", () => {
  it('records drift in the same four fields diff.ts declares', () => {
    const read = lock();
    const drift = computeSurfaceDrift(read, []);
    const keys = new Set(drift.flatMap((record) => Object.keys(record)));

    for (const key of keys) expect(['kind', 'subject', 'was', 'now']).toContain(key);
    expect(keys.has('kind')).toBe(true);
    expect(keys.has('subject')).toBe(true);
  });

  it('carries the report envelope and the exit-code rule diff established', () => {
    const read = lock();
    const clean = watchReport(read, observed(read), scannedVersion());
    const dirty = watchReport(read, [], scannedVersion());

    expect(Object.keys(clean).sort()).toEqual(
      ['drift', 'locked', 'locked_version', 'scanned_version', 'target'].sort(),
    );
    expect(clean.scanned_version).toBe(scannedVersion());
    expect(clean.locked_version).toBe(read.lockedVersion);
    expect(watchExitCode(clean)).toBe(0);
    expect(watchExitCode(dirty)).toBe(1);
  });
});

describe('the watch job runs on a schedule, not only by hand', () => {
  const workflow = (): string =>
    readFileSync(join(REPO_ROOT, '.github', 'workflows', 'upstream-watch.yml'), 'utf8');

  it('is triggered by cron and on demand', () => {
    const text = workflow();

    expect(text).toContain('schedule:');
    expect(text).toMatch(/cron:\s*['"][^'"]+['"]/);
    expect(text).toContain('workflow_dispatch:');
  });

  it('installs the real binary and runs this very check', () => {
    const text = workflow();

    expect(text).toContain('ffmpeg');
    expect(text).toContain('ffmpeg-upstream-watch');
  });
});

describe('the lock format refuses what it cannot watch', () => {
  const minimal = (over: Record<string, unknown>): string =>
    JSON.stringify({
      comprehendo: '0.1',
      upstreamWatch: 1,
      provider: '@comprehendo/ffmpeg',
      target: 'ffmpeg',
      lockedVersion: 'ffmpeg version 4.4.2',
      observedAt: '2026-08-22',
      entries: [
        {
          flag: '-i',
          lockedVersion: 'ffmpeg version 4.4.2',
          observedAt: '2026-08-22',
          tracesTo: ['schema:-i'],
          probe: { program: 'ffmpeg', argv: ['-nostdin', '-i', 'nope.mp4'] },
          expect: {},
          ...over,
        },
      ],
    });

  it('refuses an entry naming two element kinds at once', () => {
    expect(() => parseLock(minimal({ behavior: 'also-a-behavior' }))).toThrow(/exactly one of/);
  });

  it('refuses an entry that traces to nothing in the corpus', () => {
    expect(() => parseLock(minimal({ tracesTo: [] }))).toThrow(/tracesTo/);
  });

  it('refuses a lock that is not one, and a lock with no entries', () => {
    expect(() => parseLock('{"entries":[]}')).toThrow(/upstreamWatch/);
    expect(() => parseLock('{"upstreamWatch":1,"entries":[]}')).toThrow(/no entries/);
  });

  it('refuses a missing lock file rather than passing an empty watch', () => {
    expect(() => readLock(join(REPO_ROOT, 'corpora', 'ffmpeg', 'no-such.lock'))).toThrow(
      /no lock file/,
    );
  });
});

/** Whether one `tracesTo` pointer really resolves in the corpus it names. */
function resolves(trace: string, source: CorpusSource): boolean {
  const at = trace.indexOf(':');
  const kind = trace.slice(0, at);
  const rest = trace.slice(at + 1);
  if (kind === 'twin') return source.twins.some((twin) => twin.code === rest);
  if (kind === 'topic') return source.topics.some((topic) => topic.topic === rest);
  if (kind === 'schema') return (source.declaredSchema?.operations ?? []).includes(rest);
  if (kind === 'fix') {
    const [id, index] = rest.split('#');
    return (source.fixes[id ?? ''] ?? [])[Number(index)] !== undefined;
  }
  return false;
}
