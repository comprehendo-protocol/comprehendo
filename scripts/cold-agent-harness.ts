// Cold-Agent Benchmark [38]: the real world the benchmark runs against.
//
// Everything that touches a disk or a process lives here, on the other side of
// the seam `cold-agent-suite.ts` describes. It packs the real corpus with
// Corpus Format [28]'s own `pack`, installs it into a real consumer tree the
// way the registry publishes it, installs one genuinely UN-adopted package
// beside it so the UNDOCUMENTED grant has real source to permit, reads that
// tree into an `Environment` with Router & Precedence [22]'s own
// `discoverInstalledCorpora`, and spawns the really-installed `ffmpeg`.
//
// Nothing here is doubled and nothing here decides anything.
//
// WHY IT LOADS `dist/` AND NOT `src/`. Plain node's type stripping does not
// rewrite a `./foo.js` specifier onto `foo.ts`, so the packages' source trees
// are not loadable from a standalone script at all. The built modules are, and
// they are the same code the published packages ship. Same reasoning [35]
// already recorded for `generate-comprehendo-md.ts`.
//
// @see .mdd/docs/38-cold-agent-benchmark.md

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DocsLike, Task, TwinLike } from './cold-agent-suite.ts';
import { UNADOPTED_SOURCE } from './cold-agent-tasks.ts';

/** The executable under test. Overridable so CI can point at a pinned build. */
export const FFMPEG = process.env['COMPREHENDO_FFMPEG'] ?? 'ffmpeg';

/** A precondition the caller can fix. Never a stack trace, always a sentence. */
export class PreconditionError extends Error {}

// --- the built tooling ------------------------------------------------------

async function built<T>(specifier: string, hint: string): Promise<T> {
  const url = new URL(specifier, import.meta.url);
  try {
    return (await import(/* @vite-ignore */ url.href)) as T;
  } catch (error) {
    if ((error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new PreconditionError(`${url.pathname} is missing: run ${hint}`);
  }
}

interface FormatTier {
  readonly parse: (corpusDir: string) => unknown;
  readonly pack: (corpus: unknown) => Readonly<Record<string, unknown>>;
  readonly serializeCorpus: (packed: unknown) => string;
}
interface FingerprintTier {
  readonly buildFingerprintIndex: (entries: Iterable<unknown>) => unknown;
}
interface DiscoveryTier {
  readonly discoverInstalledCorpora: (options: unknown) => { readonly defects: readonly unknown[] };
}
interface RouterTier {
  readonly createRouter: (environment: unknown) => Router;
}
interface MarkerTier {
  readonly probe: (raw: unknown) => unknown;
}
interface MeterTier {
  readonly countTokens: (text: string) => number;
}

interface Router {
  comprehend(raw: unknown): TwinLike;
  docs(pkg: string, query?: string): DocsLike;
}

type Tooling = FormatTier & FingerprintTier & DiscoveryTier & RouterTier & MarkerTier & MeterTier;

async function loadTooling(): Promise<Tooling> {
  const rt = '../packages/registry-tools/dist/';
  const core = '../packages/core/dist/';
  const format = await built<FormatTier>(
    `${rt}corpus-format.js`,
    '"npm run build --prefix packages/registry-tools"',
  );
  const fingerprint = await built<FingerprintTier>(`${rt}fingerprint.js`, 'that same build');
  const discovery = await built<DiscoveryTier>(
    `${core}router-discovery.js`,
    '"npm run build --prefix packages/core"',
  );
  const router = await built<RouterTier>(`${core}router.js`, 'that same build');
  const marker = await built<MarkerTier>(`${core}marker.js`, 'that same build');
  const meter = await built<MeterTier>(
    '../packages/spec/kit/budget/tokenizer.js',
    '"npm install --prefix packages/spec" (the real tiktoken-class meter)',
  );
  return { ...format, ...fingerprint, ...discovery, ...router, ...marker, ...meter };
}

// --- the consumer tree ------------------------------------------------------

/** Everything one benchmark run needs, all of it real and all of it disposable. */
export interface Harness {
  readonly root: string;
  readonly router: Router;
  readonly probe: (raw: unknown) => unknown;
  readonly countTokens: (text: string) => number;
  readonly declaredOperations: readonly string[];
  readonly cleanup: () => void;
}

/**
 * A real consumer project: the ffmpeg corpus packed and installed the way the
 * registry publishes it, plus one genuinely un-adopted package that has no
 * corpus at all, which is what makes the UNDOCUMENTED grant real.
 */
export async function prepareHarness(corpusDir: string): Promise<Harness> {
  const tooling = await loadTooling();
  const packed = tooling.pack(tooling.parse(corpusDir));
  const root = mkdtempSync(join(tmpdir(), 'cold-agent-'));

  const corpusHome = join(root, 'node_modules', '@comprehendo', 'ffmpeg');
  mkdirSync(corpusHome, { recursive: true });
  writeFileSync(join(corpusHome, 'comprehendo.corpus.json'), tooling.serializeCorpus(packed));
  writeFileSync(
    join(corpusHome, 'package.json'),
    `${JSON.stringify({
      name: '@comprehendo/ffmpeg',
      version: '0.1.0',
      comprehendoCorpus: { target: 'ffmpeg' },
    })}\n`,
  );

  const unadopted = join(root, 'node_modules', 'toy-widgets');
  mkdirSync(unadopted, { recursive: true });
  writeFileSync(
    join(unadopted, UNADOPTED_SOURCE),
    'export function registerWidget(name, render) {\n' +
      '  if (typeof name !== "string") throw new TypeError("a widget is registered by name");\n' +
      '  registry.set(name, render);\n' +
      '}\n',
  );
  writeFileSync(
    join(unadopted, 'package.json'),
    `${JSON.stringify({ name: 'toy-widgets', version: '1.0.0', main: UNADOPTED_SOURCE })}\n`,
  );

  const environment = tooling.discoverInstalledCorpora({
    root,
    buildIndex: tooling.buildFingerprintIndex,
    docs: { sink: (): undefined => undefined },
  });
  if (environment.defects.length > 0) {
    throw new PreconditionError(
      `the installed corpus is not routable: ${JSON.stringify(environment.defects)}`,
    );
  }
  const schema = (packed['twins'] as { declaredSchema?: { operations?: readonly string[] } })
    ?.declaredSchema;
  return {
    root,
    router: tooling.createRouter(environment),
    probe: tooling.probe,
    countTokens: tooling.countTokens,
    declaredOperations: schema?.operations ?? [],
    cleanup: (): void => rmSync(root, { recursive: true, force: true }),
  };
}

// --- the real binary --------------------------------------------------------

export const ffmpeg = (argv: readonly string[], cwd: string): { status: number; stderr: string } => {
  const child = spawnSync(FFMPEG, [...argv], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
    timeout: 120_000,
  });
  if (child.error !== undefined) {
    throw new PreconditionError(
      `could not run ${FFMPEG}: ${child.error.message}. This benchmark induces every failure out ` +
        'of the real binary and never simulates one, so it fails rather than skipping.',
    );
  }
  return { status: child.status ?? -1, stderr: child.stderr };
};

/** The version string the real binary reports, published with every run. */
export function ffmpegVersion(): string {
  const child = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  if (child.error !== undefined || child.status !== 0) {
    throw new PreconditionError(
      `this benchmark needs a real ffmpeg on PATH (or COMPREHENDO_FFMPEG pointing at one) and ` +
        `found none: ${child.error?.message ?? `exit ${String(child.status)}`}`,
    );
  }
  return (child.stdout.split('\n')[0] ?? '').trim();
}

/** A task's workspace, prepared with real media built by ffmpeg itself. */
export function prepareWorkspace(task: Task, root: string): string {
  const cwd = mkdtempSync(join(root, 'task-'));
  const fixture = task.fixture;
  if (fixture === undefined) return cwd;
  if (fixture.make === 'text') {
    writeFileSync(join(cwd, fixture.name), 'this is not a media file\n');
    return cwd;
  }
  const source =
    fixture.make === 'video-with-audio'
      ? ['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=1', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '1', '-c:a', 'aac']
      : ['-f', 'lavfi', '-i', `testsrc=size=${fixture.size ?? '320x240'}:rate=10:duration=1`];
  const made = ffmpeg(
    ['-hide_banner', '-nostdin', ...source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', fixture.name],
    cwd,
  );
  if (made.status !== 0) {
    throw new PreconditionError(`could not build the fixture ${fixture.name}:\n${made.stderr}`);
  }
  return cwd;
}

