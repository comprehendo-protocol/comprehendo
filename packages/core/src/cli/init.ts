// Corpus Generator [17]: `comprehendo init`, the scaffold verb.
//
// A blank directory is where contributions die (the dts-gen precedent), so the
// first thing an author meets is the shape, already named after their package
// and already carrying the manifest hint they have to paste into it. It reads
// the target's identity and nothing else: filling the corpus in is `scan`'s
// job, and a verb that quietly does the other's work makes init's one promise
// (it never overwrites) meaningless.

import { existsSync } from 'node:fs';

import { corpusExists, writeCorpus } from './corpus-io.js';
import { CliError } from './errors.js';
import { emptyCorpus } from './merge.js';
import { pathsFor, targetRoot, type VerbOptions } from './options.js';
import { chooseSourceDir, readTargetManifest } from './scanner.js';

export function runInit(options: VerbOptions): number {
  const root = targetRoot(options);
  if (!existsSync(root)) {
    throw new CliError(`no such target package: ${root}`);
  }
  const paths = pathsFor(options);
  if (corpusExists(paths)) {
    throw new CliError(
      `a corpus already exists at ${paths.root}; init refuses to overwrite it. ` +
        'Run "comprehendo scan" to refresh what a machine can know.',
    );
  }
  const manifest = readTargetManifest(root);
  const corpus = emptyCorpus(manifest.name, {
    package: manifest.name,
    version: manifest.version,
    source: chooseSourceDir(root, options.source),
  });
  const written = writeCorpus(paths, corpus);

  options.write(`comprehendo init ${manifest.name}@${manifest.version}`);
  options.write(`corpus: ${paths.root}`);
  for (const file of written) options.write(`  + ${file}`);
  options.write('');
  options.write(`next: comprehendo scan ${options.target}`);
  return 0;
}
