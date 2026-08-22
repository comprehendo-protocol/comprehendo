/**
 * SKELETON (Phase 4, Red Gate). Types and signatures only; every body throws.
 * The real implementation lands in Phase 6.
 */

export type ComprehendoSurface = 'docs' | 'validate' | 'explain' | 'comprehend';

export type ComprehendoLevel = 1 | 2;

export interface ComprehendoEntry {
  readonly comprehendo: string;
  readonly name: string;
  readonly level: ComprehendoLevel;
  readonly surfaces: readonly ComprehendoSurface[];
  readonly identity: string;
  readonly priming: string;
}

export const COMPREHENDO_MARKER: unique symbol = Symbol('marker skeleton, not implemented');

export type Marked<T extends object> = T & {
  readonly [COMPREHENDO_MARKER]: ComprehendoEntry;
};

export function attachMarker<T extends object>(target: T, entry: ComprehendoEntry): Marked<T> {
  void target;
  void entry;
  throw new Error('MDD skeleton: attachMarker is not implemented');
}

export function probe(value: unknown): ComprehendoEntry | undefined {
  void value;
  throw new Error('MDD skeleton: probe is not implemented');
}

export function hasMarker(value: unknown): boolean {
  void value;
  throw new Error('MDD skeleton: hasMarker is not implemented');
}
