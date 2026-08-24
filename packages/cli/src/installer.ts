// Corpus Discovery CLI [NN]: the one real mutation this whole package can
// make, `npm install`, injectable the same way the lookup's `fetcher` is, so
// a test can prove the exact argv this verb would run without a real
// install ever happening in the suite.

import { spawnSync } from 'node:child_process';

export interface InstallResult {
  readonly status: number;
  readonly stderr: string;
}

/** One real process, real argv, no shell (an operand can never become a command). */
export type Installer = (argv: readonly string[], cwd: string) => InstallResult;

export const realInstaller: Installer = (argv, cwd) => {
  const result = spawnSync('npm', argv, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: result.status ?? -1, stderr: result.stderr };
};

/**
 * `npm install --save-dev <corpus package>`, real argv, real exit status.
 * Never `--save` (a corpus is dev tooling for the agent reading it, not a
 * runtime dependency of the consumer's own shipped code).
 */
export function installCorpusPackage(
  packageName: string,
  cwd: string,
  installer: Installer,
): { readonly ok: boolean; readonly detail: string } {
  const result = installer(['install', '--save-dev', packageName], cwd);
  if (result.status === 0) return { ok: true, detail: `installed ${packageName}` };
  return { ok: false, detail: result.stderr.trim() !== '' ? result.stderr.trim() : `npm install exited ${String(result.status)}` };
}
