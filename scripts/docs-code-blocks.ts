// Docs As Tests [37]: what a fenced block IS, and how a run of them reports.
//
// Split from `run-docs-code-blocks.ts` at the project's size gate, the same
// way `comprehendo-md.ts`/`generate-comprehendo-md.ts` split before it:
// everything here is pure and synchronous (text in, values out), and
// everything there spawns a program, writes a workspace or reads an argv.
//
// A GENERATED docs surface is the only subject. This is not a markdown linter
// and it has no opinion about prose: it finds fenced blocks, reads the
// language off the info-string, and turns a block into the transcript the
// executor runs.
//
// A TRANSCRIPT IS NEVER A SHELL SCRIPT. The lines are tokenized here and
// handed to the executor as an argv array, so an operand can never become a
// command; that is the same argument `corpora/ffmpeg/README.md` makes about
// why a corpus `apply` for a command-line surface is safe. A line carrying a
// shell metacharacter outside quotes is REFUSED rather than approximated,
// because running something structurally different from what the doc shows is
// worse than not running it.
//
// @see .mdd/docs/37-docs-as-tests.md

/** One fenced block of a generated docs surface, in file order. */
export interface DocsCodeBlock {
  readonly sourceFile: string;
  /** Zero-based, in file order. What a failure report names. */
  readonly blockIndex: number;
  /** The fence's info-string, verbatim. Empty when the fence carried none. */
  readonly language: string;
  /** The nearest heading above the fence, which is what names the block. */
  readonly title: string;
  /** The block's body, verbatim, without the fences. */
  readonly code: string;
  /** One-based line of the opening fence, so a report can point at it. */
  readonly line: number;
}

/** The doc's Data Model: one record per extracted block. */
export interface BlockRecord {
  readonly sourceFile: string;
  readonly blockIndex: number;
  readonly language: string;
  readonly pass: boolean;
  readonly output: string;
}

/**
 * The fence languages this feature has an executor for.
 *
 * Deliberately NOT including the bare fence: a generated surface labels its
 * blocks (COMPREHENDO.md Generator [35] emits `sh`), and treating an
 * unlabelled fence as a command transcript is a guess. Anything not on this
 * list FAILS the run naming the language; a gate that quietly skips what it
 * cannot execute reports green having verified nothing, which is the exact
 * failure this feature exists to prevent.
 */
export const TRANSCRIPT_LANGUAGES: readonly string[] = Object.freeze([
  'sh',
  'shell',
  'bash',
  'console',
]);

/** Whether this feature can execute a block written in this language. */
export const isTranscriptLanguage = (language: string): boolean =>
  TRANSCRIPT_LANGUAGES.includes(language);

/** A block this runner refuses to execute, with the reason, never a stack. */
export class TranscriptError extends Error {
  public override readonly name = 'TranscriptError';
}

/** A precondition the caller can fix. Never a stack trace, always a sentence. */
export class PreconditionError extends Error {
  public override readonly name = 'PreconditionError';
}

/** A block naming media nobody declared. Reported on the block, never thrown out. */
export class WorkspaceError extends Error {
  public override readonly name = 'WorkspaceError';
}

/** One line of a transcript: a real invocation, or the commentary beside it. */
export type TranscriptStep =
  | { readonly kind: 'command'; readonly line: string; readonly argv: readonly string[] }
  | { readonly kind: 'annotation'; readonly line: string };

const FENCE = /^```(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;

/**
 * Every fenced block of one docs surface, numbered in file order.
 *
 * The title is the nearest heading ABOVE the fence, which is where a generated
 * surface puts the name of the thing the block demonstrates. A block under no
 * heading carries an empty title and is executed anyway; what a title means is
 * the executor's business, not the extractor's.
 */
export function extractBlocks(sourceFile: string, markdown: string): readonly DocsCodeBlock[] {
  const lines = markdown.split('\n');
  const blocks: DocsCodeBlock[] = [];
  let heading = '';
  let at = 0;
  while (at < lines.length) {
    const line = lines[at] ?? '';
    const headed = HEADING.exec(line);
    if (headed !== null) {
      heading = (headed[1] ?? '').trim();
      at += 1;
      continue;
    }
    const opened = FENCE.exec(line);
    if (opened === null) {
      at += 1;
      continue;
    }
    const opensAt = at;
    const body: string[] = [];
    at += 1;
    while (at < lines.length && !FENCE.test(lines[at] ?? '')) {
      body.push(lines[at] ?? '');
      at += 1;
    }
    blocks.push(
      Object.freeze({
        sourceFile,
        blockIndex: blocks.length,
        language: (opened[1] ?? '').trim(),
        title: heading,
        code: body.join('\n'),
        line: opensAt + 1,
      }),
    );
    at += 1;
  }
  return Object.freeze(blocks);
}

/**
 * What a shell would read as structure rather than as an operand.
 *
 * `(` alone is NOT here on purpose: ffmpeg filter expressions really are
 * written `scale=trunc(iw/2)*2:...` in documentation, unquoted, and a
 * transcript that is tokenized rather than shelled reads that as the one
 * operand it means. `$(` is here, because a substitution is structure in any
 * reading.
 */
const METACHARACTERS: readonly string[] = Object.freeze(['|', ';', '&', '`', '>', '<', '$(']);

/**
 * One command line, tokenized. Quote-aware, and never a shell.
 *
 * Both quote characters group; a metacharacter INSIDE quotes is operand text
 * (a filtergraph really does carry `;`), and outside quotes it is a refusal.
 */
function tokenize(line: string): readonly string[] {
  const argv: string[] = [];
  let current = '';
  let started = false;
  let quote = '';
  for (let at = 0; at < line.length; at += 1) {
    const char = line[at] ?? '';
    if (quote !== '') {
      if (char === quote) quote = '';
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    const pair = char + (line[at + 1] ?? '');
    const meta = METACHARACTERS.find((one) => one === pair || one === char);
    if (meta !== undefined) {
      throw new TranscriptError(
        `the transcript line carries the shell metacharacter ${meta} outside quotes: ${line}`,
      );
    }
    if (/\s/.test(char)) {
      if (started || current !== '') argv.push(current);
      current = '';
      started = false;
      continue;
    }
    current += char;
    started = true;
  }
  if (quote !== '') throw new TranscriptError(`the transcript line has an unclosed quote: ${line}`);
  if (started || current !== '') argv.push(current);
  return Object.freeze(argv);
}

/**
 * A block's body, read as the alternating invocations and commentary it is.
 *
 * A `#` at the start of a line is commentary (what the run printed, or what
 * the corpus says about it). A `#` anywhere else is operand text: it is a
 * perfectly ordinary character in a filter expression, and treating it as a
 * trailing comment would silently truncate a real command.
 */
export function readTranscript(code: string): readonly TranscriptStep[] {
  const steps: TranscriptStep[] = [];
  for (const raw of code.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('#')) {
      steps.push(Object.freeze({ kind: 'annotation', line }));
      continue;
    }
    steps.push(Object.freeze({ kind: 'command', line, argv: tokenize(line) }));
  }
  return Object.freeze(steps);
}

/** How many, spelled with its noun, so "1 block" never reads as "1 blocks". */
const count = (many: number, noun: string): string =>
  `${String(many)} ${many === 1 ? noun : `${noun}s`}`;

/**
 * The run, reported. Every record names its file and its block index, so a
 * failure locates itself without anyone opening the generated file.
 *
 * The failing records are repeated at the end with their captured output: a
 * CI log is read from the bottom, and the one thing a reader needs is which
 * block, in which file, and what the program really said.
 */
export function reportLines(records: readonly BlockRecord[]): readonly string[] {
  const failed = records.filter((record) => !record.pass);
  const lines = records.map(
    (record) =>
      `${record.pass ? 'ok    ' : 'FAILED'} ${record.sourceFile} block ${String(record.blockIndex)} (${record.language === '' ? 'no language' : record.language})`,
  );
  lines.push(
    `${count(records.length, 'block')}, ${String(records.length - failed.length)} passed, ${String(failed.length)} failed`,
  );
  for (const record of failed) {
    lines.push('', `${record.sourceFile} block ${String(record.blockIndex)} failed:`);
    for (const line of record.output.split('\n')) lines.push(`  ${line}`);
  }
  return Object.freeze(lines);
}
