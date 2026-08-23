// Registry Website [40]: what every suite in this directory needs to reach the
// REAL things it judges. No fixtures live here, only paths and the two loaders
// that read the real corpus through Corpus Format [28]'s real parser.
//
// The generator imports the BUILT modules of registry-tools rather than its
// sources, for the reason COMPREHENDO.md Generator [35] recorded: node's type
// stripping does not remap a `./foo.js` specifier onto `foo.ts`, so a plain
// node process cannot load that src/ tree at all. `requireFreshDist` is the
// answer to the risk that buys: a stale dist/ fails loudly, naming the build.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { CorpusSource, PackedCorpus } from '../../packages/registry-tools/dist/corpus-format.js';

/** The repository root, from this file. */
export const ROOT = join(import.meta.dirname, '..', '..');

export const CORPORA = join(ROOT, 'corpora');
export const FFMPEG_DIR = join(CORPORA, 'ffmpeg');
export const SPEC_DOC = join(ROOT, 'MDs', 'comprehendo-spec.md');
export const PRIMING_DOC = join(ROOT, 'packages', 'spec', 'priming.md');
export const BUILD_SCRIPT = join(ROOT, 'site', 'build.ts');

const RT = join(ROOT, 'packages', 'registry-tools');

/** The newest mtime of any file with this extension under a directory. */
function newestUnder(dir: string, extension: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestUnder(path, extension));
    else if (entry.name.endsWith(extension)) newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

/**
 * Refuse to run against a stale build. A dist/ older than the src/ it was
 * compiled from turns every assertion below into a statement about code that
 * is no longer in the repository.
 */
export function requireFreshDist(): void {
  const src = newestUnder(join(RT, 'src'), '.ts');
  const dist = newestUnder(join(RT, 'dist'), '.js');
  if (dist < src) {
    throw new Error(
      `packages/registry-tools/dist is older than its src; run "npm run build --prefix packages/registry-tools" first`,
    );
  }
}

/** The real flagship corpus, through the real parser. Never a typed double. */
export async function loadFfmpeg(): Promise<{ corpus: CorpusSource; packed: PackedCorpus }> {
  requireFreshDist();
  const { parse, pack } = await import('../../packages/registry-tools/dist/corpus-format.js');
  const corpus = parse(FFMPEG_DIR);
  return { corpus, packed: pack(corpus) };
}
