/**
 * Cold-Agent Benchmark [38]: the number the whole project claims.
 *
 * Nothing in this file is mocked. The corpus is the real one, the binary is
 * the really-installed ffmpeg, the router is built by Router & Precedence
 * [22]'s own discovery, the meter is the real js-tiktoken one, and the CC9
 * scans are the real ones, re-invoked as real subprocesses.
 *
 * @see .mdd/docs/38-cold-agent-benchmark.md
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyToArgv as benchmarkApply } from '../../../scripts/cold-agent-apply.ts';
import {
  SIMULATOR_LABEL,
  main,
  renderReport,
  runBenchmark,
} from '../../../scripts/cold-agent-benchmark.ts';
import type { Agent, BenchmarkResult } from '../../../scripts/cold-agent-benchmark.ts';
import { cc9Scans, runCc9Gate } from '../../../scripts/cold-agent-cc9.ts';
import { ACTION_MENU, actionFrom, systemPromptOf } from '../../../scripts/cold-agent-live.ts';
import {
  OPERATOR_BASELINE,
  faithfulAgent,
  recordOf,
  sessionText,
} from '../../../scripts/cold-agent-suite.ts';
import type {
  DocsLike,
  Observation,
  SessionState,
  Task,
  TaskTranscript,
} from '../../../scripts/cold-agent-suite.ts';
import { TASKS } from '../../../scripts/cold-agent-tasks.ts';
import { INDUCE_PREFIX, applyToArgv as corpusApply, requireFfmpeg, run, workspace } from './helpers/ffmpeg-cli.js';
import { WITNESSES } from './helpers/ffmpeg-witnesses.js';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const CORPUS_DIR = join(REPO_ROOT, 'corpora', 'ffmpeg');
const twins = JSON.parse(readFileSync(join(CORPUS_DIR, 'twins.json'), 'utf8')) as {
  twins: readonly { code: string }[];
};
const declaredOperations = (
  JSON.parse(readFileSync(join(CORPUS_DIR, 'manifest.json'), 'utf8')) as {
    declared_schema: { operations: readonly string[] };
  }
).declared_schema.operations;

const failureTasks = TASKS.filter((task) => task.expect.startsWith('FFMPEG_'));
const taskById = (id: string): Task => {
  const found = TASKS.find((task) => task.id === id);
  if (found === undefined) throw new Error(`no task ${id}`);
  return found;
};

/** One real, full run of the release gate, shared by the tests that need one. */
let gate: BenchmarkResult;

beforeAll(async () => {
  requireFfmpeg();
  gate = await runBenchmark({ repoRoot: REPO_ROOT });
}, 300_000);

describe('the scripted task suite', () => {
  it('carries one task per cataloged ffmpeg failure, plus a clean path and an honest-miss path', () => {
    expect([...failureTasks.map((task) => task.expect)].sort()).toEqual(
      [...twins.twins.map((twin) => twin.code)].sort(),
    );
    expect(TASKS.filter((task) => task.kind === 'clean').map((task) => task.expect)).toEqual(['OK']);
    expect(TASKS.filter((task) => task.kind === 'honest-miss').map((task) => task.expect)).toEqual([
      'UNDOCUMENTED',
    ]);
    expect(TASKS).toHaveLength(twins.twins.length + 2);
  });

  it("induces every failure with ffmpeg Corpus [32]'s own witness argv, never a rephrasing", () => {
    for (const task of failureTasks) {
      const witness = WITNESSES.find((one) => one.code === task.expect);

      expect(witness, task.expect).toBeDefined();
      expect(task.argv, task.expect).toEqual(witness?.argv);
      expect(task.stderrWitness, task.expect).toBe(witness?.stderr);
    }
  });

  it('really fails every failure task against the real ffmpeg, writing the cataloged text', () => {
    for (const task of failureTasks) {
      const space = workspace();
      try {
        const fixture = task.fixture;
        if (fixture?.make === 'text') writeFileSync(join(space.path, fixture.name), 'not media\n');
        else if (fixture !== undefined) {
          const made = run(
            [
              ...INDUCE_PREFIX,
              '-f',
              'lavfi',
              '-i',
              `testsrc=size=${fixture.make === 'video' ? (fixture.size ?? '320x240') : '320x240'}:rate=10:duration=1`,
              '-c:v',
              'libx264',
              '-pix_fmt',
              'yuv420p',
              '-y',
              fixture.name,
            ],
            space.path,
          );
          expect(made.status, `fixture ${fixture.name}`).toBe(0);
        }
        const result = run(task.argv, space.path);

        expect(result.status, task.id).not.toBe(0);
        expect(result.stderr, task.id).toContain(task.stderrWitness);
      } finally {
        space.cleanup();
      }
    }
  }, 120_000);

  it('really succeeds on the clean path against the real ffmpeg, with no correction', () => {
    const space = workspace();
    try {
      const result = run(taskById('transcode-a-clip-that-simply-works').argv, space.path);

      expect(result.status).toBe(0);
    } finally {
      space.cleanup();
    }
  }, 60_000);
});

describe('the faithful agent follows only the priming snippet', () => {
  const state = (task: Task, observations: readonly Observation[], attempts = 0): SessionState => ({
    task,
    observations,
    attempts,
  });
  const failing = taskById('crop-and-transcode-a-video-to-720p');
  const twinWithApply = {
    comprehendo: '0.1',
    code: 'FFMPEG_ODD_DIMENSION',
    reason: 'r',
    fixes: [{ title: 'Fence', apply: { '-vf': 'scale=-2:720' }, docs: 'scaling' }],
  };
  const twinWithPointer = {
    comprehendo: '0.1',
    code: 'FFMPEG_UNKNOWN_ENCODER',
    reason: 'r',
    fixes: [{ title: 'Runbook', docs: 'codecs' }],
  };

  it('probes the caught value for the marker before it calls anything else', () => {
    const first = faithfulAgent(state(failing, []));
    const next = faithfulAgent(state(failing, [{ kind: 'ran', status: 1, stderr: 'boom' }], 1));

    expect(first).toEqual({ kind: 'run', argv: failing.argv });
    expect(next).toEqual({ kind: 'probe' });
  });

  it('calls comprehend(raw) when the probe finds no marker', () => {
    const observations: readonly Observation[] = [
      { kind: 'ran', status: 1, stderr: 'boom' },
      { kind: 'probed', marker: undefined },
    ];

    expect(faithfulAgent(state(failing, observations, 1))).toEqual({ kind: 'comprehend' });
  });

  it("asks the handle's own docs when the probe DOES find a marker", () => {
    const observations: readonly Observation[] = [
      { kind: 'ran', status: 1, stderr: 'boom' },
      { kind: 'probed', marker: { name: 'ffmpeg' } },
    ];

    expect(faithfulAgent(state(failing, observations, 1))).toEqual({
      kind: 'docs',
      pkg: 'ffmpeg',
      question: failing.goal,
    });
  });

  it('reads reason and applies fixes[0] when the twin carries an executable apply', () => {
    const observations: readonly Observation[] = [
      { kind: 'ran', status: 1, stderr: 'boom' },
      { kind: 'probed', marker: undefined },
      { kind: 'comprehended', twin: twinWithApply },
    ];

    expect(faithfulAgent(state(failing, observations, 1))).toEqual({
      kind: 'apply-and-rerun',
      fix: twinWithApply.fixes[0],
    });
  });

  it("follows fixes[0]'s inert docs pointer when the fix carries no apply", () => {
    const observations: readonly Observation[] = [
      { kind: 'ran', status: 1, stderr: 'boom' },
      { kind: 'probed', marker: undefined },
      { kind: 'comprehended', twin: twinWithPointer },
    ];

    expect(faithfulAgent(state(failing, observations, 1))).toEqual({
      kind: 'docs',
      pkg: 'ffmpeg',
      question: 'codecs',
    });
  });

  it('makes no protocol call at all on an invocation that succeeded', () => {
    const clean = taskById('transcode-a-clip-that-simply-works');
    const transcript = gate.transcripts.find((one) => one.task.id === clean.id);

    expect(faithfulAgent(state(clean, [{ kind: 'ran', status: 0, stderr: '' }], 1))).toEqual({
      kind: 'done',
      outcome: 'succeeded',
    });
    expect(transcript?.actions.map((action) => action.kind)).toEqual(['run', 'done']);
    expect(transcript?.observations.map((observation) => observation.kind)).toEqual(['ran']);
  });

  it('gives up rather than looping when the correction budget is spent', () => {
    const observations: readonly Observation[] = [
      { kind: 'ran', status: 1, stderr: 'boom' },
      { kind: 'ran', status: 1, stderr: 'boom again' },
    ];

    expect(faithfulAgent(state(failing, observations, 2))).toEqual({
      kind: 'done',
      outcome: 'gave-up',
    });
  });

  it("applies a fix to an argv exactly as the corpus's own applyToArgv does", () => {
    const fixes = JSON.parse(readFileSync(join(CORPUS_DIR, 'fixes.json'), 'utf8')) as {
      fixes: Record<string, readonly { apply?: unknown }[]>;
    };
    const applies = Object.values(fixes.fixes)
      .flat()
      .filter((fix) => fix.apply !== undefined)
      .map((fix) => fix.apply);

    expect(applies.length).toBeGreaterThan(0);
    for (const task of TASKS) {
      for (const apply of applies) {
        expect(
          benchmarkApply(task.argv, apply, declaredOperations),
          `${task.id} ${JSON.stringify(apply)}`,
        ).toEqual(corpusApply(task.argv, apply, declaredOperations));
      }
    }
  });

  it("refuses an apply that escapes the corpus's declared call surface", () => {
    expect(() => benchmarkApply(['-i', 'a.mp4', 'out.mp4'], { '-x': 'y' }, declaredOperations)).toThrow(
      /declared_schema does not declare/,
    );
  });
});

describe('Business Rule 2: zero source reads outside an UNDOCUMENTED grant', () => {
  const task = taskById('crop-and-transcode-a-video-to-720p');
  const undocumented: DocsLike = {
    code: 'UNDOCUMENTED',
    query: 'q',
    nearest: [],
    source_permitted: true,
  };
  const everyObservation: readonly (Observation | undefined)[] = [
    undefined,
    { kind: 'ran', status: 0, stderr: '' },
    { kind: 'ran', status: 1, stderr: 'boom' },
    { kind: 'probed', marker: undefined },
    { kind: 'probed', marker: { name: 'ffmpeg' } },
    { kind: 'comprehended', twin: { comprehendo: '0.1', code: 'X', reason: 'r', fixes: [] } },
    {
      kind: 'comprehended',
      twin: { comprehendo: '0.1', code: 'UNSTRUCTURED', reason: 'r', fixes: [] },
    },
    {
      kind: 'comprehended',
      twin: {
        comprehendo: '0.1',
        code: 'X',
        reason: 'r',
        fixes: [{ title: 'f', apply: { '-vf': 'scale=-2:720' } }],
      },
    },
    { kind: 'comprehended', twin: { comprehendo: '0.1', code: 'X', reason: 'r', fixes: [{ title: 'f', docs: 'codecs' }] } },
    { kind: 'docs', response: { topic: 'codecs', summary: 's' } },
    { kind: 'docs', response: { topics: ['codecs'] } },
    { kind: 'docs', response: undocumented },
    { kind: 'docs', response: { code: 'UNDOCUMENTED', query: 'q' } },
    { kind: 'source', path: '/tmp/x', text: 'x' },
  ];

  it('emits a source read only when the previous docs answer was UNDOCUMENTED', () => {
    for (const observation of everyObservation) {
      for (const attempts of [0, 1, 2]) {
        const action = faithfulAgent({
          task,
          observations: observation === undefined ? [] : [observation],
          attempts,
        });
        const granted =
          observation?.kind === 'docs' &&
          observation.response.code === 'UNDOCUMENTED' &&
          observation.response.source_permitted === true;

        expect(action.kind === 'read-source', JSON.stringify({ observation, attempts })).toBe(
          granted,
        );
      }
    }
  });

  it('records sourceReadsOutsideGrant: 0 across a real run of the whole suite', () => {
    expect(gate.record.sourceReadsOutsideGrant).toBe(0);
    expect(gate.transcripts.every((one) => one.sourceReadsOutsideGrant === 0)).toBe(true);
  });

  it('really performs the one granted source pass, and counts it as granted', () => {
    const reads = gate.transcripts.flatMap((transcript) =>
      transcript.observations.filter((observation) => observation.kind === 'source'),
    );

    expect(reads).toHaveLength(1);
    expect(reads[0]?.path).toMatch(/node_modules\/toy-widgets\/index\.js$/);
    expect(reads[0]?.text).toContain('registerWidget');
    expect(gate.record.sourceReadsOutsideGrant).toBe(0);
  });

  it('catches a planted source read taken outside a grant, and fails the run for it', async () => {
    // A reckless agent: it reaches for source the moment anything fails, with
    // no UNDOCUMENTED answer anywhere behind it. The gate must see every one.
    const reckless: Agent = (state) => {
      const last = state.observations[state.observations.length - 1];
      if (last === undefined) return { kind: 'run', argv: state.task.argv };
      if (last.kind === 'ran' && last.status !== 0) {
        return { kind: 'read-source', question: state.task.goal };
      }
      return { kind: 'done', outcome: 'gave-up' };
    };
    const planted = await runBenchmark({
      repoRoot: REPO_ROOT,
      tasks: failureTasks,
      agent: reckless,
      scans: [],
    });

    expect(planted.record.sourceReadsOutsideGrant).toBe(failureTasks.length);
    expect(planted.passed).toBe(false);
    expect(planted.failures.join(' ')).toContain('outside an UNDOCUMENTED grant');
    expect(planted.record.firstCorrectionRate).toBe(0);
  }, 300_000);
});

describe('Business Rule 1: first-correction rate at or above the Operator baseline', () => {
  it('reaches the Operator baseline on a real run of the whole suite', () => {
    expect(gate.record.tasksAttempted).toBe(TASKS.length);
    expect(gate.record.tasksFirstCorrected).toBe(TASKS.length);
    expect(gate.record.firstCorrectionRate).toBeGreaterThanOrEqual(OPERATOR_BASELINE);
    expect(gate.failures).toEqual([]);
    expect(gate.passed).toBe(true);
  });

  it('publishes the per-kind breakdown the single rate is computed from', () => {
    expect(gate.breakdown).toEqual({
      'executable-fix': { corrected: 3, attempted: 3 },
      'inert-pointer': { corrected: 9, attempted: 9 },
      clean: { corrected: 1, attempted: 1 },
      'honest-miss': { corrected: 1, attempted: 1 },
    });
    const total = Object.values(gate.breakdown).reduce((sum, one) => sum + one.corrected, 0);

    expect(total).toBe(gate.record.tasksFirstCorrected);
  });

  it('drops the rate, and fails the run, when a planted fix does not resolve its failure', async () => {
    // The mutation is REAL: a copy of the real corpus whose heal names `copy`
    // again, which is the very thing the failure was about. It stays inside
    // the declared call surface, so nothing rejects it; it simply does not work.
    const poisoned = mkdtempSync(join(tmpdir(), 'poisoned-corpus-'));
    try {
      cpSync(CORPUS_DIR, poisoned, { recursive: true });
      const fixesPath = join(poisoned, 'fixes.json');
      writeFileSync(
        fixesPath,
        readFileSync(fixesPath, 'utf8').replace('"-c:v": "libx264"', '"-c:v": "copy"'),
      );
      const planted = await runBenchmark({ repoRoot: REPO_ROOT, corpusDir: poisoned, scans: [] });

      expect(planted.record.tasksFirstCorrected).toBe(TASKS.length - 1);
      expect(planted.record.firstCorrectionRate).toBeLessThan(OPERATOR_BASELINE);
      expect(planted.passed).toBe(false);
      expect(planted.failures.join(' ')).toContain('below the Operator baseline');
      expect(planted.breakdown['executable-fix']).toEqual({ corrected: 2, attempted: 3 });
    } finally {
      rmSync(poisoned, { recursive: true, force: true });
    }
  }, 300_000);
});

describe('Business Rule 3: session token cost is recorded and published every run', () => {
  it('measures the cost on the real tiktoken-class meter, never a proxy', async () => {
    const tokenizer = (await import(
      join(REPO_ROOT, 'packages', 'spec', 'kit', 'budget', 'tokenizer.js')
    )) as { countTokens: (text: string) => number; ENCODINGS: readonly string[] };

    expect(tokenizer.ENCODINGS).toEqual(['o200k_base', 'cl100k_base']);
    expect(gate.record.sessionTokenCost).toBeGreaterThan(0);
    // A character-count proxy would be off by multiples; this is the real meter.
    const characters = sessionText(gate.priming, gate.transcripts).join('').length;

    expect(gate.record.sessionTokenCost).toBeLessThan(characters);
  });

  it('bills exactly the text that crossed into the session, recomputable from the transcript', async () => {
    const { countTokens } = (await import(
      join(REPO_ROOT, 'packages', 'spec', 'kit', 'budget', 'tokenizer.js')
    )) as { countTokens: (text: string) => number };
    const recomputed = sessionText(gate.priming, gate.transcripts).reduce(
      (total, text) => total + countTokens(text),
      0,
    );

    expect(recomputed).toBe(gate.record.sessionTokenCost);
  });

  it('bills the published priming snippet itself, once, and nothing else about it', () => {
    const text = sessionText(gate.priming, gate.transcripts);
    const published = readFileSync(join(REPO_ROOT, 'packages', 'spec', 'priming.md'), 'utf8').trim();

    expect(text[0]).toBe(published);
    expect(text.filter((one) => one === published)).toHaveLength(1);
  });

  it('publishes the cost on a failing run too, not only a favorable one', () => {
    const failing: BenchmarkResult = {
      ...gate,
      passed: false,
      failures: ['first-correction rate 50.0% is below the Operator baseline'],
    };
    const report = renderReport(failing).join('\n');

    expect(report).toContain('sessionTokenCost');
    expect(report).toContain(String(gate.record.sessionTokenCost));
    expect(report).toContain('RESULT  fail');
  });
});

describe('Business Rule 4: CC9 marker-freeze re-runs as part of this release gate', () => {
  it("re-invokes CC9's own existing scans as real subprocesses, never a reimplementation", () => {
    const scans = cc9Scans(REPO_ROOT);

    expect(scans.map((scan) => scan.args.filter((arg) => arg.includes('marker')))).toEqual([
      ['test/marker-freeze.test.ts', 'test/marker-purity.test.ts'],
      ['tests/test_marker_freeze.py', 'tests/test_marker_purity.py'],
    ]);
    for (const scan of scans) {
      for (const file of scan.args.filter((arg) => arg.includes('marker'))) {
        expect(readFileSync(join(scan.cwd, file), 'utf8').length).toBeGreaterThan(0);
      }
    }
  });

  it('names both implementations, the JavaScript core and the Python port', () => {
    expect(gate.cc9.scans.map((scan) => scan.name)).toEqual([
      'CC9 marker freeze, JavaScript core',
      'CC9 marker freeze, Python port',
    ]);
    expect(gate.cc9.passed).toBe(true);
    expect(gate.cc9.scans.every((scan) => scan.status === 0)).toBe(true);
  });

  it('fails the gate, and the run, when a marker-freeze scan really goes red', async () => {
    const red = await runBenchmark({
      repoRoot: REPO_ROOT,
      tasks: [taskById('transcode-a-clip-that-simply-works')],
      scans: [
        {
          name: 'CC9 marker freeze, a scan that really fails',
          command: process.execPath,
          args: ['-e', 'process.exit(1)'],
          cwd: REPO_ROOT,
        },
      ],
    });

    expect(red.cc9.passed).toBe(false);
    expect(red.cc9.scans[0]?.status).toBe(1);
    expect(red.passed).toBe(false);
    expect(red.failures.join(' ')).toContain('CC9 marker-freeze scan failed');
  }, 120_000);

  it('fails rather than skips when no usable Python interpreter is resolvable', () => {
    const empty = mkdtempSync(join(tmpdir(), 'no-python-'));
    try {
      const child = spawnSync(
        process.execPath,
        [
          '-e',
          `import(${JSON.stringify(join(REPO_ROOT, 'scripts', 'cold-agent-cc9.ts'))}).then((m) => { m.resolvePython(process.argv[1]); }).catch((e) => { process.stderr.write(e.message); process.exit(3); })`,
          empty,
        ],
        { encoding: 'utf8', env: { PATH: '', COMPREHENDO_PYTHON: join(empty, 'nope') } },
      );

      expect(child.status).toBe(3);
      expect(child.stderr).toContain('fails rather than skipping');
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('the published benchmark record', () => {
  it("carries exactly the Data Model's fields", () => {
    expect(Object.keys(gate.record).sort()).toEqual([
      'firstCorrectionRate',
      'runId',
      'sessionTokenCost',
      'sourceReadsOutsideGrant',
      'tasksAttempted',
      'tasksFirstCorrected',
    ]);
  });

  it('carries a fresh runId on every run', async () => {
    const again = await runBenchmark({
      repoRoot: REPO_ROOT,
      tasks: [taskById('transcode-a-clip-that-simply-works')],
      scans: [],
    });

    expect(again.record.runId).not.toBe(gate.record.runId);
    expect(again.record.runId).toMatch(/^cab-\d{4}-\d{2}-\d{2}T/);
  }, 120_000);

  it('computes firstCorrectionRate from the counts, never asserts it', () => {
    const half: readonly TaskTranscript[] = [
      { task: taskById('transcode-a-clip-that-simply-works'), observations: [{ kind: 'ran', status: 0, stderr: '' }], actions: [{ kind: 'run', argv: [] }, { kind: 'done', outcome: 'succeeded' }], sourceReadsOutsideGrant: 0 },
      { task: taskById('crop-and-transcode-a-video-to-720p'), observations: [], actions: [], sourceReadsOutsideGrant: 0 },
    ];
    const record = recordOf('cab-test', half, 42);

    expect(record.tasksAttempted).toBe(2);
    expect(record.tasksFirstCorrected).toBe(1);
    expect(record.firstCorrectionRate).toBe(0.5);
    expect(gate.record.firstCorrectionRate).toBe(
      gate.record.tasksFirstCorrected / gate.record.tasksAttempted,
    );
  });

  it('says which agent produced it, so a record cannot be read as the other tier', () => {
    expect(gate.agentLabel).toBe(SIMULATOR_LABEL);
    expect(renderReport(gate).join('\n')).toContain('measures the PROTOCOL');
  });

  it('refuses an unknown flag with the usage, exit 2', async () => {
    const lines: string[] = [];
    const code = await main(['--nonsense'], () => undefined, (line) => lines.push(line));

    expect(code).toBe(2);
    expect(lines.join('\n')).toContain('cold-agent-benchmark');
  });
});

describe('the live tier is a real session, and its scaffolding carries no corpus knowledge', () => {
  it('sends the published snippet as the whole system prompt, byte for byte', () => {
    const published = readFileSync(join(REPO_ROOT, 'packages', 'spec', 'priming.md'), 'utf8');

    expect(systemPromptOf(published)).toBe(published.trim());
  });

  it('names no twin code, topic or fix in the action menu', () => {
    const menu = ACTION_MENU.join('\n');

    for (const twin of twins.twins) expect(menu).not.toContain(twin.code);
    for (const task of failureTasks) expect(menu).not.toContain(task.stderrWitness ?? '');
    expect(menu).not.toContain('libx264');
  });

  it('measures an agent that treats an inert docs pointer as executable, never crashes on it', async () => {
    // Found by the live tier's own second run: a model answered apply_fix on a
    // runbook entry, whose fixes[0] carries no apply at all. The honest
    // consequence is a rerun of the SAME command, which fails identically, and
    // the task correctly does not count as first-corrected.
    const eager: Agent = (state) => {
      const last = state.observations[state.observations.length - 1];
      if (last === undefined) return { kind: 'run', argv: state.task.argv };
      if (last.kind === 'ran' && last.status !== 0 && state.attempts < 2) {
        return { kind: 'comprehend' };
      }
      if (last.kind === 'comprehended') {
        const fix = last.twin.fixes[0];
        return fix === undefined
          ? { kind: 'done', outcome: 'gave-up' }
          : { kind: 'apply-and-rerun', fix };
      }
      return { kind: 'done', outcome: 'gave-up' };
    };
    const pointerTask = taskById('an-unsupported-codec-was-requested');
    const eagerRun = await runBenchmark({
      repoRoot: REPO_ROOT,
      tasks: [pointerTask],
      agent: eager,
      scans: [],
    });
    const runs = eagerRun.transcripts[0]?.observations.filter((one) => one.kind === 'ran') ?? [];

    expect(runs).toHaveLength(2);
    expect(runs[1]?.status).not.toBe(0);
    expect(eagerRun.record.tasksFirstCorrected).toBe(0);
    expect(eagerRun.record.sourceReadsOutsideGrant).toBe(0);
  }, 120_000);

  it('records an unparseable reply as a give-up rather than re-prompting it', () => {
    const state: SessionState = {
      task: taskById('crop-and-transcode-a-video-to-720p'),
      observations: [],
      attempts: 0,
    };

    expect(actionFrom('I think you should try scaling differently.', state)).toBeUndefined();
    expect(actionFrom('{"action":"comprehend"}', state)).toEqual({ kind: 'comprehend' });
  });
});

describe('the process boundaries', () => {
  it('observes in the parent exactly what the real ffmpeg child wrote to stderr', () => {
    for (const task of failureTasks) {
      const transcript = gate.transcripts.find((one) => one.task.id === task.id);
      const ran = transcript?.observations.find((observation) => observation.kind === 'ran');

      expect(ran?.status, task.id).not.toBe(0);
      expect(ran?.stderr, task.id).toContain(task.stderrWitness);
      const twin = transcript?.observations.find(
        (observation) => observation.kind === 'comprehended',
      );

      expect(twin?.twin.code, task.id).toBe(task.expect);
    }
  });

  it('observes in the parent exactly what the real CC9 test-runner child recorded', () => {
    const report = runCc9Gate(cc9Scans(REPO_ROOT));

    expect(report.passed).toBe(true);
    for (const scan of report.scans) {
      expect(scan.status, scan.name).toBe(0);
      expect(scan.detail.length, scan.name).toBeGreaterThan(0);
    }
  }, 300_000);

  it('carries the exit-code contract across a real process boundary', () => {
    const child = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'cold-agent-benchmark.ts')], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 300_000,
    });

    expect(child.status).toBe(0);
    expect(child.stdout).toContain('RESULT  pass');
    expect(child.stdout).toMatch(/firstCorrectionRate\s+100\.0%/);
  }, 300_000);
});

afterAll(() => {
  // Nothing to clean: every run disposes of its own consumer tree.
});
