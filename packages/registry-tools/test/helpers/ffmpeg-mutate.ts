// ffmpeg Fingerprints [33]: a seeded mutation generator for cryptic CLI text.
//
// CC10 Honest Miss [20] is already property-tested against a JavaScript-shaped
// corpus (error classes, message patterns, stack frames) by
// cc10-honest-miss.property.test.ts, whose character-level generator lives in
// `mutate.ts`. This one is that generator's CLI-domain sibling and reuses its
// PRNG rather than rolling a second one: same mulberry32, same reproduce-from-
// the-printed-seed discipline, no property-testing dependency.
//
// What is different is WHAT gets mutated. An ffmpeg failure line is not prose
// with a payload at the end; it is a sentence with operands baked through it,
// and the operands are exactly the part a fingerprint's `*` wildcards are
// SUPPOSED to cover:
//
//     [libx264 @ 0x5efa21c04d40] width not divisible by 2 (721x720)
//     Stream map '0:a' matches no streams.
//     does-not-exist.mp4: No such file or directory
//
// So the kinds below split along that seam. `operand`, `path` and `number` move
// the parts a pattern deliberately does not pin (a quoted codec name, an input
// path, a dimension, a stream index, a heap address): a corpus entry SHOULD
// still recognise those, and one that does not is over-fitted. `word`, `drop`
// and `char` damage the literal part a pattern does pin: the matcher must let
// go and answer UNSTRUCTURED. `splice` is the hostile one, welding one
// cataloged failure's text onto another's, which is the shape that would make a
// careless matcher hand back some other entry's flag fix.

import { mutate, rng } from './mutate.js';

export type CliMutationKind = 'operand' | 'path' | 'number' | 'word' | 'drop' | 'char' | 'splice';

/** Every kind, which is also the draw the seed chooses from. */
export const CLI_MUTATION_KINDS: readonly CliMutationKind[] = Object.freeze([
  'operand',
  'path',
  'number',
  'word',
  'drop',
  'char',
  'splice',
]);

/** The kinds that damage only the line they are given, never weld in another. */
export const LOCAL_KINDS: readonly CliMutationKind[] = Object.freeze(
  CLI_MUTATION_KINDS.filter((kind) => kind !== 'splice'),
);

/** The kinds that move an operand a pattern's own wildcards already cover. */
export const OPERAND_KINDS: readonly CliMutationKind[] = Object.freeze([
  'operand',
  'path',
  'number',
]);

export interface CliMutation {
  readonly seed: number;
  readonly kind: CliMutationKind;
  readonly text: string;
}

interface Span {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

const QUOTED = /'[^']*'/g;
const HEX = /0x[0-9a-fA-F]+/g;
const PATH = /[A-Za-z0-9_-]+\.[A-Za-z0-9]{2,4}(?![A-Za-z0-9])/g;
const NUMBER = /\d+/g;
const WORD = /[A-Za-z]{3,}/g;

const spansOf = (line: string, pattern: RegExp): readonly Span[] =>
  [...line.matchAll(pattern)].map((found) => ({
    start: found.index ?? 0,
    end: (found.index ?? 0) + (found[0] ?? '').length,
    text: found[0] ?? '',
  }));

const overlaps = (span: Span, others: readonly Span[]): boolean =>
  others.some((other) => span.start < other.end && other.start < span.end);

const pick = <T>(next: () => number, values: readonly T[]): T | undefined =>
  values.length === 0 ? undefined : values[Math.floor(next() * values.length)];

const replaced = (line: string, span: Span, text: string): string =>
  line.slice(0, span.start) + text + line.slice(span.end);

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const token = (next: () => number, length: number): string => {
  let out = '';
  for (let at = 0; at < length; at += 1) out += ALPHABET[Math.floor(next() * ALPHABET.length)] ?? 'x';
  return out;
};

const digits = (next: () => number, length: number): string => {
  let out = '';
  for (let at = 0; at < length; at += 1) out += String(Math.floor(next() * 10));
  return out;
};

/** Every literal word the OTHER cataloged failures use, as swap material. */
export const vocabulary = (foreign: readonly string[]): readonly string[] =>
  Object.freeze([...new Set(foreign.flatMap((text) => text.match(WORD) ?? []))]);

/** A quoted operand: the codec name, the stream map, the label, the option. */
function mutateOperand(line: string, next: () => number): string | undefined {
  const span = pick(next, spansOf(line, QUOTED));
  if (span === undefined) return undefined;
  return replaced(line, span, `'${token(next, 3 + Math.floor(next() * 6))}'`);
}

/** An unquoted input or output path, which a pattern must not be pinned to. */
function mutatePath(line: string, next: () => number): string | undefined {
  const quoted = spansOf(line, QUOTED);
  const span = pick(
    next,
    spansOf(line, PATH).filter((found) => !overlaps(found, quoted)),
  );
  if (span === undefined) return undefined;
  return replaced(line, span, `${token(next, 4 + Math.floor(next() * 5))}.mkv`);
}

/** A dimension, a stream index, a heap address digit: the numeric operands. */
function mutateNumber(line: string, next: () => number): string | undefined {
  const span = pick(next, spansOf(line, NUMBER));
  if (span === undefined) return undefined;
  return replaced(line, span, digits(next, span.text.length));
}

/** The literal words only: what a pattern actually pins is fair game here. */
function literalWords(line: string): readonly Span[] {
  const protectedSpans = [...spansOf(line, QUOTED), ...spansOf(line, HEX), ...spansOf(line, PATH)];
  return spansOf(line, WORD).filter((span) => !overlaps(span, protectedSpans));
}

/** One pinned word swapped for a word another cataloged failure really uses. */
function mutateWord(line: string, next: () => number, foreign: readonly string[]): string | undefined {
  const span = pick(next, literalWords(line));
  if (span === undefined) return undefined;
  const swap = pick(
    next,
    vocabulary(foreign).filter((word) => word !== span.text),
  );
  return swap === undefined ? undefined : replaced(line, span, swap);
}

/** One pinned word gone, the way a terser build words the same failure. */
function mutateDrop(line: string, next: () => number): string | undefined {
  const span = pick(next, literalWords(line));
  if (span === undefined) return undefined;
  return replaced(line, span, '').replace('  ', ' ');
}

/**
 * Cut biased to the ends on purpose: a splice that keeps ALL of one line and
 * ALL of another is the case that carries two cataloged failures at once, and
 * uniform cuts would almost never produce one.
 */
function cutOf(next: () => number, length: number): number {
  const roll = next();
  if (roll < 0.25) return length;
  if (roll < 0.5) return 0;
  return Math.floor(next() * (length + 1));
}

/** One failure's text welded onto another's: the wrong-fix hazard, made real. */
function mutateSplice(line: string, next: () => number, foreign: readonly string[]): string | undefined {
  const other = pick(
    next,
    foreign.filter((text) => text !== line),
  );
  if (other === undefined) return undefined;
  return line.slice(0, cutOf(next, line.length)) + other.slice(cutOf(next, other.length));
}

/**
 * One mutation of one cataloged stderr line, decided entirely by `seed`.
 *
 * `undefined` when the kind the seed drew has nothing to work on in this line
 * (no quoted operand, no path, no digits) or when it happened to reproduce the
 * line unchanged. A no-op mutation asserted as a near-miss would pass while
 * proving nothing, so it is dropped here and the caller's vacuity guards see
 * the smaller count.
 */
export function cliMutate(
  line: string,
  seed: number,
  foreign: readonly string[],
): CliMutation | undefined {
  const next = rng(seed);
  const kind = pick(next, CLI_MUTATION_KINDS) ?? 'char';
  const text =
    kind === 'operand'
      ? mutateOperand(line, next)
      : kind === 'path'
        ? mutatePath(line, next)
        : kind === 'number'
          ? mutateNumber(line, next)
          : kind === 'word'
            ? mutateWord(line, next, foreign)
            : kind === 'drop'
              ? mutateDrop(line, next)
              : kind === 'char'
                ? mutate(line, seed).text
                : mutateSplice(line, next, foreign);
  if (text === undefined || text === line) return undefined;
  return Object.freeze({ seed, kind, text });
}

/** `count` mutations of `line`, seeds `first` through `first + count - 1`. */
export function cliMutations(
  line: string,
  foreign: readonly string[],
  count: number,
  first = 1,
): readonly CliMutation[] {
  const made: CliMutation[] = [];
  for (let at = 0; at < count; at += 1) {
    const mutation = cliMutate(line, first + at, foreign);
    if (mutation !== undefined) made.push(mutation);
  }
  return Object.freeze(made);
}
