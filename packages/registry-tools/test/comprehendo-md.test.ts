// COMPREHENDO.md Generator [35], and the drift gate that is the point of it.
//
// Nothing here is a fixture. Every check runs the REAL generator over the REAL
// flagship corpus (`corpora/ffmpeg/`, ffmpeg Corpus [32]) through Corpus Format
// [28]'s real `parse`/`pack` and Docs Engine [13]'s real `createDocs`, and the
// drift half runs the generator the way CI runs it: a real `node` process, real
// argv, real exit code read by this parent.
//
// The mutation cases copy the real corpus to a temp directory and edit the real
// files there, so "a corpus change the committed file does not reflect fails as
// drift" is proven against a corpus change, never against a typed double of one.
//
// @see .mdd/docs/35-comprehendo-md-generator.md

import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

/** The repository root, from this test file. */
const ROOT = join(import.meta.dirname, '..', '..', '..');

/** The generator this feature owns. */
const SCRIPT = join(ROOT, 'scripts', 'generate-comprehendo-md.ts');

/** The real corpus every case below runs against. */
const CORPUS = join(ROOT, 'corpora', 'ffmpeg');

/** The committed artifact the drift gate defends. */
const COMMITTED = join(CORPUS, 'COMPREHENDO.md');

interface GeneratorModule {
  readonly renderFromCorpus: (corpusDir: string) => Promise<string>;
  readonly driftReport: (committed: string, regenerated: string) => readonly string[];
  readonly main: (
    argv: readonly string[],
    out: (line: string) => void,
    err: (line: string) => void,
  ) => Promise<number>;
  readonly USAGE: readonly string[];
}

/**
 * The generator's real module, loaded the way this package already loads
 * Corpus Generator [17]'s: a dynamic import of the real file by URL, under the
 * test runner's transform. No double is ever in the loop.
 */
const generator = (): Promise<GeneratorModule> =>
  import(/* @vite-ignore */ pathToFileURL(SCRIPT).href) as Promise<unknown> as Promise<
    GeneratorModule
  >;

/** One real run of the real script, as a real child process. */
function runCli(argv: readonly string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** The newest modification time under a directory tree, in milliseconds. */
function newestUnder(dir: string, extension: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestUnder(path, extension));
      continue;
    }
    if (entry.name.endsWith(extension)) newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

/**
 * The generator runs under plain `node`, so it imports the BUILT modules of
 * core and registry-tools: node's type stripping does not rewrite a `.js`
 * specifier onto a `.ts` file the way a bundler does, so `src/` is not
 * loadable from a plain script at all.
 *
 * A stale `dist/` would let this gate pass while the shipped parser does
 * something else, so it fails loudly and names the command, the same call
 * `requireFfmpeg` makes about a missing binary. Never a skip.
 */
function requireFreshDist(): void {
  for (const name of ['core', 'registry-tools']) {
    const pkg = join(ROOT, 'packages', name);
    const built = newestUnder(join(pkg, 'dist'), '.js');
    if (built === 0) {
      throw new Error(`packages/${name}/dist is missing: run "npm run build --prefix packages/${name}"`);
    }
    if (newestUnder(join(pkg, 'src'), '.ts') > built) {
      throw new Error(
        `packages/${name}/dist is older than its src: run "npm run build --prefix packages/${name}"`,
      );
    }
  }
}

/** A throwaway copy of the REAL corpus, for the mutation cases. */
function corpusCopy(): { dir: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'comprehendo-md-'));
  const dir = join(base, 'ffmpeg');
  cpSync(CORPUS, dir, { recursive: true });
  return { dir, cleanup: () => rmSync(base, { recursive: true, force: true }) };
}

/**
 * The `| a | b | c |` rows of the topic table, cells trimmed. Split on
 * UNESCAPED pipes only: an escaped one is cell content, and a reader that
 * splits on it reports the generator's escaping as a broken row.
 */
function tableRows(markdown: string): readonly (readonly string[])[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('|---'))
    .map((line) =>
      line
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((cell) => cell.trim()),
    )
    .slice(1);
}

let rendered = '';
let committed = '';
let realIndex: readonly string[] = [];

beforeAll(async () => {
  requireFreshDist();
  const { renderFromCorpus } = await generator();
  rendered = await renderFromCorpus(CORPUS);
  committed = readFileSync(COMMITTED, 'utf8');
  const { parse, pack } = await import('../src/corpus-format.js');
  const docs = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(ROOT, 'packages', 'core', 'src', 'docs.ts'),
    ).href
  )) as {
    parsePackedCorpus: (raw: unknown) => unknown;
    createDocs: (corpus: unknown, options: unknown) => (query?: string) => { topics: string[] };
  };
  const surface = docs.createDocs(docs.parsePackedCorpus(pack(parse(CORPUS)).docs), {
    sink: () => undefined,
  });
  realIndex = surface().topics;
}, 120_000);

describe('the rendered file is derived from the real corpus, never authored beside it', () => {
  it('names the real package, provider and authored-against version', () => {
    expect(rendered).toContain('`ffmpeg`');
    expect(rendered).toContain('@comprehendo/ffmpeg');
    expect(rendered).toContain('4.4.2');
  });

  it('states the completeness contract in RFC 5.5s own words', () => {
    expect(rendered).toContain(
      'If it is not documented here it does not exist; do not read the source,',
    );
    expect(rendered).toContain(
      'except where an UNDOCUMENTED response permits it for a specific question.',
    );
    expect(rendered).toContain('When in doubt, ask `docs()`');
  });

  it('carries the priming pointer, both marker spellings included', () => {
    expect(rendered).toContain("Symbol.for('comprehendo')");
    expect(rendered).toContain('__comprehendo__');
    expect(rendered).toContain('priming');
  });

  it('lists exactly the topics Docs Engine [13]s real index returns, in menu order', () => {
    const names = tableRows(rendered).map((cells) => (cells[0] ?? '').replaceAll('`', ''));
    expect(names).toEqual([...realIndex]);
  });

  it('answers each topic with that topics own first sentence, not with new prose', async () => {
    const { parse, pack } = await import('../src/corpus-format.js');
    const packed = pack(parse(CORPUS));
    for (const cells of tableRows(rendered)) {
      const name = (cells[0] ?? '').replaceAll('`', '');
      const summary = packed.docs.topics[name]?.summary ?? '';
      const flattened = summary.replaceAll(/\s+/g, ' ').trim();
      const answer = cells[1] ?? 'MISSING';
      // Opens the topic's own answer, and is only its opening: every topic in
      // this corpus says more than one sentence, so a row carrying the whole
      // summary would be the index serving the meal instead of the menu.
      expect(flattened.startsWith(answer)).toBe(true);
      expect(answer.length).toBeLessThan(flattened.length);
      expect(answer.endsWith('.') || answer.endsWith('?') || answer.endsWith('!')).toBe(true);
    }
  });

  it('carries every see_also the real corpus declares for each topic', async () => {
    const { parse, pack } = await import('../src/corpus-format.js');
    const packed = pack(parse(CORPUS));
    for (const cells of tableRows(rendered)) {
      const name = (cells[0] ?? '').replaceAll('`', '');
      for (const related of packed.docs.topics[name]?.see_also ?? []) {
        expect(cells[2] ?? '').toContain(related);
      }
    }
  });

  it('invents nothing: a differently-identified corpus leaks no word of the ffmpeg one, in the identity section it owns', async () => {
    // Found by review: the original mutation swapped provider/target only,
    // leaving declared_schema.surface ("ffmpeg") untouched, so the rendered
    // identity paragraph still legitimately said "...over the `ffmpeg` call
    // surface", and the assertion's own "leaks no word" comment overclaimed
    // what it proved (it only checked two specific strings). A real
    // different corpus would declare its own call surface too, so the
    // mutation now swaps every identity-bearing field a real corpus for a
    // different package would carry.
    //
    // The assertion is scoped to the IDENTITY section (everything before
    // "## Priming"), not the whole file: topic rows correctly quote each
    // topic's own corpus summary verbatim, and this corpus's real topics
    // legitimately say "ffmpeg" throughout their prose (they are ABOUT
    // ffmpeg), so a whole-file not.toContain('ffmpeg') would fail on
    // honest, corpus-derived content, not on an invented word. The claim
    // this test makes is narrower and precise: the part of the file that
    // states what package this corpus is FOR must not still say ffmpeg.
    const { renderFromCorpus } = await generator();
    const copy = corpusCopy();
    try {
      const manifest = JSON.parse(readFileSync(join(copy.dir, 'manifest.json'), 'utf8')) as {
        provider: string;
        target: { package: string; version: string };
        declared_schema: { surface: string; operations: string[] };
      };
      manifest.provider = '@comprehendo/sox';
      manifest.target = { ...manifest.target, package: 'sox', version: '14.6.0' };
      manifest.declared_schema = { ...manifest.declared_schema, surface: 'sox' };
      writeFileSync(join(copy.dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      const other = await renderFromCorpus(copy.dir);
      const identitySection = other.slice(0, other.indexOf('## Priming'));

      expect(identitySection).toContain('sox');
      expect(identitySection).toContain('14.6.0');
      expect(identitySection).not.toContain('ffmpeg');
      expect(identitySection).not.toContain('4.4.2');
    } finally {
      copy.cleanup();
    }
  });

  it('escapes a table-breaking character rather than emitting a broken row', async () => {
    const { renderFromCorpus } = await generator();
    const copy = corpusCopy();
    try {
      const topic = join(copy.dir, 'topics', 'scaling.md');
      const body = readFileSync(topic, 'utf8');
      const marker = '`scale=w:h` resizes a video';
      expect(body).toContain(marker);
      writeFileSync(topic, body.replace(marker, '`scale=w|h` resizes a video'));
      const other = await renderFromCorpus(copy.dir);
      const row = tableRows(other).find((cells) => (cells[0] ?? '').includes('scaling'));
      expect(row).toHaveLength(3);
      expect(other).toContain('scale=w\\|h');
    } finally {
      copy.cleanup();
    }
  });

  // Fixed 2026-08-23 (this feature's own Fixed Issues): the fence's own
  // info-string is now the author's, not always the hardcoded `sh`.
  it('renders a worked example under its own authored fence language, not the sh default', async () => {
    const { renderFromCorpus } = await generator();
    const copy = corpusCopy();
    try {
      const topic = join(copy.dir, 'topics', 'inputs.md');
      const body = readFileSync(topic, 'utf8');
      const marker = '### A synthetic input, so a reproduction needs no media file\n\n```\n';
      expect(body).toContain(marker);
      writeFileSync(topic, body.replace(marker, marker.replace('```\n', '```console\n')));
      const other = await renderFromCorpus(copy.dir);

      expect(other).toContain('### `inputs`: A synthetic input, so a reproduction needs no media file\n\n```console\n');
    } finally {
      copy.cleanup();
    }
  });

  it('renders an unlabelled example fence as sh, unchanged, at zero extra CC5 budget cost', async () => {
    // The regression this guards: an earlier version of the language field
    // was NOT optional (always present, defaulting to the literal 'sh'),
    // which added a real `"language":"sh"` to every example's packed JSON
    // and pushed corpora/ffmpeg's own docs.topics.inputs over its CC5 [02]
    // budget (607/600, found running the full suite). The field must render
    // 'sh' for an unlabelled fence while costing nothing in the packed form
    // the budget gate actually measures.
    const { parse, pack } = await import('../src/corpus-format.js');
    const packed = pack(parse(CORPUS));
    const inputsExamples = packed.docs.topics['inputs']?.examples ?? [];
    expect(inputsExamples.length).toBeGreaterThan(0);
    for (const example of inputsExamples) {
      expect('language' in example).toBe(false);
    }
    expect(rendered).toContain('### `inputs`: FFMPEG_INPUT_NOT_FOUND, the path is resolved before anything is decoded\n\n```sh\n');
  });
});

describe('the committed COMPREHENDO.md', () => {
  it('regenerates byte-identically from the unchanged corpus', () => {
    expect(rendered).toBe(committed);
  });

  it('is reported as drifting from nothing when it matches', async () => {
    const { driftReport } = await generator();
    expect(driftReport(committed, rendered)).toEqual([]);
  });
});

describe('the drift gate, run the way CI runs it', () => {
  it('exits 0 with --check against the committed file', () => {
    const run = runCli([CORPUS, '--check']);
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('catches a hand edit to the committed file, naming the line that differs', () => {
    const copy = corpusCopy();
    try {
      writeFileSync(
        join(copy.dir, 'COMPREHENDO.md'),
        committed.replace('When in doubt, ask `docs()`', 'When in doubt, read the source'),
      );
      const run = runCli([copy.dir, '--check']);
      expect(run.status).toBe(1);
      expect(run.stdout + run.stderr).toContain('read the source');
      expect(run.stdout + run.stderr).toContain('COMPREHENDO.md');
    } finally {
      copy.cleanup();
    }
  });

  it('fails when a real corpus change is not reflected in the committed file', () => {
    const copy = corpusCopy();
    try {
      const topic = join(copy.dir, 'topics', 'scaling.md');
      const body = readFileSync(topic, 'utf8');
      const marker = '`scale=w:h` resizes a video';
      expect(body).toContain(marker);
      writeFileSync(topic, body.replace(marker, '`scale=w:h` stretches a video'));
      const run = runCli([copy.dir, '--check']);
      expect(run.status).toBe(1);
      expect(run.stdout + run.stderr).toContain('stretches a video');
      expect(run.stdout + run.stderr).toContain('resizes a video');
    } finally {
      copy.cleanup();
    }
  });

  it('fails when a corpus change ADDS a topic the committed file never lists', () => {
    const copy = corpusCopy();
    try {
      const index = JSON.parse(readFileSync(join(copy.dir, 'index.json'), 'utf8')) as {
        topics: { topic: string; file: string; status: string; orphaned: boolean }[];
      };
      index.topics.push({
        topic: 'concat',
        file: 'topics/concat.md',
        status: 'ready',
        orphaned: false,
      });
      writeFileSync(join(copy.dir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
      writeFileSync(
        join(copy.dir, 'topics', 'concat.md'),
        [
          '---',
          'topic: concat',
          'status: ready',
          'stub_fields: []',
          'signatures:',
          '  - "-f concat -safe 0 -i <list.txt>"',
          'see_also: []',
          'vocabularies_served:',
          '  own_terms:',
          '    - concat',
          '  translations: []',
          '  task:',
          '    - "join two files"',
          '---',
          '',
          'The concat demuxer joins files that already share a codec and a',
          'timebase, without re-encoding either of them.',
          '',
        ].join('\n'),
      );
      const run = runCli([copy.dir, '--check']);
      expect(run.status).toBe(1);
      expect(run.stdout + run.stderr).toContain('concat');
    } finally {
      copy.cleanup();
    }
  });

  it('exits 2, never 70, when the corpus itself stopped being readable', () => {
    const copy = corpusCopy();
    try {
      rmSync(join(copy.dir, 'topics', 'scaling.md'));
      const run = runCli([copy.dir, '--check']);
      expect(run.status).toBe(2);
      expect(run.stderr).toContain('scaling');
    } finally {
      copy.cleanup();
    }
  });

  it('reports a missing COMPREHENDO.md as drift, never as nothing to do', () => {
    const copy = corpusCopy();
    try {
      rmSync(join(copy.dir, 'COMPREHENDO.md'));
      const run = runCli([copy.dir, '--check']);
      expect(run.status).toBe(1);
      expect(run.stdout + run.stderr).toContain('COMPREHENDO.md');
    } finally {
      copy.cleanup();
    }
  });

  it('rewrites the file with no flag, and the rewritten file then passes --check', () => {
    const copy = corpusCopy();
    try {
      writeFileSync(join(copy.dir, 'COMPREHENDO.md'), 'hand written\n');
      const write = runCli([copy.dir]);
      expect(write.status).toBe(0);
      expect(readFileSync(join(copy.dir, 'COMPREHENDO.md'), 'utf8')).toBe(rendered);
      expect(runCli([copy.dir, '--check']).status).toBe(0);
    } finally {
      copy.cleanup();
    }
  });

  it('exits 2 on a corpus directory that is not there, naming the path', () => {
    const run = runCli([join(ROOT, 'corpora', 'no-such-corpus'), '--check']);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain('no-such-corpus');
  });

  it('exits 2 with the usage text when no corpus is named', async () => {
    const { USAGE } = await generator();
    const run = runCli([]);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain(USAGE[0] ?? 'usage');
  });
});
