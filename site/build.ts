#!/usr/bin/env node
// Registry Website [40]: the comprehendo.dev generator, the impure half.
//
// The site itself is pure (`src/pages.ts`); this module is everything that
// touches the world: argv, the corpora on disk, the two documents it serves,
// one read of a public issue tracker, and the files it writes. It writes
// nothing until the read-only audit has passed over every byte it is about to
// write, so a site carrying a form is never a site that exists.
//
// WHY IT IMPORTS `dist/` AND NOT `src/`. Same reason COMPREHENDO.md Generator
// [35] does: this runs under plain `node`, whose type stripping does not
// rewrite a `./foo.js` specifier onto `foo.ts`, so the packages' own source
// trees are not loadable from a standalone script at all. The suites in
// `site/test/` refuse to run against a `dist/` older than its `src/`.
//
// EXIT CODES ARE THE CONTRACT, because CI reads them. Same vocabulary [35] and
// Corpus Generator [17] already established:
//   0  the site was written
//   2  a precondition the caller can fix (a document that is not there, a
//      corpus that does not pack, a repository name that is not owner/name)
//   3  the read-only audit found a write surface, so nothing was written
//   70 a bug in this tool, reported with its stack
//
// @see .mdd/docs/40-registry-website.md

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { fetchCorpusRequests, issuesUrl } from './src/github.ts';
import type { MostWantedList } from './src/most-wanted.ts';
import { buildSite } from './src/pages.ts';
import type { SiteModel } from './src/pages.ts';
import { auditReadOnly, renderFinding } from './src/read-only.ts';
import { registryListing } from './src/registry.ts';
import type { RegistryEntryInput, RegistryRuling } from './src/registry.ts';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

/** The submission channel Submission Gate [29] names. Not yet created. */
const REGISTRY_REPOSITORY = 'comprehendo-protocol/registry';

/** Only issues carrying this label are explicit corpus requests. */
const REQUEST_LABEL = 'corpus-request';

interface Invocation {
  readonly out: string;
  readonly corpora: string;
  readonly spec: string;
  readonly priming: string;
  readonly rulings: string | undefined;
  readonly repository: string;
  readonly label: string;
  readonly offline: boolean;
}

const USAGE = `usage: node site/build.ts [--out DIR] [--corpora DIR] [--spec FILE] [--priming FILE]
                         [--rulings DIR] [--most-wanted-repo OWNER/NAME]
                         [--most-wanted-label LABEL] [--offline]`;

class UsageError extends Error {}

function invocationOf(argv: readonly string[]): Invocation {
  const read: Record<string, string> = {};
  let offline = false;
  for (let at = 0; at < argv.length; at += 1) {
    const flag = argv[at] as string;
    if (flag === '--offline') {
      offline = true;
      continue;
    }
    if (!flag.startsWith('--')) throw new UsageError(`unexpected argument "${flag}"\n${USAGE}`);
    const value = argv[at + 1];
    if (value === undefined) throw new UsageError(`${flag} needs a value\n${USAGE}`);
    read[flag] = value;
    at += 1;
  }
  const known = [
    '--out',
    '--corpora',
    '--spec',
    '--priming',
    '--rulings',
    '--most-wanted-repo',
    '--most-wanted-label',
  ];
  for (const flag of Object.keys(read)) {
    if (!known.includes(flag)) throw new UsageError(`unknown option "${flag}"\n${USAGE}`);
  }
  return {
    out: read['--out'] ?? join(ROOT, 'site', 'dist'),
    corpora: read['--corpora'] ?? join(ROOT, 'corpora'),
    spec: read['--spec'] ?? join(ROOT, 'MDs', 'comprehendo-spec.md'),
    priming: read['--priming'] ?? join(ROOT, 'packages', 'spec', 'priming.md'),
    rulings: read['--rulings'],
    repository: read['--most-wanted-repo'] ?? REGISTRY_REPOSITORY,
    label: read['--most-wanted-label'] ?? REQUEST_LABEL,
    offline,
  };
}

/** A document served byte for byte, or a refusal naming the file. */
function readDocument(path: string, what: string): { source: string; text: string } {
  if (!existsSync(path)) {
    throw new UsageError(
      `the ${what} is not at ${path}: this site never ships without it, so nothing was written`,
    );
  }
  return { source: path, text: readFileSync(path, 'utf8') };
}

/** What CI ruled about one corpus, when a ruling was supplied at all. */
function readRuling(rulings: string | undefined, directory: string): RegistryRuling | undefined {
  if (rulings === undefined) return undefined;
  const path = join(rulings, `${directory}.json`);
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(
      `the gate ruling at ${path} is not readable JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (typeof parsed !== 'object' || parsed === null || !('gate' in parsed)) {
    throw new UsageError(`the gate ruling at ${path} carries no "gate" result to read`);
  }
  return parsed as RegistryRuling;
}

/** Every corpus directory in the registry, parsed and packed by the real tools. */
async function readCorpora(invocation: Invocation): Promise<readonly RegistryEntryInput[]> {
  if (!existsSync(invocation.corpora)) {
    throw new UsageError(`there is no corpora directory at ${invocation.corpora}`);
  }
  const { parse, pack } = await import('../packages/registry-tools/dist/corpus-format.js');
  const entries: RegistryEntryInput[] = [];
  for (const entry of readdirSync(invocation.corpora, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(invocation.corpora, entry.name);
    if (!existsSync(join(directory, 'manifest.json'))) continue;
    try {
      const corpus = parse(directory);
      entries.push({
        directory: entry.name,
        corpus,
        packed: pack(corpus),
        ...((ruling) => (ruling === undefined ? {} : { ruling }))(
          readRuling(invocation.rulings, entry.name),
        ),
      });
    } catch (error) {
      if (error instanceof UsageError) throw error;
      // Matched by NAME, not instanceof: this script loads Corpus Format [28]
      // from dist/ and the suites load it from src/, two module instances that
      // share no class identity. Same call [35] made.
      const named = error instanceof Error ? error.name : '';
      if (named === 'CorpusFormatError' || named === 'CorpusSourceError') {
        throw new UsageError(
          `${directory} does not read as a corpus, so the registry would be rendered wrong: ${
            (error as Error).message
          }`,
        );
      }
      throw error;
    }
  }
  return entries;
}

async function readMostWanted(invocation: Invocation): Promise<MostWantedList> {
  issuesUrl({ repository: invocation.repository, label: invocation.label });
  if (invocation.offline) {
    return {
      kind: 'unavailable',
      repository: invocation.repository,
      reason:
        'network reads were disabled for this build (--offline), so the most-wanted list was not read',
    };
  }
  const token = process.env['GITHUB_TOKEN'];
  return fetchCorpusRequests({
    repository: invocation.repository,
    label: invocation.label,
    ...(token === undefined || token === '' ? {} : { token }),
    userAgent: 'comprehendo-site',
  });
}

export async function main(
  argv: readonly string[],
  out: (line: string) => void,
  err: (line: string) => void,
): Promise<number> {
  let invocation: Invocation;
  let model: SiteModel;
  try {
    invocation = invocationOf(argv);
    const entries = await readCorpora(invocation);
    model = {
      listings: registryListing(entries),
      spec: readDocument(invocation.spec, 'specification document'),
      priming: readDocument(invocation.priming, 'priming snippet'),
      mostWanted: await readMostWanted(invocation),
    };
  } catch (error) {
    if (error instanceof UsageError) {
      err(error.message);
      return 2;
    }
    if (error instanceof Error && error.message.includes('owner/name')) {
      err(error.message);
      return 2;
    }
    throw error;
  }

  if (model.mostWanted.kind === 'unavailable') {
    err(`most-wanted: ${model.mostWanted.reason}`);
  }

  const files = buildSite(model);
  const findings = auditReadOnly(files);
  if (findings.length > 0) {
    err(`the generated site carries ${String(findings.length)} write surfaces, so nothing was written:`);
    for (const found of findings) err(`  ${renderFinding(found)}`);
    return 3;
  }
  out(`read-only audit: ${String(files.length)} files, 0 write surfaces`);

  rmSync(invocation.out, { recursive: true, force: true });
  mkdirSync(invocation.out, { recursive: true });
  for (const emitted of files) writeFileSync(join(invocation.out, emitted.path), emitted.contents);
  out(`wrote ${String(files.length)} files to ${invocation.out}`);
  return 0;
}

/** Invoked as a script, not imported: run the build and carry its exit code. */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(
    process.argv.slice(2),
    (line) => process.stdout.write(`${line}\n`),
    (line) => process.stderr.write(`${line}\n`),
  )
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`${String((error as Error).stack ?? error)}\n`);
      process.exitCode = 70;
    });
}
