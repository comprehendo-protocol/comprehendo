// Submission Gate [29]: the three lints that read a corpus's own text.
//
// The loop lint (this feature's own rule): a topic whose operation has
// cataloged twins shows at least one of them in its worked examples, so errors
// point at docs and docs point back at errors. A corpus where the two halves
// never reference each other is two documents, not one loop.
//
// The danger lint and the injection lint (CC11 [25]) are additive to
// truth-verification, never substitutes for it: a corpus can be perfectly
// truthful about a real destructive operation and still not be something a bot
// lands, and it can be perfectly truthful and still carry prose addressed to
// the agent instead of describing the tool.
//
// Both lints are TABLES, and a table is a floor rather than a proof. That is
// stated here rather than implied: neither table can be complete, and the one
// thing worse than a floor is a check that reports itself as a ceiling. What
// makes them worth having is that the failures they do catch are silent
// otherwise, and every entry in each table is matched on token boundaries, so
// the floor is not bought with false positives on ordinary corpus prose.

import { applyOperations } from './corpus-apply.js';
import type { CorpusFix, CorpusSource, CorpusTopic } from './corpus-source.js';
import { finding, type GateFinding, type SubmissionCorpus } from './gate-result.js';

/**
 * Destructive verbs, matched as whole tokens of an operation name (so
 * `purgeFrames` is destructive and `transform` is not). Names, not behaviors:
 * nothing in a corpus declares which of a provider's operations destroy data,
 * so the honest check is on the vocabulary every tool class actually uses.
 */
export const DESTRUCTIVE_OPERATIONS: readonly string[] = Object.freeze([
  'delete',
  'destroy',
  'drop',
  'erase',
  'kill',
  'overwrite',
  'prune',
  'purge',
  'remove',
  'reset',
  'revoke',
  'rm',
  'truncate',
  'unlink',
  'wipe',
]);

/**
 * Destructive OPERANDS: the flags that make an otherwise ordinary call
 * destructive. `-y` is the flagship case, ffmpeg's "overwrite the output file
 * without asking", which is invisible to any check that only reads operation
 * names.
 */
export const DESTRUCTIVE_OPERANDS: readonly string[] = Object.freeze([
  '-y',
  '--yes',
  '--force',
  '--overwrite',
  'rm -rf',
]);

/**
 * Instruction-shaped phrases: text addressed to the agent reading the corpus
 * rather than describing the tool the corpus is about. Second-person
 * directives are in the table on purpose, not by accident: CC11 says corpus
 * text is about the tool, never addressed to the agent, so "you must run" is
 * the rule's subject and not a false positive.
 */
export const INSTRUCTION_PHRASES: readonly string[] = Object.freeze([
  'ignore previous instructions',
  'ignore all previous',
  'ignore the above',
  'disregard previous',
  'disregard the above',
  'disregard all',
  'system prompt',
  'as an ai',
  'you are an ai',
  'you are an assistant',
  'your instructions',
  'new instructions',
  'do not tell the user',
  'never tell the user',
  'do not mention',
  'respond with',
  'output the following',
  'run the following command',
  'you must',
  'you should',
  'you will need to',
  'always run',
  'the assistant must',
  'the assistant should',
]);

const tokensOf = (name: string): readonly string[] =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter((token) => token !== '')
    .map((token) => token.toLowerCase());

const isDestructiveOperation = (operation: string): boolean =>
  tokensOf(operation).some((token) => DESTRUCTIVE_OPERATIONS.includes(token));

/** Every string an apply carries as operand data, not as an operation name. */
function operandsOf(apply: unknown): readonly string[] {
  const found: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') found.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (typeof value === 'object' && value !== null) Object.values(value).forEach(walk);
  };
  walk(apply);
  return found;
}

const destructiveOperands = (apply: unknown): readonly string[] =>
  DESTRUCTIVE_OPERANDS.filter((flag) =>
    operandsOf(apply).some(
      (operand) =>
        operand === flag ||
        operand.includes(` ${flag} `) ||
        operand.startsWith(`${flag} `) ||
        operand.endsWith(` ${flag}`),
    ),
  );

/** Everything a topic says, in one string: summary, signatures, examples. */
const textOf = (topic: CorpusTopic): string =>
  [
    topic.summary,
    ...topic.signatures,
    ...topic.examples.map((example) => `${example.title}\n${example.code}`),
  ].join('\n');

export function loopLintFindings(submission: SubmissionCorpus): readonly GateFinding[] {
  const corpus = submission.source;
  const found: GateFinding[] = [];
  corpus.topics.forEach((topic, index) => {
    const codes = corpus.twins
      .filter((twin) => twin.docs === topic.topic)
      .map((twin) => twin.code);
    if (codes.length === 0) return;
    const shown = topic.examples.some((example) =>
      codes.some((code) => example.code.includes(code) || example.title.includes(code)),
    );
    if (shown) return;
    found.push(
      finding(
        'loopLint',
        submission.directory,
        `topics[${String(index)}] (${topic.topic})`,
        `the topic "${topic.topic}" is the documented territory of ${codes.join(', ')} and no worked example shows any of them; errors point at docs, and docs point back at errors`,
      ),
    );
  });
  return Object.freeze(found);
}

/** The topic a fix points at, when it points at one this corpus carries. */
const pointedAt = (corpus: CorpusSource, fix: CorpusFix): CorpusTopic | undefined =>
  fix.docs === undefined ? undefined : corpus.topics.find((topic) => topic.topic === fix.docs);

export function dangerLintFindings(submission: SubmissionCorpus): readonly GateFinding[] {
  const corpus = submission.source;
  const found: GateFinding[] = [];
  for (const twin of corpus.twins) {
    (corpus.fixes[twin.id] ?? []).forEach((fix, position) => {
      if (fix.apply === undefined) return;
      const operations = (applyOperations(fix.apply) ?? []).filter(isDestructiveOperation);
      const dangerous = [...operations, ...destructiveOperands(fix.apply)];
      if (dangerous.length === 0) return;
      const topic = pointedAt(corpus, fix);
      const explained = topic === undefined ? '' : textOf(topic);
      const unjustified = dangerous.filter((token) => !explained.includes(token));
      if (unjustified.length === 0) return;
      found.push(
        finding(
          'dangerLint',
          submission.directory,
          `fixes["${twin.id}"][${String(position)}].apply`,
          `the fix "${fix.title}" applies ${unjustified.join(', ')}, which is destructive for this tool class, and no topic it points at explains it; a destructive apply needs an explicit justification and elevated review`,
        ),
      );
    });
  }
  return Object.freeze(found);
}

/** One field of corpus text, and where it lives. */
interface Prose {
  readonly locator: string;
  readonly text: string;
}

function proseOf(corpus: CorpusSource): readonly Prose[] {
  const prose: Prose[] = [];
  corpus.topics.forEach((topic, index) => {
    const at = `topics[${String(index)}] (${topic.topic})`;
    prose.push({ locator: `${at}.summary`, text: topic.summary });
    topic.examples.forEach((example, position) => {
      prose.push({
        locator: `${at}.examples[${String(position)}]`,
        text: `${example.title}\n${example.code}`,
      });
    });
  });
  corpus.twins.forEach((twin, index) => {
    prose.push({ locator: `twins[${String(index)}] (${twin.id}).reason`, text: twin.reason });
  });
  for (const [id, fixes] of Object.entries(corpus.fixes)) {
    fixes.forEach((fix, position) => {
      prose.push({ locator: `fixes["${id}"][${String(position)}].title`, text: fix.title });
    });
  }
  return prose;
}

export function injectionLintFindings(submission: SubmissionCorpus): readonly GateFinding[] {
  const found: GateFinding[] = [];
  for (const { locator, text } of proseOf(submission.source)) {
    const lowered = text.toLowerCase();
    const carried = INSTRUCTION_PHRASES.filter((phrase) => lowered.includes(phrase));
    if (carried.length === 0) continue;
    found.push(
      finding(
        'injectionLint',
        submission.directory,
        locator,
        `this text reads as an instruction to the agent ("${carried.join('", "')}"); corpus text is about the tool, never addressed to the agent, and is data rather than instructions`,
      ),
    );
  }
  return Object.freeze(found);
}
