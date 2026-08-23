#!/usr/bin/env node
// Cold-Agent Benchmark [38]: the number the whole project claims, measured.
//
// This is the impure half. It installs the real packed ffmpeg corpus into a
// real consumer tree, builds a real `Router` over it through Router &
// Precedence [22]'s own `discoverInstalledCorpora`, runs the real `ffmpeg`
// binary to induce every failure the corpus catalogs, hands each real stderr
// to the real `comprehend`, applies the real `fixes[0]` and really retries,
// meters the whole session on the real budget tokenizer, and re-runs CC9
// Marker Freeze [10]'s own scans as real subprocesses before it will report a
// pass. Nothing here is doubled.
//
// WHAT THIS PROVES, AND WHAT IT DOES NOT. The default agent is the FAITHFUL
// SIMULATOR in `cold-agent-suite.ts`: the priming snippet's own instructions,
// mechanically followed. So the gating number is a claim about the PROTOCOL,
// namely that a faithful reader of 144 published tokens has everything needed
// to resolve every cataloged failure on the first correction, without ever
// reading source. It is NOT a claim about how a given language model behaves
// when handed that text. That needs a live session, and `--live-agent` is it:
// a real isolated model session whose entire system prompt is byte-identical
// to `packages/spec/priming.md`, published separately and never gating. See
// JUDGMENT-38-cold-agent-benchmark.md, call 1.
//
// EXIT CODES ARE THE CONTRACT, same vocabulary as [35] and [17]:
//   0  the release gate passed
//   1  a business rule failed (rate, an ungranted source read, or CC9)
//   2  a precondition the caller can fix (no ffmpeg, no build, no interpreter)
//   70 a bug in this tool, reported with its stack
//
// @see .mdd/docs/38-cold-agent-benchmark.md

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { applyToArgv } from './cold-agent-apply.ts';
import { Cc9PreconditionError, cc9Scans, runCc9Gate } from './cold-agent-cc9.ts';
import { createLiveAgent } from './cold-agent-live.ts';
import type { Cc9Report, Cc9Scan } from './cold-agent-cc9.ts';
import { PreconditionError, ffmpeg, ffmpegVersion, prepareHarness, prepareWorkspace } from './cold-agent-harness.ts';
import type { Harness } from './cold-agent-harness.ts';
import {
  OPERATOR_BASELINE,
  breakdownOf,
  faithfulAgent,
  operatorBaselineFor,
  recordOf,
  sessionText,
  sourceReadGranted,
} from './cold-agent-suite.ts';
import type {
  AgentAction,
  BenchmarkRecord,
  Observation,
  SessionState,
  Task,
  TaskKind,
  TaskTranscript,
} from './cold-agent-suite.ts';
import { TASKS, UNADOPTED_SOURCE } from './cold-agent-tasks.ts';

export { PreconditionError } from './cold-agent-harness.ts';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname);

/** Nothing routes for more than this many steps; a loop is a bug, not a result. */
const STEP_CEILING = 12;

// --- one task ---------------------------------------------------------------

/**
 * Async because the live tier's agent is a real network round trip to a real
 * model session. The faithful simulator is synchronous and is awaited anyway,
 * so both tiers run through exactly one loop and neither gets a private one.
 */
export type Agent = (state: SessionState) => AgentAction | Promise<AgentAction>;

/**
 * One task, played out for real.
 *
 * An ungranted source read is COUNTED AND REFUSED rather than counted and
 * performed: the benchmark's job here is to measure the violation, and
 * actually opening the file would add nothing to the measurement while making
 * this harness do the very thing it exists to forbid.
 */
export async function runTask(
  task: Task,
  harness: Harness,
  agent: Agent,
): Promise<TaskTranscript> {
  const cwd = prepareWorkspace(task, harness.root);
  const observations: Observation[] = [];
  const actions: AgentAction[] = [];
  let outsideGrant = 0;
  let attempts = 0;
  let argv = task.argv;
  let caught: unknown = undefined;

  for (let step = 0; step < STEP_CEILING; step += 1) {
    const action = await agent({ task, observations, attempts });
    actions.push(action);
    if (action.kind === 'done') break;
    switch (action.kind) {
      case 'run': {
        const result = ffmpeg(action.argv, cwd);
        attempts += 1;
        argv = action.argv;
        caught = result.stderr;
        observations.push({ kind: 'ran', status: result.status, stderr: result.stderr });
        break;
      }
      case 'probe':
        observations.push({ kind: 'probed', marker: harness.probe(caught) });
        break;
      case 'comprehend':
        observations.push({ kind: 'comprehended', twin: harness.router.comprehend(caught) });
        break;
      case 'docs':
        observations.push({
          kind: 'docs',
          response: harness.router.docs(action.pkg, action.question),
        });
        break;
      case 'apply-and-rerun': {
        // A fix with no `apply` is an inert docs pointer; "applying" it changes
        // nothing about the command, so the rerun is the SAME argv and fails
        // identically. Recorded rather than refused, because an agent that
        // treats a pointer as executable is making a real mistake and the rate
        // has to see it. Found by the live tier's second real run, where the
        // model did exactly that on a runbook entry.
        const corrected =
          action.fix.apply === undefined
            ? argv
            : applyToArgv(argv, action.fix.apply, harness.declaredOperations);
        const result = ffmpeg(corrected, cwd);
        attempts += 1;
        argv = corrected;
        caught = result.stderr;
        observations.push({ kind: 'ran', status: result.status, stderr: result.stderr });
        break;
      }
      case 'read-source': {
        if (!sourceReadGranted(observations)) {
          outsideGrant += 1;
          observations.push({
            kind: 'source',
            path: '<refused: no UNDOCUMENTED grant preceded this read>',
            text: '',
          });
          break;
        }
        // The grant is real, so the pass is really taken. A target that ships
        // no readable module source (ffmpeg is a program, not a package) gets
        // the honest answer rather than a crash: that is what the permitted
        // pass really finds, and pretending otherwise would be the folklore
        // this project refuses. Found by the live tier's first real run, where
        // the model spent its grant on the CLI target.
        const path = join(harness.root, 'node_modules', task.pkg, UNADOPTED_SOURCE);
        const text = existsSync(path)
          ? readFileSync(path, 'utf8')
          : `there is no readable module source at ${path}: ${task.pkg} ships no importable source in this tree`;
        observations.push({ kind: 'source', path, text });
        break;
      }
    }
  }
  return { task, observations, actions, sourceReadsOutsideGrant: outsideGrant };
}

// --- the run ----------------------------------------------------------------

export interface BenchmarkOptions {
  readonly repoRoot?: string;
  readonly corpusDir?: string;
  readonly tasks?: readonly Task[];
  readonly agent?: Agent;
  /** What ran, in one line, published so a record can never be read as the other tier's. */
  readonly agentLabel?: string;
  readonly scans?: readonly Cc9Scan[];
}

export const SIMULATOR_LABEL =
  'faithful simulator of packages/spec/priming.md (deterministic, measures the PROTOCOL)';

export interface BenchmarkResult {
  readonly record: BenchmarkRecord;
  readonly agentLabel: string;
  readonly breakdown: Readonly<Record<TaskKind, { readonly corrected: number; readonly attempted: number }>>;
  readonly transcripts: readonly TaskTranscript[];
  readonly cc9: Cc9Report;
  readonly ffmpeg: string;
  readonly priming: string;
  /**
   * The rate this run was really judged against: `operatorBaselineFor`'s
   * answer for the tasks really run and the binary really installed, which
   * is below the Operator's nominal `OPERATOR_BASELINE` exactly when a task
   * is real-ffmpeg-exit-code-undetectable on this major (see that
   * function's own comment). Published beside the nominal figure, never in
   * its place, so a reader sees both what was reachable here and what the
   * Operator's own reference figure is.
   */
  readonly baseline: number;
  readonly passed: boolean;
  readonly failures: readonly string[];
}

const runId = (): string =>
  `cab-${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;

/** The whole release gate: the suite, the meter, and CC9, in one run. */
export async function runBenchmark(options: BenchmarkOptions = {}): Promise<BenchmarkResult> {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const version = ffmpegVersion();
  const priming = readFileSync(join(repoRoot, 'packages', 'spec', 'priming.md'), 'utf8');
  const harness = await prepareHarness(options.corpusDir ?? join(repoRoot, 'corpora', 'ffmpeg'));
  const agent = options.agent ?? faithfulAgent;
  const transcripts: TaskTranscript[] = [];
  try {
    // Sequential on purpose: a session is one conversation, and a live model
    // session cannot be run fourteen ways at once and still be one session.
    for (const task of options.tasks ?? TASKS) {
      transcripts.push(await runTask(task, harness, agent));
    }
  } finally {
    harness.cleanup();
  }

  const cost = sessionText(priming, transcripts).reduce(
    (total, text) => total + harness.countTokens(text),
    0,
  );
  const record = recordOf(runId(), transcripts, cost);
  const cc9 = runCc9Gate(options.scans ?? cc9Scans(repoRoot));

  // The REACHABLE baseline for the binary really installed, not always the
  // Operator's nominal 18/18: a task whose real, version-scoped exit status
  // is 0 (verified: FFMPEG_OUTPUT_EXISTS on ffmpeg's >=6 <8 line) tells a
  // caller trusting the program's own exit code that nothing failed, which
  // is a real ffmpeg regression the hundred-token snippet is not the place
  // to work around. See operatorBaselineFor's own comment.
  const baseline = operatorBaselineFor(options.tasks ?? TASKS, version);
  const failures: string[] = [];
  if (record.firstCorrectionRate < baseline) {
    failures.push(
      `first-correction rate ${(record.firstCorrectionRate * 100).toFixed(1)}% is below the ` +
        `reachable baseline of ${(baseline * 100).toFixed(1)}% on ${version} ` +
        `(the Operator's nominal 18/18 is ${(OPERATOR_BASELINE * 100).toFixed(1)}%)`,
    );
  }
  if (record.sourceReadsOutsideGrant > 0) {
    failures.push(
      `${String(record.sourceReadsOutsideGrant)} source read(s) taken outside an UNDOCUMENTED grant`,
    );
  }
  if (!cc9.passed) {
    for (const scan of cc9.scans.filter((one) => !one.passed)) {
      failures.push(`CC9 marker-freeze scan failed: ${scan.name} (exit ${String(scan.status)})`);
    }
  }
  return {
    record,
    agentLabel: options.agentLabel ?? SIMULATOR_LABEL,
    breakdown: breakdownOf(transcripts),
    transcripts,
    cc9,
    ffmpeg: version,
    priming: priming.trim(),
    baseline,
    passed: failures.length === 0,
    failures: Object.freeze(failures),
  };
}

// --- publication ------------------------------------------------------------

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/**
 * The published record. Printed on EVERY run, passing or failing, because a
 * token cost that only appears when it looks favorable is not a published
 * number (this feature's own Business Rule 3).
 */
export function renderReport(result: BenchmarkResult): readonly string[] {
  const record = result.record;
  const lines: string[] = [
    `cold-agent benchmark ${record.runId}`,
    `  agent            ${result.agentLabel}`,
    `  target           ${result.ffmpeg}`,
    `  tasksAttempted           ${String(record.tasksAttempted)}`,
    `  tasksFirstCorrected      ${String(record.tasksFirstCorrected)}`,
    `  firstCorrectionRate      ${pct(record.firstCorrectionRate)} (baseline ${pct(result.baseline)} reachable on ${result.ffmpeg}, the Operator's nominal figure is ${pct(OPERATOR_BASELINE)}, 18/18)`,
    `  sourceReadsOutsideGrant  ${String(record.sourceReadsOutsideGrant)}`,
    `  sessionTokenCost         ${String(record.sessionTokenCost)} tokens (js-tiktoken, the CC5 meter)`,
    '  breakdown',
  ];
  for (const [kind, counts] of Object.entries(result.breakdown)) {
    lines.push(`    ${kind.padEnd(16)} ${String(counts.corrected)}/${String(counts.attempted)}`);
  }
  lines.push('  CC9 marker freeze');
  for (const scan of result.cc9.scans) {
    lines.push(`    ${scan.passed ? 'pass' : 'FAIL'}  ${scan.name}  (${scan.invocation})`);
  }
  for (const transcript of result.transcripts) {
    const mark = transcript.sourceReadsOutsideGrant > 0 ? 'VIOLATION' : '';
    lines.push(`  task  ${transcript.task.id.padEnd(48)} ${transcript.task.expect} ${mark}`.trimEnd());
  }
  for (const failure of result.failures) lines.push(`  FAIL  ${failure}`);
  lines.push(result.passed ? '  RESULT  pass' : '  RESULT  fail');
  return Object.freeze(lines);
}

type Writer = (line: string) => void;

export const USAGE: readonly string[] = Object.freeze([
  'cold-agent-benchmark [--out <file>] [--corpus <dir>] [--live-agent [model]]',
  '',
  '  --out <file>          also write the run record as JSON',
  '  --corpus <dir>        benchmark a different corpus directory',
  '  --live-agent [model]  ALSO run the suite through a real isolated model',
  '                        session whose entire system prompt is the bytes of',
  '                        packages/spec/priming.md. Published beside the gate,',
  '                        never instead of it, and never gating: it measures a',
  '                        model, and the gate measures the protocol.',
]);

/**
 * The live tier, run only when it is asked for. Its numbers are printed with
 * the model and the hash of the system prompt beside them, and its pass/fail
 * never touches the exit code.
 */
async function liveTier(model: string, out: Writer, corpusDir?: string): Promise<void> {
  const priming = readFileSync(join(REPO_ROOT, 'packages', 'spec', 'priming.md'), 'utf8');
  const live = createLiveAgent(priming, { model });
  const result = await runBenchmark({
    agent: live.agent,
    agentLabel: `LIVE isolated ${model} session (measures a MODEL, not the protocol; not gating)`,
    // CC9 is the gate's business, and re-running it twice in one invocation
    // would say nothing new.
    scans: [],
    ...(corpusDir === undefined ? {} : { corpusDir }),
  });
  const session = live.report();
  out('');
  for (const line of renderReport(result)) out(line);
  out(`  live model               ${session.model}`);
  out(`  system prompt sha256     ${session.systemPromptSha256}`);
  out(`  system prompt chars      ${String(session.systemPromptChars)} (the whole session context)`);
  out(`  model turns              ${String(session.turns)}`);
  out(`  unparseable replies      ${String(session.unparseableReplies)}`);
  out('  NOTE  this tier is corroboration, not the gate: it measures one model.');
}

export async function main(argv: readonly string[], out: Writer, err: Writer): Promise<number> {
  let outFile: string | undefined;
  let corpusDir: string | undefined;
  let liveModel: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';
    const value = argv[index + 1];
    if (argument === '--live-agent') {
      liveModel = value !== undefined && !value.startsWith('--') ? value : 'llama3';
      if (liveModel === value) index += 1;
    } else if (argument === '--out' || argument === '--corpus') {
      if (value === undefined) {
        err(`${argument} needs a path`);
        return 2;
      }
      if (argument === '--out') outFile = isAbsolute(value) ? value : resolve(value);
      else corpusDir = isAbsolute(value) ? value : resolve(value);
      index += 1;
    } else {
      err(USAGE.join('\n'));
      return 2;
    }
  }
  let result: BenchmarkResult;
  try {
    result = await runBenchmark({
      ...(corpusDir === undefined ? {} : { corpusDir }),
    });
    for (const line of renderReport(result)) out(line);
    if (liveModel !== undefined) await liveTier(liveModel, out, corpusDir);
  } catch (error) {
    if (error instanceof PreconditionError || error instanceof Cc9PreconditionError) {
      err(error.message);
      return 2;
    }
    throw error;
  }
  if (outFile !== undefined) {
    writeFileSync(outFile, `${JSON.stringify(result.record, null, 2)}\n`);
    out(`  wrote ${outFile}`);
  }
  return result.passed ? 0 : 1;
}

/** Invoked as a script, not imported: run the verb and carry its exit code. */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(
    process.argv.slice(2),
    (line) => process.stdout.write(`${line}\n`),
    (line) => process.stderr.write(`${line}\n`),
  )
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String((error as Error).stack ?? error)}\n`);
      process.exitCode = 70;
    });
}
