// Corpus Format [28], the gate half: `validate`, a structured corpus in, every
// way it fails the contracts out, as data.
//
// Pure by construction. It reads no file, so the same function checks a corpus
// Submission Gate [29] parsed off a PR, a corpus Scoped Publisher [31] is about
// to pack, and a corpus a test typed by hand, with no second code path.
//
// It reports EVERY violation in one pass rather than raising on the first; the
// shape of a refusal and the reason vocabulary live in `corpus-violation.ts`,
// and the CC7 [09] apply grammar (the security fence, and the part that most
// wants its own tests) lives in `corpus-apply.ts`.
//
// What it checks, and whose rule each one is:
//   Shape Schemas [03] / CATALOG: a fix owes a title, a cataloged failure owes
//     a reason and at least one fix, a published code means one thing.
//   CC3 [08]: UNSTRUCTURED is reserved, and the raw throw-site text is never
//     the primary answer.
//   CC7 [09]: an apply stays inside the declared call schema, a docs pointer
//     resolves to a topic that exists.
//   The format itself: one topic per file, no stub survives to publish, no
//     topic is unreachable, no twin is unmatchable, no fix is orphaned.

import { validateApply } from './corpus-apply.js';
import { STUB } from './corpus-source.js';
import type { CorpusFix, CorpusSource } from './corpus-source.js';
import { violation, type CorpusViolation } from './corpus-violation.js';
import { UNSTRUCTURED_CODE } from './fingerprint.js';

export * from './corpus-violation.js';

function validateFix(
  fix: CorpusFix,
  corpus: CorpusSource,
  topics: ReadonlySet<string>,
  at: string,
): CorpusViolation[] {
  const found: CorpusViolation[] = [];
  if (fix.title === STUB) {
    found.push(
      violation('FORMAT', 'stub-field', `${at}.title`, `the fix at ${at} still carries ${STUB}`),
    );
  } else if (fix.title.trim() === '') {
    found.push(violation('CATALOG', 'fix-without-title', `${at}.title`, 'a fix owes a title'));
  }
  if (fix.apply === undefined && fix.docs === undefined) {
    found.push(
      violation(
        'CC7',
        'fix-without-remedy',
        at,
        `the fix at ${at} carries neither apply nor docs, so it remedies nothing`,
      ),
    );
  }
  if (fix.apply !== undefined) found.push(...validateApply(fix.apply, corpus.declaredSchema, at));
  if (fix.docs !== undefined && !topics.has(fix.docs)) {
    found.push(
      violation(
        'CC7',
        'dangling-docs-pointer',
        `${at}.docs`,
        `the fix at ${at} points at the topic "${fix.docs}", which the corpus index does not carry`,
      ),
    );
  }
  return found;
}

/** One topic file. Everything Docs Engine [13] would refuse, caught earlier. */
function validateTopics(corpus: CorpusSource): CorpusViolation[] {
  const found: CorpusViolation[] = [];
  const seenNames = new Set<string>();
  const seenFiles = new Map<string, string>();
  corpus.topics.forEach((topic, index) => {
    const at = `topics[${index}] (${topic.topic})`;
    if (topic.declaredTopics.length > 1) {
      found.push(
        violation(
          'FORMAT',
          'one-topic-per-file',
          topic.file,
          `${topic.file} covers ${String(topic.declaredTopics.length)} topics (${topic.declaredTopics.join(', ')}); one topic per file is what keeps authoring and review tractable`,
        ),
      );
    }
    const owner = seenFiles.get(topic.file);
    if (owner !== undefined) {
      found.push(
        violation(
          'FORMAT',
          'two-topics-one-file',
          at,
          `the topics "${owner}" and "${topic.topic}" are both advertised as ${topic.file}`,
        ),
      );
    }
    seenFiles.set(topic.file, topic.topic);
    if (seenNames.has(topic.topic)) {
      found.push(
        violation('FORMAT', 'duplicate-topic', at, `the topic "${topic.topic}" is advertised twice`),
      );
    }
    seenNames.add(topic.topic);
    found.push(...validateTopicBody(topic, at));
  });
  for (const file of corpus.strayTopicFiles) {
    found.push(
      violation(
        'FORMAT',
        'stray-topic-file',
        file,
        `${file} is a topic file no index entry advertises; the index is the menu, and a topic outside it is unreachable`,
      ),
    );
  }
  return found;
}

/** A topic's own content: it owes an answer, and a way to be asked for. */
function validateTopicBody(
  topic: CorpusSource['topics'][number],
  at: string,
): CorpusViolation[] {
  const found: CorpusViolation[] = [];
  if (topic.summary === STUB) {
    found.push(
      violation('FORMAT', 'stub-field', `${at}.summary`, `${topic.file} still carries ${STUB}`),
    );
  } else if (topic.summary.trim() === '') {
    found.push(
      violation(
        'FORMAT',
        'topic-without-summary',
        `${at}.summary`,
        `${topic.file} carries no summary, and a topic IS its answer`,
      ),
    );
  }
  const terms =
    topic.vocabularies.own_terms.length +
    topic.vocabularies.translations.length +
    topic.vocabularies.task.length;
  if (terms === 0) {
    found.push(
      violation(
        'FORMAT',
        'topic-without-vocabulary',
        `${at}.vocabularies_served`,
        `the topic "${topic.topic}" serves no vocabulary, so no query could ever reach it`,
      ),
    );
  }
  return found;
}

/** One twin's identity: its code, its reason, and the CC3 [08] leak check. */
function validateTwinIdentity(
  twin: CorpusSource['twins'][number],
  seen: ReadonlySet<string>,
  at: string,
): CorpusViolation[] {
  const found: CorpusViolation[] = [];
  if (twin.code === STUB) {
    found.push(violation('FORMAT', 'stub-field', `${at}.code`, `${at} still carries ${STUB}`));
  } else if (twin.code === UNSTRUCTURED_CODE) {
    found.push(
      violation(
        'CC3',
        'reserved-code',
        `${at}.code`,
        `${UNSTRUCTURED_CODE} is reserved for a failure the corpus has no entry for; a cataloged failure owes its own code`,
      ),
    );
  } else if (seen.has(twin.code)) {
    found.push(
      violation(
        'CATALOG',
        'duplicate-code',
        `${at}.code`,
        `the code ${twin.code} is cataloged twice, and a published code means exactly one thing`,
      ),
    );
  }
  if (twin.reason === STUB) {
    found.push(violation('FORMAT', 'stub-field', `${at}.reason`, `${at} still carries ${STUB}`));
  } else if (twin.reason.trim() === '') {
    found.push(
      violation(
        'CATALOG',
        'empty-reason',
        `${at}.reason`,
        `the cataloged failure ${twin.code} carries no reason, and a twin owes a self-sufficient explanation`,
      ),
    );
  } else if (twin.rawText !== '' && twin.rawText !== STUB && twin.reason.includes(twin.rawText)) {
    // CC3 [08] at corpus time. The native tier catches this through `received`;
    // in an authored corpus the throw site's message pattern IS the raw text a
    // scan recorded, so pasting it into `reason` is the same leak: the raw
    // error becomes the primary answer instead of staying in `received`.
    found.push(
      violation(
        'CC3',
        'raw-error-leak',
        `${at}.reason`,
        `the cataloged failure ${twin.code} surfaces its own throw-site text inside reason; the raw text belongs in received, verbatim, and is never the primary answer`,
      ),
    );
  }
  return found;
}

function validateTwins(corpus: CorpusSource, topics: ReadonlySet<string>): CorpusViolation[] {
  const found: CorpusViolation[] = [];
  const seen = new Set<string>();
  corpus.twins.forEach((twin, index) => {
    const at = `twins[${index}] (${twin.id})`;
    found.push(...validateTwinIdentity(twin, seen, at));
    seen.add(twin.code);
    if (Object.keys(twin.fingerprint).filter((key) => key !== 'kind').length === 0) {
      found.push(
        violation(
          'FORMAT',
          'unmatchable-fingerprint',
          `${at}.fingerprint`,
          `${at} declares no errorClass, no messagePattern and no stackShape, so it would match every error or none`,
        ),
      );
    }
    if (twin.docs !== '' && !topics.has(twin.docs)) {
      found.push(
        violation(
          'CC7',
          'dangling-docs-pointer',
          `${at}.docs`,
          `${at} points at the topic "${twin.docs}", which the corpus index does not carry`,
        ),
      );
    }
    const fixes = corpus.fixes[twin.id] ?? [];
    if (fixes.length === 0) {
      found.push(
        violation(
          'CC3',
          'empty-fixes',
          `${at}.fixes`,
          `the cataloged failure ${twin.code} carries no fix, and a cataloged failure owes at least one`,
        ),
      );
    }
    fixes.forEach((fix, position) => {
      found.push(...validateFix(fix, corpus, topics, `fixes["${twin.id}"][${String(position)}]`));
    });
  });
  return found;
}

/**
 * Every way this corpus fails Shape Schemas [03], CC3 [08], CC7 [09] and the
 * format's own rules, as data. An empty list is the only thing `pack` accepts.
 */
export function validate(corpus: CorpusSource): readonly CorpusViolation[] {
  const topics = new Set(corpus.topics.map((topic) => topic.topic));
  const known = new Set(corpus.twins.map((twin) => twin.id));
  const found: CorpusViolation[] = [...validateTopics(corpus), ...validateTwins(corpus, topics)];
  for (const id of Object.keys(corpus.fixes)) {
    if (known.has(id)) continue;
    found.push(
      violation(
        'FORMAT',
        'orphan-fix',
        `fixes["${id}"]`,
        `fixes.json carries fixes for "${id}", which no twin in this corpus declares`,
      ),
    );
  }
  return Object.freeze(found);
}
