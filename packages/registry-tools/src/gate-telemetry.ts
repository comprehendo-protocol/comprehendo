// CC6 No Telemetry [27], extended from the core packages to a corpus's own
// content by Submission Gate [29]: a corpus containing network code is
// rejected.
//
// Same scan shape CC1 [07] uses on the marker module and CC6 uses on the docs
// engine: a table of forbidden module specifiers, a table of network-capable
// builtins, and a text to scan. What moves is the subject. Here it is the two
// places a corpus carries something EXECUTABLE, a worked example's code and a
// fix's `apply` payload, plus one absolute rule about applies: an apply may
// never carry a URL, because an apply is call data an agent is invited to run.
//
// The scope is deliberate and is the honest reading of "network code". A
// corpus documenting an HTTP client must be able to say "http" in prose and to
// link upstream documentation; what it must never do is ship a runnable example
// that opens a socket, or an apply that names an endpoint. Prose is still
// scanned for the exfiltration builtins (`fetch(`, `sendBeacon`), which have no
// innocent reading inside a corpus that ships zero network code by contract.

import type { CorpusSource } from './corpus-source.js';
import { finding, type GateFinding, type SubmissionCorpus } from './gate-result.js';

/** CC1 [07]'s forbidden-module list, unchanged; a transitive import defeats it too. */
export const NETWORK_MODULES: readonly string[] = Object.freeze([
  'net',
  'tls',
  'http',
  'https',
  'http2',
  'dns',
  'dgram',
  'child_process',
  'worker_threads',
  'inspector',
  'cluster',
]);

export const NETWORK_BUILTINS: readonly string[] = Object.freeze([
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'sendBeacon',
  'EventSource',
]);

const moduleReference = (module: string): RegExp =>
  new RegExp(`['"\`](?:node:)?${module}['"\`]`);

/** Every forbidden thing this text references, named. */
function networkReferences(text: string): readonly string[] {
  const found = NETWORK_MODULES.filter((module) => moduleReference(module).test(text)).map(
    (module) => `the ${module} module`,
  );
  return [...found, ...NETWORK_BUILTINS.filter((builtin) => text.includes(builtin))];
}

interface Executable {
  readonly locator: string;
  readonly text: string;
  /** An apply is call data an agent runs, so a URL in one is never innocent. */
  readonly refuseUrls: boolean;
}

function executableOf(corpus: CorpusSource): readonly Executable[] {
  const parts: Executable[] = [];
  corpus.topics.forEach((topic, index) => {
    topic.examples.forEach((example, position) => {
      parts.push({
        locator: `topics[${String(index)}] (${topic.topic}).examples[${String(position)}]`,
        text: example.code,
        refuseUrls: false,
      });
    });
  });
  for (const [id, fixes] of Object.entries(corpus.fixes)) {
    fixes.forEach((fix, position) => {
      if (fix.apply === undefined) return;
      parts.push({
        locator: `fixes["${id}"][${String(position)}].apply`,
        text: JSON.stringify(fix.apply),
        refuseUrls: true,
      });
    });
  }
  return parts;
}

/** The builtins are scanned in prose too: they have no innocent reading. */
function proseOf(corpus: CorpusSource): readonly { locator: string; text: string }[] {
  return corpus.topics.map((topic, index) => ({
    locator: `topics[${String(index)}] (${topic.topic}).summary`,
    text: topic.summary,
  }));
}

const URL_IN_TEXT = /https?:\/\/[^\s"'`]+/;

export function telemetryFindings(submission: SubmissionCorpus): readonly GateFinding[] {
  const found: GateFinding[] = [];
  const report = (locator: string, carried: readonly string[]): void => {
    found.push(
      finding(
        'telemetryScan',
        submission.directory,
        locator,
        `this corpus ships network code (${carried.join(', ')}); nothing a corpus carries ever crosses the wire, in either tier`,
      ),
    );
  };
  for (const part of executableOf(submission.source)) {
    const carried = [...networkReferences(part.text)];
    const url = part.refuseUrls ? URL_IN_TEXT.exec(part.text) : null;
    if (url !== null) carried.push(url[0]);
    if (carried.length > 0) report(part.locator, carried);
  }
  for (const part of proseOf(submission.source)) {
    const carried = NETWORK_BUILTINS.filter((builtin) => part.text.includes(builtin));
    if (carried.length > 0) report(part.locator, carried);
  }
  return Object.freeze(found);
}
