// Corpus Generator [17]: `comprehendo scan`, the pre-fill verb.
//
// Everything a machine can know about the target lands in the corpus;
// everything else is marked `status: stub` rather than guessed at or left
// silently blank. Safe to re-run by construction: the merge layer owns the
// rule that a human-owned field is written once, while it is still a stub, and
// never again.

import { collectStubs, type AuthoringCorpus } from './format.js';
import { corpusExists, readCorpus, writeCorpus } from './corpus-io.js';
import { CliError } from './errors.js';
import { mergeScan } from './merge.js';
import { pathsFor, targetRoot, type VerbOptions } from './options.js';
import { scanTarget } from './scanner.js';

const added = <T>(before: readonly T[], after: readonly T[], key: (item: T) => string): number => {
  const known = new Set(before.map(key));
  return after.filter((item) => !known.has(key(item))).length;
};

export function runScan(options: VerbOptions): number {
  const root = targetRoot(options);
  const paths = pathsFor(options);
  if (!corpusExists(paths)) {
    throw new CliError(
      `no corpus at ${paths.root}; run "comprehendo init ${options.target}" first`,
    );
  }
  const existing = readCorpus(paths);
  const scan = scanTarget(root, options.source ?? existing.target.source);
  const merged: AuthoringCorpus = mergeScan(existing, scan);
  writeCorpus(paths, merged);

  const stubs = collectStubs(merged);
  const orphaned = merged.topics.filter((topic) => topic.orphaned).map((topic) => topic.topic);
  options.write(`comprehendo scan ${scan.package}@${scan.version} (${scan.source}/)`);
  options.write(
    `topics: ${merged.topics.length} (+${added(existing.topics, merged.topics, (t) => t.topic)})`,
  );
  options.write(
    `twins: ${merged.twins.length} (+${added(existing.twins, merged.twins, (t) => t.id)})`,
  );
  if (orphaned.length > 0) {
    options.write(`orphaned (kept, their exports are gone): ${orphaned.join(', ')}`);
  }
  options.write(`stubs: ${stubs.length}`);
  for (const stub of stubs) options.write(`  status: stub  ${stub.file}  ${stub.record}.${stub.field}`);
  if (stubs.length > 0) {
    options.write('');
    options.write('Those are the fields only a human can fill. Write them, then re-run scan.');
  }
  return 0;
}
