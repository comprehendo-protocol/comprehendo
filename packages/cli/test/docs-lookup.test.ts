/**
 * Corpus Discovery CLI [NN]: `runDocs`, the whole verb. Nothing is mocked
 * here beyond what the module itself is (a thin CLI wrapper): every case
 * writes a REAL `comprehendo.corpus.json` artifact into a REAL temp
 * `node_modules/@comprehendo/<pkg>/` tree and reads it back through the
 * REAL `discoverInstalledCorpora`/`createRouter` (Router & Precedence [22])
 * this verb is built on, the same machinery the runtime router uses. No
 * network anywhere in this file, because this verb touches none.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runDocs, type DocsVerbOptions } from '../src/docs-lookup.js';

function harness(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = [];
  return { lines, write: (line) => lines.push(line) };
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'comprehendo-docs-verb-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A real, minimal packed-corpus artifact (Docs Engine [13]'s own format), one topic. */
function installCorpus(pkg: string, topic: string, summary: string): void {
  const dir = join(root, 'node_modules', '@comprehendo', pkg);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: `@comprehendo/${pkg}`, version: '0.0.1' }));
  writeFileSync(
    join(dir, 'comprehendo.corpus.json'),
    JSON.stringify({
      comprehendo: '0.1',
      corpus_packed: 1,
      package: pkg,
      provider: `@comprehendo/${pkg}`,
      version: '1.0.0',
      docs: {
        comprehendo: '0.1',
        packed: 1,
        provider: `@comprehendo/${pkg}`,
        index: [topic],
        topics: { [topic]: { topic, summary, vocabularies_served: { own_terms: [topic], translations: [], task: [] } } },
      },
      twins: [],
      fingerprints: [],
    }),
  );
}

describe('runDocs: an installed corpus answers', () => {
  it('with no query, lists the real topic index, exit 0', () => {
    installCorpus('zod', 'optional-vs-nullable', 'optional() and nullable() cover different absences.');
    const { lines, write } = harness();
    const options: DocsVerbOptions = { target: 'zod', json: false, write };

    const code = runDocs(options, { root });

    expect(code).toBe(0);
    expect(lines).toEqual(['zod: 1 topic(s)', '  optional-vs-nullable']);
  });

  it('with a matching query, answers the real topic, exit 0', () => {
    installCorpus('zod', 'optional-vs-nullable', 'optional() and nullable() cover different absences.');
    const { lines, write } = harness();
    const options: DocsVerbOptions = { target: 'zod', query: 'optional-vs-nullable', json: false, write };

    const code = runDocs(options, { root });

    expect(code).toBe(0);
    expect(lines[0]).toBe('zod :: optional-vs-nullable');
    expect(lines[1]).toBe('optional() and nullable() cover different absences.');
  });

  it('--json emits one machine-readable record carrying the real response', () => {
    installCorpus('zod', 'optional-vs-nullable', 'optional() and nullable() cover different absences.');
    const { lines, write } = harness();
    const options: DocsVerbOptions = { target: 'zod', json: true, write };

    runDocs(options, { root });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0] ?? '') as { target: string; response: { topics?: string[] } };
    expect(record.target).toBe('zod');
    expect(record.response.topics).toEqual(['optional-vs-nullable']);
  });
});

describe('runDocs: nothing installed for this package', () => {
  it('with no query, reports zero topics honestly, exit 0 (never a throw for "nothing here")', () => {
    const { lines, write } = harness();
    const options: DocsVerbOptions = { target: 'left-pad', json: false, write };

    const code = runDocs(options, { root });

    expect(code).toBe(0);
    expect(lines).toEqual(['left-pad: 0 topic(s)']);
  });

  it('with a query, exits 1 and points at `comprehendo add`, mirroring add\'s own not-found convention', () => {
    const { lines, write } = harness();
    const options: DocsVerbOptions = { target: 'left-pad', query: 'how do I pad', json: false, write };

    const code = runDocs(options, { root });

    expect(code).toBe(1);
    expect(lines[0]).toBe('no installed comprehendo corpus answers this for left-pad ("how do I pad")');
    expect(lines[lines.length - 1]).toBe('try: comprehendo add left-pad --install');
  });
});

describe('runDocs: a query with no match against a real installed corpus', () => {
  it('is an honest miss, not a wrong guess (CC10), exit 1', () => {
    installCorpus('zod', 'optional-vs-nullable', 'optional() and nullable() cover different absences.');
    const { lines, write } = harness();
    const options: DocsVerbOptions = { target: 'zod', query: 'something this corpus never documented', json: false, write };

    const code = runDocs(options, { root });

    expect(code).toBe(1);
    expect(lines[0]).toContain('no installed comprehendo corpus answers this');
  });
});
