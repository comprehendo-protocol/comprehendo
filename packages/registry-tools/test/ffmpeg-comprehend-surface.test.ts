// ffmpeg Fingerprints [33], AC1: the surface an agent actually calls.
//
// ffmpeg Corpus [32] already proves that real ffmpeg stderr routes through
// Fingerprint Index & Matcher [21]'s real index to its own entry, and that Twin
// Builder [12] turns that entry into the cataloged twin. What neither suite
// crosses is the last seam: this corpus's fingerprints reaching Router &
// Precedence [22]'s `comprehend(raw)`, which is the only call an agent holding
// a failed invocation ever makes, and the one this doc's API/Interface names.
//
// So nothing here is a unit call. A real packed artifact is written into a real
// consuming project on a real disk, core's REAL `discoverInstalledCorpora`
// finds it, core's REAL `createRouter` compiles it (through 21's real builder,
// injected the way core injects it in production), and the raw handed to
// `comprehend` is the stderr the really-installed binary really wrote this run.
//
// WHY `local` AND NOT node_modules. `@comprehendo/ffmpeg` is not published
// yet; mounting the corpus through Config Loader [23]'s `local` knob is the
// supported way to run an unpublished corpus, and discovery puts a mounted
// corpus into the SAME environment and the SAME index as an installed one, so
// nothing about the routing path is special-cased by this choice.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pack, serializeCorpus } from '../src/corpus-format.js';
import type { CorpusSource } from '../src/corpus-format.js';
import { buildFingerprintIndex } from '../src/fingerprint.js';
import { INDUCE_PREFIX, makeVideo, requireFfmpeg, run, workspace } from './helpers/ffmpeg-cli.js';
import { loadFfmpegCorpus } from './helpers/ffmpeg-corpus.js';
import { catalogedStderr, type CatalogedStderr } from './helpers/ffmpeg-stderr.js';
import { scratch } from './helpers/authored-corpus.js';

/** The twin shape this suite reads off the router. Core's, not redeclared. */
interface RouterTwin {
  readonly code: string;
  readonly reason: string;
  readonly fixes: readonly { readonly title: string; readonly apply?: unknown }[];
  readonly received?: unknown;
}

interface RouterSurface {
  comprehend(raw: unknown): RouterTwin;
  docs(pkg: string, query?: string): Record<string, unknown>;
}

const CORE_SRC = join(import.meta.dirname, '..', '..', 'core', 'src');

/**
 * Core's real router, loaded by file URL at run time.
 *
 * registry-tools takes no dependency on core (they install independently), so
 * a real module is imported the same way `authored-corpus.ts` imports 17's
 * CLI and core's own suites import this package's matcher. No double is ever
 * in the loop.
 */
async function coreRouter(root: string, local: string): Promise<RouterSurface> {
  const discovery = (await import(
    /* @vite-ignore */ pathToFileURL(join(CORE_SRC, 'router-discovery.ts')).href
  )) as {
    discoverInstalledCorpora: (options: Record<string, unknown>) => Promise<unknown>;
  };
  const router = (await import(
    /* @vite-ignore */ pathToFileURL(join(CORE_SRC, 'router.ts')).href
  )) as { createRouter: (environment: unknown, config: unknown) => RouterSurface };
  const config = { local: { ffmpeg: local } };
  const environment = await discovery.discoverInstalledCorpora({
    root,
    buildIndex: buildFingerprintIndex,
    docs: { sink: (): void => undefined },
    config,
  });
  return router.createRouter(environment, config);
}

let corpus: CorpusSource;
let captured: readonly CatalogedStderr[];
let surface: RouterSurface;
let cleanup: () => void;

beforeAll(async () => {
  requireFfmpeg();
  corpus = loadFfmpegCorpus();
  captured = catalogedStderr();

  // A real consuming project: a root, an (empty) node_modules, and the corpus
  // mounted in the project's own tree exactly as `comprehendo pack` ships it.
  const site = scratch('comprehendo-33-');
  cleanup = site.cleanup;
  mkdirSync(join(site.path, 'node_modules'), { recursive: true });
  const mount = join(site.path, 'comprehendo', 'ffmpeg');
  mkdirSync(mount, { recursive: true });
  writeFileSync(join(mount, 'comprehendo.corpus.json'), serializeCorpus(pack(corpus)), 'utf8');

  surface = await coreRouter(site.path, './comprehendo/ffmpeg');
}, 300_000);

afterAll(() => {
  cleanup?.();
});

describe('comprehend(stderr) answers real ffmpeg failures with their own twin', () => {
  it('routes all twelve real inductions to the cataloged twin, fixes attached', () => {
    for (const seen of captured) {
      const twin = surface.comprehend(seen.stderr);

      expect(twin.code, seen.code).toBe(seen.code);
      expect(twin.fixes.length, `${seen.code} answered with no fix`).toBeGreaterThan(0);
      // The twin explains the failure; it never parrots the stderr back.
      expect(twin.reason).not.toContain(seen.line);
    }

    expect(captured.length).toBe(corpus.twins.length);
  });

  it('hands the fence back first for the odd-dimension failure, as literal call data', () => {
    const seen = captured.find((entry) => entry.code === 'FFMPEG_ODD_DIMENSION');
    if (seen === undefined) return expect.unreachable('the odd-dimension induction did not run');

    const twin = surface.comprehend(seen.stderr);

    expect(twin.fixes[0]?.title).toMatch(/^Fence:/);
    expect(twin.fixes[0]?.apply).toEqual({ '-vf': 'scale=-2:720' });
  });

  it('answers a real uncataloged ffmpeg failure UNSTRUCTURED at the same surface', () => {
    const site = workspace();
    try {
      makeVideo(site.path, 'clip.mp4', '64x64');
      const failed = run([...INDUCE_PREFIX, '-i', 'clip.mp4', '-c', 'copy', '-y', 'out.ogg'], site.path);
      expect(failed.status).not.toBe(0);

      const twin = surface.comprehend(failed.stderr);

      expect(twin.code).toBe('UNSTRUCTURED');
      expect(twin.fixes).toEqual([]);
      expect(twin.received).toBe(failed.stderr);
    } finally {
      site.cleanup();
    }
  }, 120_000);

  it('answers the same package docs question at the same surface', () => {
    expect(surface.docs('ffmpeg', 'scaling')['topic']).toBe('scaling');
  });
});
