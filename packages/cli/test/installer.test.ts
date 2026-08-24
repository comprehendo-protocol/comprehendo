/**
 * Corpus Discovery CLI [NN]: `installCorpusPackage`, hermetic. The injected
 * `Installer` proves the exact argv this verb would run without a real
 * `npm install` ever executing in the suite; `realInstaller`'s own real
 * `spawnSync` wiring is exercised for real in `cli-main.test.ts`'s
 * process-boundary block only when `--install` is never actually passed
 * (that path is proven by argv construction here, not by a real install).
 */
import { describe, expect, it } from 'vitest';

import { installCorpusPackage, type Installer } from '../src/installer.js';

describe('installCorpusPackage', () => {
  it('runs the real argv shape, --save-dev, never --save', () => {
    const calls: { argv: readonly string[]; cwd: string }[] = [];
    const installer: Installer = (argv, cwd) => {
      calls.push({ argv, cwd });
      return { status: 0, stderr: '' };
    };
    const result = installCorpusPackage('@comprehendo/ffmpeg', '/tmp/project', installer);

    expect(calls).toEqual([{ argv: ['install', '--save-dev', '@comprehendo/ffmpeg'], cwd: '/tmp/project' }]);
    expect(result).toEqual({ ok: true, detail: 'installed @comprehendo/ffmpeg' });
  });

  it('reports the real stderr on a nonzero exit, never silently ok', () => {
    const installer: Installer = () => ({ status: 1, stderr: 'npm error 403 Forbidden\n' });
    const result = installCorpusPackage('@comprehendo/ffmpeg', '/tmp/project', installer);

    expect(result.ok).toBe(false);
    expect(result.detail).toBe('npm error 403 Forbidden');
  });

  it('names the exit status when npm exits nonzero with no stderr at all', () => {
    const installer: Installer = () => ({ status: 127, stderr: '' });
    const result = installCorpusPackage('@comprehendo/ffmpeg', '/tmp/project', installer);

    expect(result).toEqual({ ok: false, detail: 'npm install exited 127' });
  });
});
