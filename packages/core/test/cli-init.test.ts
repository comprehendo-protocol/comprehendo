/**
 * Corpus Generator [17], `comprehendo init`: the scaffold verb.
 *
 * A blank directory is where contributions die, so what init produces is the
 * whole shape, named after the target, with nothing invented in it.
 */
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { AUTHORING_FORMAT, CliError, readCorpus, corpusPaths, runInit } from '../src/cli/index.js';
import { cleanupWorkspaces, makeWorkspace, snapshot } from './helpers/toy-corpus.js';

afterEach(cleanupWorkspaces);

const json = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

describe('comprehendo init', () => {
  it('scaffolds the five-file corpus shape for a target package', () => {
    const workspace = makeWorkspace();

    const code = runInit(workspace.options());

    expect(code).toBe(0);
    expect(existsSync(join(workspace.corpus, 'manifest.json'))).toBe(true);
    expect(existsSync(join(workspace.corpus, 'index.json'))).toBe(true);
    expect(statSync(join(workspace.corpus, 'topics')).isDirectory()).toBe(true);
    expect(existsSync(join(workspace.corpus, 'twins.json'))).toBe(true);
    expect(existsSync(join(workspace.corpus, 'fixes.json'))).toBe(true);
    expect(workspace.lines).toContain('  + topics/');
  });

  it('names the provider and target version from the target package.json', () => {
    const workspace = makeWorkspace();

    runInit(workspace.options());
    const manifest = json(join(workspace.corpus, 'manifest.json'));

    expect(manifest['provider']).toBe('toy-encoder');
    expect(manifest['target']).toEqual({ package: 'toy-encoder', version: '1.0.0', source: 'src' });
    expect(workspace.lines[0]).toBe('comprehendo init toy-encoder@1.0.0');
  });

  it('stamps the authoring format version on every file it writes', () => {
    const workspace = makeWorkspace();

    runInit(workspace.options());

    for (const file of ['manifest.json', 'index.json', 'twins.json', 'fixes.json']) {
      expect(json(join(workspace.corpus, file))['corpus_authoring']).toBe(AUTHORING_FORMAT);
      expect(json(join(workspace.corpus, file))['comprehendo']).toBe('0.1');
    }
  });

  it('opens an empty menu plus the manifest hint, and invents no content', () => {
    // Retargeted from a skeleton that asserted "every scaffolded record is a
    // stub": init scaffolds no records at all, so that assertion could only
    // ever have passed vacuously. What init really promises is this.
    const workspace = makeWorkspace();

    runInit(workspace.options());
    const corpus = readCorpus(corpusPaths(workspace.corpus));

    expect(corpus.topics).toEqual([]);
    expect(corpus.twins).toEqual([]);
    expect(corpus.fixes).toEqual({});
    expect(corpus.manifest_hint).toEqual({ comprehendo: { version: '0.1', level: 1 } });
    expect(workspace.lines.at(-1)).toContain('comprehendo scan');
  });

  it('refuses to overwrite an existing corpus and leaves it byte-identical', () => {
    const workspace = makeWorkspace();
    runInit(workspace.options());
    writeFileSync(join(workspace.corpus, 'topics', 'hand-written.md'), 'mine\n', 'utf8');
    const before = snapshot(workspace.corpus);

    const second = (): number => runInit(workspace.options());

    expect(second).toThrow(CliError);
    expect(second).toThrow(/refuses to overwrite/);
    expect(snapshot(workspace.corpus)).toEqual(before);
  });

  it('refuses a target directory that carries no package.json', () => {
    const empty = mkdtempSync(join(tmpdir(), 'comprehendo-empty-'));

    expect(() => runInit({ target: empty, write: () => undefined })).toThrow(/no package.json/);
  });
});
