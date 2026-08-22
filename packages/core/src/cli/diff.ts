// Corpus Generator [17]: `comprehendo diff`, re-scan and report drift.
//
// This is the operation Upstream Watch [34] (Wave 6) is built on: re-scanning
// against a new upstream version and reporting what drifted is the same job
// whether an author runs it by hand or a lock file runs it in CI, so the output
// is a contract, `--json` and the exit code included.
//
// Two things it deliberately does NOT do. It never writes: a report that edits
// what it reports on cannot be run twice. And it never fails on stubs alone;
// stubs are reported beside the drift because rejecting a corpus for carrying
// them is the Submission Gate [29]'s call, not this verb's.

import { collectStubs, type AuthoringCorpus, type StubRef } from './format.js';
import { corpusExists, readCorpus } from './corpus-io.js';
import { CliError } from './errors.js';
import { pathsFor, targetRoot, type VerbOptions } from './options.js';
import { scanTarget, type TargetScan } from './scanner.js';

export type DriftKind =
  | 'topic-missing'
  | 'topic-orphaned'
  | 'signature-changed'
  | 'twin-missing'
  | 'twin-orphaned';

export interface DriftRecord {
  readonly kind: DriftKind;
  readonly subject: string;
  readonly was?: string;
  readonly now?: string;
}

export interface DriftReport {
  readonly target: string;
  readonly scanned_version: string;
  readonly corpus_version: string;
  readonly drift: readonly DriftRecord[];
  readonly stubs: readonly StubRef[];
}

/**
 * Compare a corpus against a fresh scan. Line numbers are excluded from every
 * comparison on purpose: code moving down a file is formatting, and a drift
 * report that fires on it teaches its reader to ignore it.
 */
export function computeDrift(corpus: AuthoringCorpus, scan: TargetScan): DriftRecord[] {
  const drift: DriftRecord[] = [];
  const topics = new Map(corpus.topics.map((topic) => [topic.topic, topic]));
  const seen = new Set<string>();

  for (const symbol of scan.exports) {
    if (seen.has(symbol.name)) continue;
    seen.add(symbol.name);
    const topic = topics.get(symbol.name);
    if (topic === undefined) {
      drift.push({ kind: 'topic-missing', subject: symbol.name, now: symbol.signature });
      continue;
    }
    const was = topic.signatures[0] ?? '';
    if (was !== symbol.signature) {
      drift.push({ kind: 'signature-changed', subject: symbol.name, was, now: symbol.signature });
    }
  }
  for (const topic of corpus.topics) {
    if (!seen.has(topic.topic)) drift.push({ kind: 'topic-orphaned', subject: topic.topic });
  }

  const twins = new Map(corpus.twins.map((twin) => [twin.id, twin]));
  const raised = new Set<string>();
  for (const site of scan.throws) {
    raised.add(site.id);
    if (twins.has(site.id)) continue;
    drift.push({
      kind: 'twin-missing',
      subject: site.id,
      now: `${site.exception}: ${site.message_pattern}`,
    });
  }
  for (const twin of corpus.twins) {
    if (!raised.has(twin.id)) {
      drift.push({
        kind: 'twin-orphaned',
        subject: twin.id,
        was: `${twin.fingerprint.exception}: ${twin.fingerprint.message_pattern}`,
      });
    }
  }
  return drift;
}

function report(options: VerbOptions, result: DriftReport): void {
  options.write(
    `comprehendo diff ${result.target}@${result.scanned_version} ` +
      `(corpus recorded ${result.corpus_version})`,
  );
  options.write(`drift: ${result.drift.length}`);
  for (const entry of result.drift) {
    options.write(`  ${entry.kind}  ${entry.subject}`);
    if (entry.was !== undefined) options.write(`    was: ${entry.was}`);
    if (entry.now !== undefined) options.write(`    now: ${entry.now}`);
  }
  options.write(`stubs: ${result.stubs.length}`);
  for (const stub of result.stubs) {
    options.write(`  status: stub  ${stub.file}  ${stub.record}.${stub.field}`);
  }
}

export function runDiff(options: VerbOptions): number {
  const root = targetRoot(options);
  const paths = pathsFor(options);
  if (!corpusExists(paths)) {
    throw new CliError(
      `no corpus at ${paths.root}; run "comprehendo init ${options.target}" first`,
    );
  }
  const corpus = readCorpus(paths);
  const scan = scanTarget(root, options.source ?? corpus.target.source);
  const result: DriftReport = {
    target: scan.package,
    scanned_version: scan.version,
    corpus_version: corpus.target.version,
    drift: computeDrift(corpus, scan),
    stubs: collectStubs(corpus),
  };
  if (options.json === true) {
    options.write(JSON.stringify(result, null, 2));
  } else {
    report(options, result);
  }
  // Drift alone decides the exit code: stubs are an authoring state, drift is
  // a corpus that has stopped describing its target.
  return result.drift.length > 0 ? 1 : 0;
}
