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
import { elementKindOf, entriesFor, parseLock, readLock, subjectOf } from '../src/upstream-lock.js';
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

/**
 * Every test that re-probes spawns the real binary, the whole-lock pass three
 * dozen times, so vitest's five-second default would be a race against the
 * machine rather than a bound on anything. 32 makes the same allowance, for
 * the same reason, on its own induction pass.
 */
const SPAWNS_REAL_BINARY = 300_000;

/** The lock, read fresh per test: a missing one is a failure, never a skip. */
const lock = (): UpstreamLock => readLock(FFMPEG_LOCK_PATH);

/** The corpus this lock exists to protect, through 28's REAL parser. */
const corpus = (): CorpusSource => loadFfmpegCorpus();

/**
 * The entries that apply to the binary really installed: the SAME
 * resolution `watchReport` does internally, exposed here because several
 * tests need to pick a real entry to mutate before calling `watchReport`
 * themselves, and picking one from the WRONG range would probe correctly
 * but compare against an expectation no binary here was ever going to meet.
 */
const resolved = (of: UpstreamLock): readonly LockEntry[] => entriesFor(of, scannedVersion());

/** One real probe pass over the entries that apply to this binary. */
const observed = (entries: readonly LockEntry[]): readonly SurfaceObservation[] => probeAll(entries);

const entriesOfKind = (
  of: readonly LockEntry[],
  kind: 'flag' | 'behavior' | 'stderrPattern',
): LockEntry[] => of.filter((entry) => elementKindOf(entry) === kind);

/** A lock carrying exactly one entry, for the synthetic-drift cases. */
const lockOf = (from: UpstreamLock, entry: LockEntry): UpstreamLock =>
  Object.freeze({ ...from, entries: Object.freeze([entry]) });

describe('the lock enumerates what the ffmpeg corpus actually depends on', () => {
  it('reads as a lock file and names the tool the corpus wraps', () => {
    const read = lock();

    expect(read.upstreamWatch).toBe(2);
    expect(read.target).toBe(corpus().package);
    expect(read.provider).toBe(corpus().provider);
    expect(read.entries.length).toBeGreaterThan(0);
  });

  it('locks the stderr pattern of every cataloged twin, verbatim from twins.json, on the binary really installed', () => {
    const read = lock();
    const cataloged = corpus()
      .twins.map((twin) => twin.fingerprint.messagePattern ?? '')
      .sort();
    const locked = entriesOfKind(resolved(read), 'stderrPattern')
      .map((entry) => entry.stderrPattern ?? '')
      .sort();

    expect(locked).toEqual(cataloged);
  });

  it('locks every operation the corpus declares as its own call surface, on the binary really installed', () => {
    const read = lock();
    const declared = [...(corpus().declaredSchema?.operations ?? [])].sort();
    const flags = entriesOfKind(resolved(read), 'flag').map((entry) => entry.flag ?? '');

    for (const operation of declared) expect(flags).toContain(operation);
  });

  it('locks the corrected behavior of every fix that carries an apply, on the binary really installed', () => {
    const read = lock();
    const source = corpus();
    const executable = source.twins.flatMap((twin) =>
      (source.fixes[twin.id] ?? [])
        .map((fix, index) => ({ id: twin.id, index, apply: fix.apply }))
        .filter((fix) => fix.apply !== undefined),
    );
    const traces = entriesOfKind(resolved(read), 'behavior').flatMap((entry) => entry.tracesTo);

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

  it('locks each subject once per declared version range, never once overall', () => {
    // The format's whole point: a wrapped CLI's wording is not stable
    // across a major, so the SAME subject legitimately appears once per
    // range in target.versions, not once for the whole lock.
    const read = lock();
    const ranges = new Set(read.entries.map((entry) => entry.versions));

    expect(ranges.size).toBeGreaterThan(1);
    for (const range of ranges) {
      const subjects = read.entries.filter((entry) => entry.versions === range).map(subjectOf);
      expect(new Set(subjects).size).toBe(subjects.length);
    }
  });

  it("re-probes each cataloged failure with 32's own inducing invocation, on the binary really installed", () => {
    const read = lock();
    const byPattern = new Map(
      corpus().twins.map((twin) => [twin.fingerprint.messagePattern ?? '', twin.code]),
    );

    for (const entry of entriesOfKind(resolved(read), 'stderrPattern')) {
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
    const report = watchReport(read, observed(resolved(read)), scannedVersion());

    expect(version).toMatch(/^ffmpeg version /);
    expect(report.scanned_version).toBe(version);
    expect(report.target).toBe(read.target);
  }, SPAWNS_REAL_BINARY);

  it('probes every locked element and finds no drift on this build', () => {
    const read = lock();
    const entries = resolved(read);
    const report = watchReport(read, observed(entries), scannedVersion());

    // The report is the CI job's evidence, so it is printed, not only asserted.
    console.log(formatWatchReport(report).join('\n'));

    expect(report.drift).toEqual([]);
    expect(report.locked).toBe(entries.length);
    expect(watchExitCode(report)).toBe(0);
  }, SPAWNS_REAL_BINARY);
});

describe('a changed upstream surface fails the watch, naming the element', () => {
  it('names a flag the binary no longer carries', () => {
    const read = lock();
    const real = entriesOfKind(resolved(read), 'flag')[0] as LockEntry;
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
  }, SPAWNS_REAL_BINARY);

  it('names a stderr pattern the binary no longer writes', () => {
    const read = lock();
    const real = entriesOfKind(resolved(read), 'stderrPattern')[0] as LockEntry;
    const drifted: LockEntry = { ...real, stderrPattern: '*width not divisible by 3 (*)*' };
    const synthetic = lockOf(read, drifted);
    const report = watchReport(synthetic, [probeOne(drifted)], scannedVersion());

    expect(report.drift.map((record) => record.kind)).toEqual(['pattern-unmatched']);
    expect(report.drift[0]?.subject).toBe('*width not divisible by 3 (*)*');
    expect(report.drift[0]?.now ?? '').not.toBe('');
    expect(watchExitCode(report)).toBe(1);
  }, SPAWNS_REAL_BINARY);

  it('names a behavior whose real result changed', () => {
    const read = lock();
    const real = entriesOfKind(resolved(read), 'behavior').find(
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
  }, SPAWNS_REAL_BINARY);

  it('treats an element nobody probed as drift, never as a silent pass', () => {
    const read = lock();
    const entries = resolved(read);
    const drift = computeSurfaceDrift(entries, []);

    expect(drift.length).toBe(entries.length);
    expect(new Set(drift.map((record) => record.kind))).toEqual(new Set(['element-unprobed']));
    expect(drift.map((record) => record.subject).sort()).toEqual(
      entries.map((entry) => subjectOf(entry)).sort(),
    );
  });
});

describe("a watch failure routes into CC4 [26]'s drift-failure handling", () => {
  const driftedTwinReport = (): { readonly lock: UpstreamLock; readonly code: string } => {
    const read = lock();
    const twin = corpus().twins.find((one) => one.code === 'FFMPEG_ODD_DIMENSION');
    const real = entriesOfKind(resolved(read), 'stderrPattern').find(
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
  }, SPAWNS_REAL_BINARY);

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
  }, SPAWNS_REAL_BINARY);

  it('leaves the gate exactly as it found it when nothing drifted', () => {
    const read = lock();
    const report = watchReport(read, observed(resolved(read)), scannedVersion());
    const source = corpus();
    const clean = induceAll(source);

    expect(driftAsTruthFailures(read, report)).toEqual([]);
    expect(withWatchDrift(clean, [])).toEqual(clean);
    expect(folkloreFindings({ directory: FFMPEG_DIRECTORY, source }, clean)).toEqual([]);
  }, SPAWNS_REAL_BINARY);
});

describe("the report reuses comprehendo diff [17]'s drift-report contract", () => {
  it('records drift in the same four fields diff.ts declares', () => {
    const read = lock();
    const drift = computeSurfaceDrift(resolved(read), []);
    const keys = new Set(drift.flatMap((record) => Object.keys(record)));

    for (const key of keys) expect(['kind', 'subject', 'was', 'now']).toContain(key);
    expect(keys.has('kind')).toBe(true);
    expect(keys.has('subject')).toBe(true);
  });

  it('carries the report envelope and the exit-code rule diff established', () => {
    const read = lock();
    const clean = watchReport(read, observed(resolved(read)), scannedVersion());
    const dirty = watchReport(read, [], scannedVersion());

    expect(Object.keys(clean).sort()).toEqual(
      ['drift', 'locked', 'locked_version', 'scanned_version', 'target'].sort(),
    );
    expect(clean.scanned_version).toBe(scannedVersion());
    expect(clean.locked_version).toBe(read.lockedVersion);
    expect(watchExitCode(clean)).toBe(0);
    expect(watchExitCode(dirty)).toBe(1);
  }, SPAWNS_REAL_BINARY);
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
      upstreamWatch: 2,
      provider: '@comprehendo/ffmpeg',
      target: 'ffmpeg',
      lockedVersion: 'ffmpeg version 4.4.2',
      observedAt: '2026-08-22',
      entries: [
        {
          flag: '-i',
          versions: '>=4.4 <5',
          lockedVersion: 'ffmpeg version 4.4.2',
          observedAt: '2026-08-22',
          tracesTo: ['schema:-i'],
          probe: { program: 'ffmpeg', argv: ['-nostdin', '-i', 'nope.mp4'] },
          expect: {},
          ...over,
        },
      ],
    });

  const minimalTwoRanges = (): string =>
    JSON.stringify({
      comprehendo: '0.1',
      upstreamWatch: 2,
      provider: '@comprehendo/ffmpeg',
      target: 'ffmpeg',
      lockedVersion: 'ffmpeg version 6.1.1',
      observedAt: '2026-08-23',
      entries: [
        {
          flag: '-i',
          versions: '>=4.4 <5',
          lockedVersion: 'ffmpeg version 4.4.2',
          observedAt: '2026-08-22',
          tracesTo: ['schema:-i'],
          probe: { program: 'ffmpeg', argv: ['-nostdin', '-i', 'nope.mp4'] },
          expect: {},
        },
        {
          flag: '-i',
          versions: '>=6 <8',
          lockedVersion: 'ffmpeg version 6.1.1',
          observedAt: '2026-08-23',
          tracesTo: ['schema:-i'],
          probe: { program: 'ffmpeg', argv: ['-nostdin', '-i', 'nope.mp4'] },
          expect: {},
        },
      ],
    });

  it('refuses an entry naming two element kinds at once', () => {
    expect(() => parseLock(minimal({ behavior: 'also-a-behavior' }))).toThrow(/exactly one of/);
  });

  it('refuses an entry that traces to nothing in the corpus', () => {
    expect(() => parseLock(minimal({ tracesTo: [] }))).toThrow(/tracesTo/);
  });

  it('refuses an entry with no versions range: the field is required, not optional', () => {
    expect(() => parseLock(minimal({ versions: '' }))).toThrow(/versions/);
  });

  it('refuses a lock that is not one, a v1 lock, and a lock with no entries', () => {
    expect(() => parseLock('{"entries":[]}')).toThrow(/upstreamWatch/);
    expect(() => parseLock('{"upstreamWatch":1,"entries":[]}')).toThrow(/upstreamWatch/);
    expect(() => parseLock('{"upstreamWatch":2,"entries":[]}')).toThrow(/no entries/);
  });

  it('accepts the SAME subject locked twice, once per declared range', () => {
    const read = parseLock(minimalTwoRanges());

    expect(read.entries).toHaveLength(2);
    expect(read.entries.map((entry) => entry.versions).sort()).toEqual(['>=4.4 <5', '>=6 <8']);
  });

  it('refuses the same subject locked twice for the SAME range', () => {
    const twice = JSON.parse(minimalTwoRanges()) as { entries: Record<string, unknown>[] };
    (twice.entries[1] as Record<string, unknown>)['versions'] = '>=4.4 <5';

    expect(() => parseLock(JSON.stringify(twice))).toThrow(/locked twice for >=4\.4 <5/);
  });

  it('refuses a missing lock file rather than passing an empty watch', () => {
    expect(() => readLock(join(REPO_ROOT, 'corpora', 'ffmpeg', 'no-such.lock'))).toThrow(
      /no lock file/,
    );
  });
});

describe('a binary outside every declared range is UNSUPPORTED, never drift', () => {
  it('refuses, naming every declared range, rather than reporting drift', () => {
    const read = lock();

    expect(() => entriesFor(read, 'ffmpeg version 5.0.0')).toThrow(/matches none/);
    expect(() => entriesFor(read, 'ffmpeg version 5.0.0')).toThrow(/not the same as drift/);
  });

  it('resolves the real installed binary to exactly one declared range', () => {
    const read = lock();
    const entries = resolved(read);
    const ranges = new Set(entries.map((entry) => entry.versions));

    expect(ranges.size).toBe(1);
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
