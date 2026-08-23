// Cold-Agent Benchmark [38]: the LIVE tier, a real isolated model session.
//
// The doc's literal reading of this feature is "an agent given only the
// Priming Snippet completes a scripted task suite". This file is that reading,
// executed: a freshly-spun language-model session whose ENTIRE system context
// is the bytes of `packages/spec/priming.md`, trimmed, and nothing else. The
// hash of what was sent is published with the run, so the claim is checkable
// rather than promised.
//
// WHY A LOCAL MODEL AND NOT A HOSTED ONE. There is no provider credential in
// this environment, and the one agent CLI that is on PATH was measured rather
// than assumed: `claude -p --system-prompt <priming.md>` still carries roughly
// 34,000 characters of harness context and eleven tool definitions, so its
// session is not "the snippet and nothing else" by three orders of magnitude.
// A local ollama session is, exactly. See JUDGMENT-38-cold-agent-benchmark.md,
// call 1.
//
// WHAT THIS TIER PROVES, PRECISELY. One real open-weights model's real
// behavior on this suite, given only those 144 tokens. It is corroboration,
// published beside the gate and never instead of it, and it says nothing about
// any other model. The gating number remains the deterministic faithful
// simulator, which is a claim about the PROTOCOL.
//
// THE ONE PIECE OF SCAFFOLDING, named out loud. A session with no tools needs
// a call convention, so each turn carries an action menu: the JSON shape of
// the actions the snippet itself already names (probe, comprehend, docs, apply
// fixes[0], read source, run the program). It adds no knowledge of Comprehendo
// beyond the snippet, and the suite asserts that the menu text mentions no
// twin code, no topic name and no fix.
//
// @see .mdd/docs/38-cold-agent-benchmark.md

import { createHash } from 'node:crypto';

import type { AgentAction, Observation, SessionState } from './cold-agent-suite.ts';

export interface LiveOptions {
  readonly endpoint?: string;
  readonly model?: string;
  readonly seed?: number;
  readonly maxTokens?: number;
}

const DEFAULTS = {
  endpoint: 'http://127.0.0.1:11434/api/chat',
  model: 'llama3',
  seed: 7,
  maxTokens: 160,
} as const;

/** One message as it really crossed into or out of the session. */
export interface LiveMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** What a live run observed about the session itself, published with the record. */
export interface LiveSessionReport {
  readonly model: string;
  readonly systemPromptSha256: string;
  readonly systemPromptChars: number;
  readonly turns: number;
  readonly unparseableReplies: number;
  readonly messages: readonly LiveMessage[];
}

/**
 * The action menu. Deliberately free of every Comprehendo-specific fact the
 * snippet does not already carry: no twin code, no topic name, no fix, no
 * package-specific advice. It is a calling convention and nothing more.
 */
export const ACTION_MENU: readonly string[] = Object.freeze([
  'Reply with ONLY one JSON object and no other text. The actions available to you:',
  '  {"action":"run","argv":["..."]}                 run the program with these arguments',
  '  {"action":"probe"}                              probe the value you caught',
  '  {"action":"comprehend"}                         call comprehend on the value you caught',
  '  {"action":"docs","pkg":"...","question":"..."}  call docs(pkg, question)',
  '  {"action":"apply_fix"}                          apply fixes[0] and rerun the same command',
  '  {"action":"read_source"}                        read the package source',
  '  {"action":"done"}                               stop, the task is finished',
]);

/** The system prompt, and nothing else: the published snippet's own bytes. */
export const systemPromptOf = (priming: string): string => priming.trim();

export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const render = (observation: Observation): string => {
  switch (observation.kind) {
    case 'ran':
      return observation.status === 0
        ? 'The command exited 0. Nothing was written to stderr that matters.'
        : `The command exited ${String(observation.status)}. Its stderr:\n${observation.stderr.trim()}`;
    case 'probed':
      return observation.marker === undefined
        ? 'The probe found no marker on the value you caught.'
        : `The probe found a marker: ${JSON.stringify(observation.marker)}`;
    case 'comprehended':
      return `comprehend returned:\n${JSON.stringify(observation.twin, null, 1)}`;
    case 'docs':
      return `docs returned:\n${JSON.stringify(observation.response, null, 1)}`;
    case 'source':
      return observation.text === ''
        ? 'That source read was refused.'
        : `The source of ${observation.path}:\n${observation.text}`;
  }
};

/** The conversation so far, rebuilt from the transcript. Stateless by design. */
export function messagesFor(
  priming: string,
  state: SessionState,
  replies: readonly string[],
): readonly LiveMessage[] {
  const messages: LiveMessage[] = [
    { role: 'system', content: systemPromptOf(priming) },
    {
      role: 'user',
      content: [
        `TASK: ${state.task.goal}`,
        `The tool is the ${state.task.pkg} package. Nothing else is installed for it.`,
        ...(state.task.argv.length === 0
          ? []
          : [`The command you would run is: ${state.task.pkg} ${state.task.argv.join(' ')}`]),
        '',
        ...ACTION_MENU,
      ].join('\n'),
    },
  ];
  state.observations.forEach((observation, at) => {
    const reply = replies[at];
    if (reply !== undefined) messages.push({ role: 'assistant', content: reply });
    messages.push({ role: 'user', content: `${render(observation)}\n\n${ACTION_MENU[0] ?? ''}` });
  });
  return Object.freeze(messages);
}

const firstJsonObject = (text: string): Record<string, unknown> | undefined => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The model's reply, turned into an action. An unparseable or unknown reply is
 * recorded as a give-up, never re-prompted: coaching a model back onto the
 * rails would be measuring the coaching.
 */
export function actionFrom(reply: string, state: SessionState): AgentAction | undefined {
  const parsed = firstJsonObject(reply);
  if (parsed === undefined) return undefined;
  const name = typeof parsed['action'] === 'string' ? parsed['action'] : '';
  const last = state.observations[state.observations.length - 1];
  switch (name) {
    case 'run':
      // The SUITE owns the invocation, always. A model rewriting the argument
      // vector by hand would be guessing at the API, which is the first thing
      // the snippet forbids, and it would also mean each run induced a
      // different failure and measured a different thing. Stated here rather
      // than left implicit: the model chooses WHEN to run, never WHAT to run.
      return { kind: 'run', argv: state.task.argv };
    case 'probe':
      return { kind: 'probe' };
    case 'comprehend':
      return { kind: 'comprehend' };
    case 'docs': {
      const pkg = typeof parsed['pkg'] === 'string' ? parsed['pkg'] : state.task.pkg;
      const question =
        typeof parsed['question'] === 'string' ? parsed['question'] : state.task.goal;
      return { kind: 'docs', pkg, question };
    }
    case 'apply_fix': {
      const fix = last?.kind === 'comprehended' ? last.twin.fixes[0] : undefined;
      return fix === undefined ? { kind: 'done', outcome: 'gave-up' } : { kind: 'apply-and-rerun', fix };
    }
    case 'read_source':
      return { kind: 'read-source', question: state.task.goal };
    case 'done':
      return { kind: 'done', outcome: 'answered' };
    default:
      return undefined;
  }
}

/** A live agent, plus the session report it accumulates as it goes. */
export interface LiveAgent {
  readonly agent: (state: SessionState) => Promise<AgentAction>;
  readonly report: () => LiveSessionReport;
}

/**
 * Drive a real model session. One HTTP call per turn, temperature 0, a fixed
 * seed, and the whole conversation resent each turn so the session state is
 * the transcript and nothing hidden.
 */
export function createLiveAgent(priming: string, options: LiveOptions = {}): LiveAgent {
  const endpoint = options.endpoint ?? DEFAULTS.endpoint;
  const model = options.model ?? DEFAULTS.model;
  const seed = options.seed ?? DEFAULTS.seed;
  const maxTokens = options.maxTokens ?? DEFAULTS.maxTokens;
  const system = systemPromptOf(priming);
  const transcript: LiveMessage[] = [];
  let replies: string[] = [];
  let turns = 0;
  let unparseable = 0;
  let previousTask = '';

  const agent = async (state: SessionState): Promise<AgentAction> => {
    if (state.task.id !== previousTask) {
      previousTask = state.task.id;
      replies = [];
    }
    const messages = messagesFor(priming, state, replies);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: { temperature: 0, seed, num_predict: maxTokens },
        messages,
      }),
    });
    if (!response.ok) {
      throw new Error(`the live session endpoint ${endpoint} answered ${String(response.status)}`);
    }
    const body = (await response.json()) as { message?: { content?: string } };
    const reply = body.message?.content ?? '';
    turns += 1;
    replies.push(reply);
    // The system prompt is billed once for the whole benchmark, the way a
    // session really carries it; every turn's newest user message and the
    // model's own reply are billed as they really crossed.
    if (transcript.length === 0) transcript.push({ role: 'system', content: system });
    const newest = messages[messages.length - 1];
    if (newest !== undefined) transcript.push(newest);
    transcript.push({ role: 'assistant', content: reply });
    const action = actionFrom(reply, state);
    if (action === undefined) unparseable += 1;
    return action ?? { kind: 'done', outcome: 'gave-up' };
  };

  return {
    agent,
    report: (): LiveSessionReport => ({
      model,
      systemPromptSha256: sha256(system),
      systemPromptChars: system.length,
      turns,
      unparseableReplies: unparseable,
      messages: Object.freeze([...transcript]),
    }),
  };
}
