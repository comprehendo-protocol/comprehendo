/**
 * Corpus Discovery CLI [NN]: `runAdd`, the whole verb, hermetic. Every case
 * injects both the fetcher and the installer, so the found/not-found/error
 * decision tree and the exit-code mapping are proven without a real
 * network call or a real `npm install` anywhere in this file.
 */
import { describe, expect, it } from 'vitest';

import { runAdd, type AddDeps, type AddOptions } from '../src/add.js';
import type { Fetcher } from '../src/registry-lookup.js';
import type { Installer } from '../src/installer.js';

const fetcherReturning = (status: number, body: unknown): Fetcher => () =>
  Promise.resolve({ status, json: () => Promise.resolve(body) });

const found = (name: string, version: string): Fetcher =>
  fetcherReturning(200, { name, 'dist-tags': { latest: version } });

const notFound: Fetcher = fetcherReturning(404, { error: 'Not found' });

function harness(): { lines: string[]; write: (line: string) => void } {
  const lines: string[] = [];
  return { lines, write: (line) => lines.push(line) };
}

function deps(fetcher: Fetcher, installer: Installer = () => ({ status: 0, stderr: '' })): AddDeps {
  return { fetcher, installer, cwd: '/tmp/project' };
}

describe('runAdd: found', () => {
  it('reports the corpus and prints the install command, exit 0, when --install was not passed', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: false, json: false, write };

    const code = await runAdd(options, deps(found('@comprehendo/ffmpeg', '1.0.4')));

    expect(code).toBe(0);
    expect(lines).toEqual([
      'found @comprehendo/ffmpeg@1.0.4',
      'next: npm install --save-dev @comprehendo/ffmpeg',
    ]);
  });

  it('flattens a scoped target the same way Scoped Publisher [31] would have published it', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: '@modelcontextprotocol/sdk', install: false, json: false, write };
    const fetcher: Fetcher = (url) => {
      expect(url).toBe('https://registry.npmjs.org/@comprehendo/modelcontextprotocol__sdk');
      return found('@comprehendo/modelcontextprotocol__sdk', '0.4.0')(url);
    };

    const code = await runAdd(options, deps(fetcher));

    expect(code).toBe(0);
    expect(lines[0]).toBe('found @comprehendo/modelcontextprotocol__sdk@0.4.0');
  });

  it('really installs and reports success, exit 0, when --install was passed', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: true, json: false, write };
    const calls: { argv: readonly string[] }[] = [];
    const installer: Installer = (argv) => {
      calls.push({ argv });
      return { status: 0, stderr: '' };
    };

    const code = await runAdd(options, deps(found('@comprehendo/ffmpeg', '1.0.4'), installer));

    expect(code).toBe(0);
    expect(calls).toEqual([{ argv: ['install', '--save-dev', '@comprehendo/ffmpeg'] }]);
    expect(lines).toEqual(['found @comprehendo/ffmpeg@1.0.4', 'installed @comprehendo/ffmpeg']);
  });

  it('reports a real install failure and exits 2, never silently ok', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: true, json: false, write };
    const installer: Installer = () => ({ status: 1, stderr: 'EACCES: permission denied' });

    const code = await runAdd(options, deps(found('@comprehendo/ffmpeg', '1.0.4'), installer));

    expect(code).toBe(2);
    expect(lines).toEqual(['found @comprehendo/ffmpeg@1.0.4', 'install failed: EACCES: permission denied']);
  });

  it('never invokes the installer at all when --install was not passed', async () => {
    const { write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: false, json: false, write };
    let called = false;
    const installer: Installer = () => {
      called = true;
      return { status: 0, stderr: '' };
    };

    await runAdd(options, deps(found('@comprehendo/ffmpeg', '1.0.4'), installer));

    expect(called).toBe(false);
  });
});

describe('runAdd: not-found', () => {
  it('reports plainly and exits 1, the same "expected non-error" bucket diff uses for drift', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'some-package', install: false, json: false, write };

    const code = await runAdd(options, deps(notFound));

    expect(code).toBe(1);
    expect(lines[0]).toBe('no comprehendo corpus published for some-package (checked @comprehendo/some-package)');
  });

  it('never installs when nothing was found, even if --install was passed', async () => {
    const { write } = harness();
    const options: AddOptions = { target: 'some-package', install: true, json: false, write };
    let called = false;
    const installer: Installer = () => {
      called = true;
      return { status: 0, stderr: '' };
    };

    const code = await runAdd(options, deps(notFound, installer));

    expect(code).toBe(1);
    expect(called).toBe(false);
  });
});

describe('runAdd: error', () => {
  it('reports the registry problem plainly and exits 2, never crashes', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: false, json: false, write };
    const fetcher: Fetcher = () => Promise.reject(new Error('network unreachable'));

    const code = await runAdd(options, deps(fetcher));

    expect(code).toBe(2);
    expect(lines[0]).toContain('network unreachable');
  });
});

describe('runAdd: --json', () => {
  it('emits one machine-readable record and nothing else', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: false, json: true, write };

    const code = await runAdd(options, deps(found('@comprehendo/ffmpeg', '1.0.4')));

    expect(code).toBe(0);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toEqual({
      target: 'ffmpeg',
      corpus: '@comprehendo/ffmpeg',
      lookup: { outcome: 'found', name: '@comprehendo/ffmpeg', version: '1.0.4' },
    });
  });

  it('carries the real install result in the record when --install was passed', async () => {
    const { lines, write } = harness();
    const options: AddOptions = { target: 'ffmpeg', install: true, json: true, write };

    await runAdd(options, deps(found('@comprehendo/ffmpeg', '1.0.4')));

    const record = JSON.parse(lines[0] ?? '') as { installed?: { ok: boolean } };
    expect(record.installed).toEqual({ ok: true, detail: 'installed @comprehendo/ffmpeg' });
  });
});
