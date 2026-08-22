// A seeded, hand-rolled mutation generator for the CC10 [20] property test.
//
// No property-testing library: this project ships zero runtime dependencies
// and avoids dev ones where a hundred lines do the job. Seeded on purpose, so
// a failing case reproduces from the seed the assertion prints, which is the
// only property of a generator that actually matters when one goes red.

export type MutationKind = 'substitute' | 'truncate' | 'insert' | 'delete' | 'transpose';

export interface Mutation {
  readonly seed: number;
  readonly kind: MutationKind;
  readonly text: string;
}

/** mulberry32: 32 bits of state, uniform enough, and reproducible anywhere. */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '\"-_/.:";

/** One mutation of `text`, decided entirely by `seed`. */
export function mutate(text: string, seed: number): Mutation {
  const next = rng(seed);
  const kinds: readonly MutationKind[] = ['substitute', 'truncate', 'insert', 'delete', 'transpose'];
  const kind = kinds[Math.floor(next() * kinds.length)] ?? 'substitute';
  const at = Math.floor(next() * Math.max(text.length, 1));
  const glyph = ALPHABET[Math.floor(next() * ALPHABET.length)] ?? '?';
  switch (kind) {
    case 'substitute':
      return { seed, kind, text: text.slice(0, at) + glyph + text.slice(at + 1) };
    case 'truncate':
      return { seed, kind, text: text.slice(0, at) };
    case 'insert':
      return { seed, kind, text: text.slice(0, at) + glyph + text.slice(at) };
    case 'delete':
      return { seed, kind, text: text.slice(0, at) + text.slice(at + 1) };
    case 'transpose':
      return {
        seed,
        kind,
        text: text.slice(0, at) + text.slice(at + 1, at + 2) + text.slice(at, at + 1) + text.slice(at + 2),
      };
  }
}

/** `count` mutations of `text`, seeds `first` through `first + count - 1`. */
export function mutations(text: string, count: number, first = 1): readonly Mutation[] {
  return Array.from({ length: count }, (_unused, i) => mutate(text, first + i));
}
