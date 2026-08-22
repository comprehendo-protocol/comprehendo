// Corpus Generator [17]: `comprehendo pack`, authoring format -> runtime format.
//
// The five-file authoring format is human-edited source. What ships inside a
// package is Docs Engine [13]'s packed artifact (`packed: 1`), one JSON file
// the runtime reads once and never walks a directory for. This verb is the
// bridge, and it validates its own output through the docs engine's own loader
// rather than a second copy of those rules, so "17 emits what 13 reads" is a
// checked claim rather than a hopeful one.
//
// It refuses to emit a corpus that still carries a stub. That is not the
// Submission Gate [29] (Wave 5, a policy about what may be published): it is
// the runtime format having no representation for a field nobody wrote, and
// the loader refusing a topic with an empty summary. The encoder is reporting
// what it cannot encode.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { PACKED_CORPUS_FORMAT, parsePackedCorpus, type PackedCorpus, type PackedTopic } from '../docs.js';
import { COMPREHENDO_VERSION, collectStubs, type AuthoringCorpus, type TopicRecord } from './format.js';
import { corpusExists, readCorpus } from './corpus-io.js';
import { CliError } from './errors.js';
import { pathsFor, targetRoot, type VerbOptions } from './options.js';

const packedTopic = (topic: TopicRecord): PackedTopic => ({
  topic: topic.topic,
  summary: topic.summary,
  ...(topic.signatures.length === 0 ? {} : { signatures: [...topic.signatures] }),
  ...(topic.examples.length === 0 ? {} : { examples: topic.examples.map((e) => ({ ...e })) }),
  ...(topic.see_also.length === 0 ? {} : { see_also: [...topic.see_also] }),
  vocabularies_served: {
    own_terms: [...topic.vocabularies_served.own_terms],
    translations: topic.vocabularies_served.translations.map((entry) => ({
      known_tool: entry.known_tool,
      terms: [...entry.terms],
    })),
    task: [...topic.vocabularies_served.task],
  },
});

/**
 * Compile an authored corpus into the packed runtime artifact. Orphaned topics
 * are kept: a corpus documents concepts, and an export disappearing does not
 * un-write the prose about it. `runPack` says so out loud instead of dropping
 * content quietly.
 */
export function packCorpus(corpus: AuthoringCorpus): PackedCorpus {
  const stubs = collectStubs(corpus);
  if (stubs.length > 0) {
    const named = stubs.map((stub) => `${stub.record}.${stub.field}`).join(', ');
    throw new CliError(
      `${stubs.length} field(s) still carry status: stub, and the packed format has ` +
        `no way to say "nobody wrote this yet": ${named}`,
    );
  }
  const packed: PackedCorpus = {
    comprehendo: COMPREHENDO_VERSION,
    packed: PACKED_CORPUS_FORMAT,
    provider: corpus.provider,
    index: corpus.topics.map((topic) => topic.topic),
    topics: Object.fromEntries(corpus.topics.map((topic) => [topic.topic, packedTopic(topic)])),
  };
  // The docs engine's own loader is the acceptance test for this artifact.
  return parsePackedCorpus(packed);
}

export function runPack(options: VerbOptions): number {
  const paths = pathsFor(options);
  if (!corpusExists(paths)) {
    throw new CliError(`no corpus at ${paths.root}; run "comprehendo init ${options.target}" first`);
  }
  const corpus = readCorpus(paths);
  const packed = packCorpus(corpus);
  const out =
    options.out === undefined
      ? join(targetRoot(options), 'comprehendo.packed.json')
      : resolve(options.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(packed, null, 2)}\n`, 'utf8');

  const orphaned = corpus.topics.filter((topic) => topic.orphaned).map((topic) => topic.topic);
  options.write(`comprehendo pack ${corpus.provider} -> ${out}`);
  options.write(`packed: ${String(packed.packed)}  topics: ${packed.index.length}`);
  if (orphaned.length > 0) {
    options.write(`packed anyway, their exports are gone: ${orphaned.join(', ')}`);
  }
  return 0;
}
