// Corpus Generator [17]: what every verb is handed.
//
// Output goes through `write` rather than `console.*`: a CLI's stdout is its
// product, not a log, and an injected writer is also what makes each verb's
// output assertable without capturing global state.

import { resolve } from 'node:path';

import { corpusPaths, defaultCorpusRoot, type CorpusPaths } from './corpus-io.js';

export interface VerbOptions {
  /** The target package root, as typed. */
  readonly target: string;
  /** Corpus root override; defaults to `<target>/comprehendo`. */
  readonly corpus?: string;
  /** Source directory override; defaults to `src/` when the target has one. */
  readonly source?: string;
  /** Where `pack` writes the packed artifact. */
  readonly out?: string;
  /** Machine-readable output, for the CI side of `diff`. */
  readonly json?: boolean;
  readonly write: (line: string) => void;
}

export const targetRoot = (options: VerbOptions): string => resolve(options.target);

export const pathsFor = (options: VerbOptions): CorpusPaths =>
  corpusPaths(
    options.corpus === undefined ? defaultCorpusRoot(targetRoot(options)) : resolve(options.corpus),
  );
