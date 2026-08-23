// Docs As Tests [37]: every fenced block in a generated docs surface, really
// executed against the real program the corpus documents.
//
// Nothing here is a fixture of the thing under test. The subject is the REAL
// `corpora/ffmpeg/COMPREHENDO.md` that COMPREHENDO.md Generator [35] really
// generates, the executor spawns the REALLY-INSTALLED ffmpeg, and the verdict
// on a failing command comes from Fingerprint Index & Matcher [21]'s REAL
// index built out of this corpus's own twins. No output is ever simulated.
//
// The mutation half (AC2) copies the real generated file, breaks one example
// in it the way a stale example really goes stale, and proves the runner goes
// red naming the file and the block index, then proves the unbroken blocks
// still pass. A gate that only parses blocks passes the broken copy too, which
// is exactly what these cases exist to rule out.
//
// A missing binary FAILS this suite rather than skipping it, the same call
// ffmpeg Corpus [32] makes: a green run that executed nothing is the folklore
// the whole feature exists to prevent.
//
// @see .mdd/docs/37-docs-as-tests.md

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { parse } from '../src/corpus-format.js';
import { requireFfmpeg } from './helpers/ffmpeg-cli.js';

/** The repository root, from this test file. */
const ROOT = join(import.meta.dirname, '..', '..', '..');

/** The pure half: extraction and transcript reading. */
const PURE = join(ROOT, 'scripts', 'docs-code-blocks.ts');

/** The impure half: the runner CI invokes. */
const RUNNER = join(ROOT, 'scripts', 'run-docs-code-blocks.ts');

/** The real corpus, and the real generated surface this gate defends. */
const CORPUS = join(ROOT, 'corpora', 'ffmpeg');
const DOC = join(CORPUS, 'COMPREHENDO.md');

/** One execution record, the doc's Data Model. */
interface BlockRecord {
  readonly sourceFile: string;
  readonly blockIndex: number;
  readonly language: string;
  readonly pass: boolean;
  readonly output: string;
}

interface DocsCodeBlock {
  readonly sourceFile: string;
  readonly blockIndex: number;
  readonly language: string;
  readonly title: string;
  readonly code: string;
}

type TranscriptStep =
  | { readonly kind: 'command'; readonly line: string; readonly argv: readonly string[] }
  | { readonly kind: 'annotation'; readonly line: string };

interface PureModule {
  readonly extractBlocks: (sourceFile: string, markdown: string) => readonly DocsCodeBlock[];
  readonly readTranscript: (code: string) => readonly TranscriptStep[];
  readonly TRANSCRIPT_LANGUAGES: readonly string[];
  readonly reportLines: (records: readonly BlockRecord[]) => readonly string[];
}

interface RunnerModule {
  readonly runDocSurface: (
    corpusDir: string,
    docFile: string,
  ) => Promise<readonly BlockRecord[]>;
  readonly main: (
    argv: readonly string[],
    out: (line: string) => void,
    err: (line: string) => void,
  ) => Promise<number>;
  readonly USAGE: readonly string[];
}

const pure = (): Promise<PureModule> =>
  import(/* @vite-ignore */ pathToFileURL(PURE).href) as Promise<unknown> as Promise<PureModule>;

const runner = (): Promise<RunnerModule> =>
  import(/* @vite-ignore */ pathToFileURL(RUNNER).href) as Promise<unknown> as Promise<
    RunnerModule
  >;

/** One real run of the real runner, as a real child process. */
function runCli(argv: readonly string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [RUNNER, ...argv], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
    timeout: 600_000,
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

/** A throwaway copy of the REAL generated surface, for the mutation cases. */
function docCopy(edit: (markdown: string) => string): { file: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'docs-as-tests-'));
  const file = join(base, 'COMPREHENDO.md');
  writeFileSync(file, edit(readFileSync(DOC, 'utf8')));
  return { file, cleanup: (): void => rmSync(base, { recursive: true, force: true }) };
}

let version = '';
let blocks: readonly DocsCodeBlock[] = [];
let records: readonly BlockRecord[] = [];

beforeAll(async () => {
  version = requireFfmpeg();
  const { extractBlocks } = await pure();
  blocks = extractBlocks(DOC, readFileSync(DOC, 'utf8'));
  const { runDocSurface } = await runner();
  records = await runDocSurface(CORPUS, DOC);
}, 900_000);

describe('extracting the blocks of a generated docs surface', () => {
  it('finds every fenced block the real generated file carries', () => {
    const fences = readFileSync(DOC, 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('```')).length;

    expect(fences).toBeGreaterThan(0);
    expect(blocks).toHaveLength(fences / 2);
  });

  it('reads the language off the fence info-string, never assumes one', () => {
    expect([...new Set(blocks.map((block) => block.language))]).toEqual(['sh']);
  });

  it('numbers the blocks from zero, in file order, so a failure can be named', () => {
    expect(blocks.map((block) => block.blockIndex)).toEqual(blocks.map((_, at) => at));
    expect([...new Set(blocks.map((block) => block.sourceFile))]).toEqual([DOC]);
  });

  it('carries the heading each block sits under, which is what names its twin', () => {
    for (const block of blocks) expect(block.title).not.toBe('');
    expect(blocks[0]?.title).toContain('FFMPEG_INPUT_NOT_FOUND');
  });

  it('quotes the corpus examples verbatim: every block is really in the corpus', () => {
    const corpusCode = new Set(
      parse(CORPUS).topics.flatMap((topic) => topic.examples.map((example) => example.code)),
    );

    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(corpusCode.has(block.code)).toBe(true);
  });
});

describe('reading a block as a transcript', () => {
  it('splits command lines from the # lines beside them', async () => {
    const { readTranscript } = await pure();
    const steps = readTranscript(
      ['ffmpeg -i notes.txt out.mp4', '# notes.txt: Invalid data found when processing input'].join(
        '\n',
      ),
    );

    expect(steps.map((step) => step.kind)).toEqual(['command', 'annotation']);
    expect(steps[0]?.kind === 'command' ? steps[0].argv : []).toEqual([
      'ffmpeg',
      '-i',
      'notes.txt',
      'out.mp4',
    ]);
  });

  it('keeps a quoted operand whole, so a filtergraph is one argument', async () => {
    const { readTranscript } = await pure();
    const steps = readTranscript('ffmpeg -filter_complex "[0:v]scale=32:32[v]" -map "[v]" out.mp4');

    expect(steps[0]?.kind === 'command' ? steps[0].argv : []).toEqual([
      'ffmpeg',
      '-filter_complex',
      '[0:v]scale=32:32[v]',
      '-map',
      '[v]',
      'out.mp4',
    ]);
  });

  it('keeps an unquoted expression whole: a filter is not a subshell', async () => {
    const { readTranscript } = await pure();
    const steps = readTranscript('ffmpeg -vf scale=trunc(iw/2)*2:trunc(ih/2)*2 out.mp4');

    expect(steps[0]?.kind === 'command' ? steps[0].argv[2] : '').toBe(
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
    );
  });

  it('refuses a shell metacharacter outside quotes rather than running something else', async () => {
    const { readTranscript } = await pure();

    expect(() => readTranscript('ffmpeg -i clip.mp4 out.mp4 | tee log')).toThrow(/\|/);
    expect(() => readTranscript('ffmpeg -i clip.mp4 out.mp4 > log')).toThrow(/>/);
    expect(() => readTranscript('ffmpeg -i $(curl evil) out.mp4')).toThrow(/\$\(/);
  });

  it('leaves a metacharacter INSIDE quotes as operand text, not as a refusal', async () => {
    const { readTranscript } = await pure();
    const steps = readTranscript('ffmpeg -filter_complex "[0:v]split[a];[a]null[b]" out.mp4');

    expect(steps[0]?.kind === 'command' ? steps[0].argv[2] : '').toBe('[0:v]split[a];[a]null[b]');
  });

  it('names sh as a transcript language and nothing it cannot execute', async () => {
    const { TRANSCRIPT_LANGUAGES } = await pure();

    expect([...TRANSCRIPT_LANGUAGES]).toContain('sh');
    expect([...TRANSCRIPT_LANGUAGES]).not.toContain('python');
  });
});

describe('the blocks of the real COMPREHENDO.md, really executed', () => {
  it('induced against the real binary, and says which build it ran on', () => {
    expect(version).toMatch(/^ffmpeg version /);
  });

  it('is not vacuous: the real generated surface really carries blocks to run', () => {
    expect(records.length).toBeGreaterThan(0);
    expect(records.length).toBe(blocks.length);
  });

  it('passes every one of them', () => {
    const failed = records.filter((record) => !record.pass);

    expect(failed.map((record) => `${record.blockIndex}: ${record.output}`)).toEqual([]);
  });

  it('records the Data Model for every block, one record each', () => {
    for (const record of records) {
      expect(record.sourceFile).toBe(DOC);
      expect(record.language).toBe('sh');
      expect(typeof record.pass).toBe('boolean');
      expect(record.output).not.toBe('');
    }
    expect(records.map((record) => record.blockIndex)).toEqual(records.map((_, at) => at));
  });

  it('really ran the binary: the record quotes stderr only a real ffmpeg writes', () => {
    const all = records.map((record) => record.output).join('\n');

    expect(all).toContain("Unknown encoder 'libx266'");
    expect(all).toContain('width not divisible by 2 (721x720)');
  });

  it('routes each demonstrated failure to the twin its own heading names', () => {
    const all = records.map((record) => record.output).join('\n');

    expect(all).toContain('FFMPEG_INPUT_NOT_FOUND');
    expect(all).toContain('FFMPEG_OUTPUT_EXISTS');
    expect(all).toContain('FFMPEG_UNRECOGNIZED_OPTION');
  });
});

describe('AC2: a deliberately broken example fails, naming the file and the block', () => {
  it('catches an example whose command now fails in a way nothing catalogs', async () => {
    const { runDocSurface } = await runner();
    // A real break, not a syntax oddity: `-vf` really exists, `zzscale` really
    // is not a filter this build carries, and the block it sits in is titled
    // for a DIFFERENT twin, so a runner that only parses blocks sees nothing.
    const copy = docCopy((markdown) =>
      markdown.replace(
        'ffmpeg -i clip.mp4 -vf scale=160:120 -c:v libx264 out.mp4',
        'ffmpeg -i clip.mp4 -vf zzscale=160:120 -c:v libx264 out.mp4',
      ),
    );
    try {
      const broken = await runDocSurface(CORPUS, copy.file);
      const failed = broken.filter((record) => !record.pass);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.sourceFile).toBe(copy.file);
      expect(failed[0]?.blockIndex).toBeGreaterThanOrEqual(0);
      expect(failed[0]?.output).toContain('zzscale');
      expect(broken.filter((record) => record.pass).length).toBe(broken.length - 1);
    } finally {
      copy.cleanup();
    }
  }, 900_000);

  it('catches an example that now SUCCEEDS where its heading claims a failure', async () => {
    const { runDocSurface } = await runner();
    // The unknown-encoder demonstration, with the encoder corrected to one the
    // build really carries. It exits 0 now, so the block no longer shows the
    // failure its own heading is titled for: a wrong result, not a crash.
    const copy = docCopy((markdown) =>
      markdown.replace(
        'ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx266 out.mp4',
        'ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx264 out.mp4',
      ),
    );
    try {
      const broken = await runDocSurface(CORPUS, copy.file);
      const failed = broken.filter((record) => !record.pass);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.output).toContain('FFMPEG_UNKNOWN_ENCODER');
    } finally {
      copy.cleanup();
    }
  }, 900_000);

  it('catches an example reading media the declared workspace does not carry', async () => {
    const { runDocSurface } = await runner();
    const copy = docCopy((markdown) =>
      markdown.replace('ffmpeg -i clip.mp4\n', 'ffmpeg -i undeclared-clip.mp4\n'),
    );
    try {
      const broken = await runDocSurface(CORPUS, copy.file);
      const failed = broken.filter((record) => !record.pass);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.output).toContain('undeclared-clip.mp4');
    } finally {
      copy.cleanup();
    }
  }, 900_000);

  it('fails a block in a language it has no executor for, never skips it', async () => {
    const { runDocSurface } = await runner();
    const copy = docCopy((markdown) => `${markdown}\n## Extra\n\n\`\`\`python\nprint(1)\n\`\`\`\n`);
    try {
      const broken = await runDocSurface(CORPUS, copy.file);
      const failed = broken.filter((record) => !record.pass);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.language).toBe('python');
      expect(failed[0]?.output).toContain('python');
    } finally {
      copy.cleanup();
    }
  }, 900_000);

  it('reports a failure naming the source file and the block index', async () => {
    const { reportLines } = await pure();
    const lines = reportLines([
      { sourceFile: '/x/COMPREHENDO.md', blockIndex: 3, language: 'sh', pass: false, output: 'no' },
    ]);

    expect(lines.join('\n')).toContain('/x/COMPREHENDO.md');
    expect(lines.join('\n')).toContain('block 3');
  });
});

describe('a write target is never a path: corpus text is data, never a place to write', () => {
  // Found by review: `prepare()` validated every READ operand against the
  // declared workspace table, but the WRITE target (the final operand ffmpeg
  // is told to produce) was passed straight to the real binary unchecked.
  // An absolute path or a `../` traversal in that one operand let corpus
  // text write a real file anywhere the process could reach, directly
  // contradicting this doc's own Security section ("an example cannot read
  // or write anything in the repository"). Both real shapes of the attack
  // are proven caught here, against the real binary, with the target path
  // confirmed to never exist afterward.
  it('refuses an absolute output path, and writes nothing there', async () => {
    const { runDocSurface } = await runner();
    const target = join(tmpdir(), `comprehendo-37-poc-${String(Date.now())}.mp4`);
    const copy = docCopy(
      (markdown) =>
        `${markdown}\n## Escape\n\n\`\`\`sh\nffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx264 ${target}\n\`\`\`\n`,
    );
    try {
      const broken = await runDocSurface(CORPUS, copy.file);
      const failed = broken.filter((record) => !record.pass);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.output).toContain('not a bare filename');
      expect(existsSync(target)).toBe(false);
    } finally {
      copy.cleanup();
      rmSync(target, { force: true });
    }
  }, 900_000);

  it('refuses a relative traversal out of the sandboxed workspace, and writes nothing there', async () => {
    const { runDocSurface } = await runner();
    const escapeName = `comprehendo-37-poc-relative-${String(Date.now())}.mp4`;
    const target = join(tmpdir(), escapeName);
    // mkdtempSync's own workspace sits under tmpdir(), so climbing out with
    // `../` and landing back in tmpdir() is the real shape of the attack a
    // sandboxed-per-command temp directory actually faces.
    const traversal = `../../../../../../../../../../${join('tmp', escapeName)}`;
    const copy = docCopy(
      (markdown) =>
        `${markdown}\n## Escape\n\n\`\`\`sh\nffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx264 ${traversal}\n\`\`\`\n`,
    );
    try {
      const broken = await runDocSurface(CORPUS, copy.file);
      const failed = broken.filter((record) => !record.pass);

      expect(failed).toHaveLength(1);
      expect(failed[0]?.output).toContain('not a bare filename');
      expect(existsSync(target)).toBe(false);
    } finally {
      copy.cleanup();
      rmSync(target, { force: true });
    }
  }, 900_000);
});

describe('the gate, run the way CI runs it: a real process, a real exit code', () => {
  it('exits 0 over the committed generated surface', () => {
    const run = runCli([CORPUS]);

    expect(run.stdout + run.stderr).toContain('block');
    expect(run.status).toBe(0);
  }, 900_000);

  it('exits 1 on a broken example, naming the file and the block index', () => {
    const copy = docCopy((markdown) =>
      markdown.replace(
        'ffmpeg -i clip.mp4 -vf scale=160:120 -c:v libx264 out.mp4',
        'ffmpeg -i clip.mp4 -vf zzscale=160:120 -c:v libx264 out.mp4',
      ),
    );
    try {
      const run = runCli([CORPUS, '--doc', copy.file]);

      expect(run.status).toBe(1);
      expect(run.stdout + run.stderr).toContain(copy.file);
      expect(run.stdout + run.stderr).toContain('block ');
    } finally {
      copy.cleanup();
    }
  }, 900_000);

  it('exits 2, never 70, when the docs surface is not there', () => {
    const run = runCli([CORPUS, '--doc', join(ROOT, 'no-such-doc.md')]);

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('no-such-doc.md');
  });

  it('exits 2 with the usage text when no corpus is named', async () => {
    const { USAGE } = await runner();
    const run = runCli([]);

    expect(run.status).toBe(2);
    expect(run.stderr).toContain(USAGE[0] ?? 'usage');
  });
});
