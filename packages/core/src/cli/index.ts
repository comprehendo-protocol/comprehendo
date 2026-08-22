// Corpus Generator [17]: the module surface, for anything that wants the verbs
// as functions rather than as a process (tests, and Upstream Watch [34] later,
// which needs `diff`'s report, not its stdout).

export { runInit } from './init.js';
export { runScan } from './scan.js';
export { runDiff, computeDrift, type DriftKind, type DriftRecord, type DriftReport } from './diff.js';
export { runPack, packCorpus } from './pack.js';
export { run, parseArgs, USAGE } from './main.js';
export { CliError } from './errors.js';
export {
  corpusPaths,
  corpusExists,
  defaultCorpusRoot,
  readCorpus,
  writeCorpus,
  type CorpusPaths,
} from './corpus-io.js';
export { mergeScan, emptyCorpus } from './merge.js';
export { scanTarget, chooseSourceDir, readTargetManifest } from './scanner.js';
export type { ExportedSymbol, TargetScan, ThrowSite } from './scanner.js';
export type { VerbOptions } from './options.js';
export {
  AUTHORING_FORMAT,
  STUB,
  collectStubs,
  isStub,
  topicFileName,
  type AuthoringCorpus,
  type FixRecord,
  type StubRef,
  type TopicRecord,
  type TwinRecord,
} from './format.js';
