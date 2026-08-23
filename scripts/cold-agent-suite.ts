// Cold-Agent Benchmark [38]: the scripted task suite and the faithful agent.
//
// This is the PURE half. It imports no `node:` module at all, which is what
// makes the headline safety claim a property of the module rather than a
// promise in a comment: an agent policy that cannot open a file cannot read a
// package's source behind the grant's back. The one action that reads source
// is emitted from exactly one branch here (`case 'docs'`, and only when the
// answer was `UNDOCUMENTED`), and `packages/registry-tools/test/
// cold-agent-benchmark.test.ts` asserts that exhaustively over every
// observation shape rather than trusting the reading.
//
// The policy is not invented. It is Priming Snippet [36]'s published text,
// sentence by sentence, and nothing else:
//
//   "probe the handle or caught error for the marker"        -> 'probe'
//   "On a hit, call .docs(question) in any vocabulary"       -> 'docs' (native)
//   "No marker: call comprehend(raw) ... from comprehendo"   -> 'comprehend'
//   "read reason, apply fixes[0]"                            -> 'apply-and-rerun'
//   "Undocumented means nonexistent: never read source,
//    unless docs answered UNDOCUMENTED, which permits one
//    source pass for that question"                          -> 'read-source'
//
// The impure half (`cold-agent-benchmark.ts`) executes these actions against
// the real ffmpeg binary and the real router, and meters what they cost.
//
// @see .mdd/docs/38-cold-agent-benchmark.md
// @see packages/spec/priming.md

// --- what the corpus hands back ---------------------------------------------

/** A fix as it arrives on a twin. `apply` is literal call data, or absent. */
export interface FixLike {
  readonly title: string;
  readonly apply?: unknown;
  readonly docs?: string;
  readonly confidence?: string;
}

/** A twin as it arrives from `comprehend(raw)`. */
export interface TwinLike {
  readonly comprehendo: string;
  readonly code: string;
  readonly reason: string;
  readonly fixes: readonly FixLike[];
}

/** Any of Docs Engine [13]'s three answers: an index, a topic, or the honest miss. */
export interface DocsLike {
  readonly code?: string;
  readonly query?: string;
  readonly topic?: string;
  readonly summary?: string;
  readonly topics?: readonly string[];
  readonly nearest?: readonly string[];
  readonly source_permitted?: boolean;
}

// --- the session ------------------------------------------------------------

/** What the session has just seen. One entry per real thing that happened. */
export type Observation =
  | { readonly kind: 'ran'; readonly status: number; readonly stderr: string }
  | { readonly kind: 'probed'; readonly marker: unknown }
  | { readonly kind: 'comprehended'; readonly twin: TwinLike }
  | { readonly kind: 'docs'; readonly response: DocsLike }
  | { readonly kind: 'source'; readonly path: string; readonly text: string };

/** What the agent decided to do next. */
export type AgentAction =
  | { readonly kind: 'run'; readonly argv: readonly string[] }
  | { readonly kind: 'probe' }
  | { readonly kind: 'comprehend' }
  | { readonly kind: 'docs'; readonly pkg: string; readonly question: string }
  | { readonly kind: 'apply-and-rerun'; readonly fix: FixLike }
  | { readonly kind: 'read-source'; readonly question: string }
  | { readonly kind: 'done'; readonly outcome: 'succeeded' | 'answered' | 'gave-up' };

/** How a task's workspace is prepared, declaratively, so this file stays pure. */
export type Fixture =
  | { readonly make: 'video'; readonly name: string; readonly size?: string }
  | { readonly make: 'video-with-audio'; readonly name: string }
  | { readonly make: 'text'; readonly name: string };

/** What kind of correction a task's success condition is. */
export type TaskKind = 'executable-fix' | 'inert-pointer' | 'clean' | 'honest-miss';

export interface Task {
  readonly id: string;
  /** The task as a human would give it, and the only vocabulary the agent gets. */
  readonly goal: string;
  readonly kind: TaskKind;
  readonly pkg: string;
  /** The twin code this failure is cataloged under, `OK`, or `UNDOCUMENTED`. */
  readonly expect: string;
  readonly argv: readonly string[];
  readonly fixture?: Fixture;
  /** honest-miss only: the question with no cataloged answer. */
  readonly question?: string;
  /** A literal fragment of the stderr the real binary really writes. */
  readonly stderrWitness?: string;
}

export interface SessionState {
  readonly task: Task;
  readonly observations: readonly Observation[];
  /** Completed invocations of the target. The retry budget, not a step count. */
  readonly attempts: number;
}

/**
 * One correction. The snippet says "apply `fixes[0]`", singular, so a second
 * corrective cycle is not a slower success, it is a miss, and the rate has to
 * see it that way or "first-correction" means nothing.
 */
export const CORRECTION_BUDGET = 2;

/**
 * The Operator's measured baseline: 18 of 18 structured error cycles resolved
 * on the very next attempt. A rate, not a task count, which is why this suite
 * is derived from the corpus rather than padded to eighteen entries.
 */
export const OPERATOR_BASELINE = 1;

// --- the faithful agent -----------------------------------------------------

const lastOf = (state: SessionState): Observation | undefined =>
  state.observations[state.observations.length - 1];

/**
 * The next action, from the priming snippet alone.
 *
 * THE ONE RULE THIS FUNCTION EXISTS TO MAKE CHECKABLE: `read-source` is
 * returned from the `'docs'` case, and only when that answer was
 * `UNDOCUMENTED`. Every other branch returns something else, always. The
 * suite asserts this exhaustively; do not add a second return of it.
 */
export function faithfulAgent(state: SessionState): AgentAction {
  const task = state.task;
  const last = lastOf(state);

  if (last === undefined) {
    // Nothing has happened yet. A task with no invocation to make is a
    // question, and the snippet's answer to a question about an un-adopted
    // package is `docs(pkg, question)`.
    return task.argv.length === 0
      ? { kind: 'docs', pkg: task.pkg, question: task.question ?? task.goal }
      : { kind: 'run', argv: task.argv };
  }

  switch (last.kind) {
    case 'ran': {
      if (last.status === 0) return { kind: 'done', outcome: 'succeeded' };
      if (state.attempts >= CORRECTION_BUDGET) return { kind: 'done', outcome: 'gave-up' };
      // "Before guessing at any API, probe the ... caught error for the marker."
      return { kind: 'probe' };
    }
    case 'probed': {
      // "On a hit, call `.docs(question)`" / "No marker: call `comprehend(raw)`".
      return last.marker === undefined
        ? { kind: 'comprehend' }
        : { kind: 'docs', pkg: task.pkg, question: task.goal };
    }
    case 'comprehended': {
      const twin = last.twin;
      const fix = twin.fixes[0];
      // An honest UNSTRUCTURED is not an answer; the snippet's other call is.
      if (twin.code === 'UNSTRUCTURED' || fix === undefined) {
        return { kind: 'docs', pkg: task.pkg, question: task.goal };
      }
      // "read `reason`, apply `fixes[0]`". A fix with no `apply` is an inert
      // docs pointer, so applying it means following the pointer.
      return fix.apply === undefined
        ? { kind: 'docs', pkg: task.pkg, question: fix.docs ?? task.goal }
        : { kind: 'apply-and-rerun', fix };
    }
    case 'docs': {
      const response = last.response;
      if (response.code === 'UNDOCUMENTED' && response.source_permitted === true) {
        // "never read source, unless docs answered UNDOCUMENTED, which permits
        // ONE source pass FOR THAT QUESTION." The only source read in the
        // whole policy, and it carries the question the grant was issued for.
        return { kind: 'read-source', question: response.query ?? task.goal };
      }
      return typeof response.topic === 'string'
        ? { kind: 'done', outcome: 'answered' }
        : { kind: 'done', outcome: 'gave-up' };
    }
    case 'source':
      // The grant was for one pass, and it is spent.
      return { kind: 'done', outcome: 'answered' };
  }
}

/** Whether an action reads a package's source. One place, so nothing drifts. */
export const readsSource = (action: AgentAction): boolean => action.kind === 'read-source';

/**
 * Whether a source read was granted: the immediately preceding thing the
 * session saw was `docs` answering `UNDOCUMENTED` with `source_permitted`.
 * Evaluated against the transcript, never against the policy's own say-so, so
 * a policy that emits the action from anywhere else is counted as a violation.
 */
export function sourceReadGranted(before: readonly Observation[]): boolean {
  const last = before[before.length - 1];
  if (last === undefined || last.kind !== 'docs') return false;
  return last.response.code === 'UNDOCUMENTED' && last.response.source_permitted === true;
}

// --- scoring ----------------------------------------------------------------

/** One task's transcript, as the runner recorded it really happening. */
export interface TaskTranscript {
  readonly task: Task;
  readonly observations: readonly Observation[];
  readonly actions: readonly AgentAction[];
  readonly sourceReadsOutsideGrant: number;
}

const twinsIn = (t: TaskTranscript): readonly TwinLike[] =>
  t.observations.flatMap((o) => (o.kind === 'comprehended' ? [o.twin] : []));

const runsIn = (t: TaskTranscript): readonly { status: number }[] =>
  t.observations.flatMap((o) => (o.kind === 'ran' ? [{ status: o.status }] : []));

const docsIn = (t: TaskTranscript): readonly DocsLike[] =>
  t.observations.flatMap((o) => (o.kind === 'docs' ? [o.response] : []));

/**
 * Did this task resolve on the FIRST correction? One definition per task kind,
 * every one of them stated out loud, because a single rate over four different
 * success conditions is only honest if each condition is written down.
 */
export function firstCorrected(transcript: TaskTranscript): boolean {
  if (transcript.sourceReadsOutsideGrant > 0) return false;
  const task = transcript.task;
  const runs = runsIn(transcript);
  const twins = twinsIn(transcript);
  const answers = docsIn(transcript);
  const routedRight = twins.length > 0 && twins[0]?.code === task.expect;

  switch (task.kind) {
    case 'clean':
      // Exit 0 first try, and not one protocol call made on a working case.
      return (
        runs.length === 1 &&
        runs[0]?.status === 0 &&
        twins.length === 0 &&
        answers.length === 0 &&
        transcript.actions.every((a) => a.kind === 'run' || a.kind === 'done')
      );
    case 'executable-fix':
      // The right twin on the first comprehend, and `fixes[0]` really works.
      return routedRight && runs.length === 2 && runs[1]?.status === 0;
    case 'inert-pointer':
      // The right twin on the first comprehend, and the pointer really lands.
      return routedRight && typeof answers[0]?.topic === 'string';
    case 'honest-miss':
      // The miss is honest, the grant is real, and the one pass answered it.
      return (
        answers[0]?.code === 'UNDOCUMENTED' &&
        answers[0]?.source_permitted === true &&
        transcript.observations.some((o) => o.kind === 'source')
      );
  }
}

/** The Data Model's record, exactly these six fields and no others. */
export interface BenchmarkRecord {
  readonly runId: string;
  readonly tasksAttempted: number;
  readonly tasksFirstCorrected: number;
  readonly sourceReadsOutsideGrant: number;
  readonly sessionTokenCost: number;
  readonly firstCorrectionRate: number;
}

/** The rate, computed from the counts. Never a number anyone typed. */
export function recordOf(
  runId: string,
  transcripts: readonly TaskTranscript[],
  sessionTokenCost: number,
): BenchmarkRecord {
  const tasksAttempted = transcripts.length;
  const tasksFirstCorrected = transcripts.filter((t) => firstCorrected(t)).length;
  return Object.freeze({
    runId,
    tasksAttempted,
    tasksFirstCorrected,
    sourceReadsOutsideGrant: transcripts.reduce((n, t) => n + t.sourceReadsOutsideGrant, 0),
    sessionTokenCost,
    firstCorrectionRate: tasksAttempted === 0 ? 0 : tasksFirstCorrected / tasksAttempted,
  });
}

/** The per-kind breakdown the single rate is computed from, published with it. */
export function breakdownOf(
  transcripts: readonly TaskTranscript[],
): Readonly<Record<TaskKind, { readonly corrected: number; readonly attempted: number }>> {
  const kinds: readonly TaskKind[] = ['executable-fix', 'inert-pointer', 'clean', 'honest-miss'];
  const entries = kinds.map((kind) => {
    const mine = transcripts.filter((t) => t.task.kind === kind);
    return [kind, { corrected: mine.filter((t) => firstCorrected(t)).length, attempted: mine.length }] as const;
  });
  return Object.freeze(Object.fromEntries(entries)) as Readonly<
    Record<TaskKind, { readonly corrected: number; readonly attempted: number }>
  >;
}

/**
 * Every piece of text that really crossed into the session's context, in
 * order: the priming snippet once, then each task's goal and each observation
 * rendered the way it would arrive. The meter bills this and nothing else, so
 * the published cost is recomputable from the transcript by anyone.
 */
export function sessionText(
  priming: string,
  transcripts: readonly TaskTranscript[],
): readonly string[] {
  const text: string[] = [priming.trim()];
  for (const transcript of transcripts) {
    text.push(transcript.task.goal);
    for (const observation of transcript.observations) {
      switch (observation.kind) {
        case 'ran':
          text.push(observation.stderr);
          break;
        case 'probed':
          text.push(observation.marker === undefined ? 'undefined' : JSON.stringify(observation.marker));
          break;
        case 'comprehended':
          text.push(JSON.stringify(observation.twin));
          break;
        case 'docs':
          text.push(JSON.stringify(observation.response));
          break;
        case 'source':
          text.push(observation.text);
          break;
      }
    }
  }
  return Object.freeze(text);
}

