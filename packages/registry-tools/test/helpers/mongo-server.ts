// mongodb Corpus: a real, disposable `mongod` this suite's own induction
// runs against, the same "spawn the real dependency, real teardown" shape
// `mcp-oauth-server.ts` already established for a different real dependency
// (an HTTP server there; a database process here). Docker is the only
// realistic way to get a real MongoDB server in CI and in a fresh worktree
// alike, no host install assumed, matching `corpora/ffmpeg`'s own
// established Docker-for-a-real-system-dependency precedent.
//
// One container per test run, a random host port so parallel runs (or a
// stale container from a prior interrupted run) never collide, torn down
// unconditionally in `afterAll` even if induction itself fails partway.

import { execFileSync, spawnSync } from 'node:child_process';

const IMAGE = 'mongo:7';
const CONTAINER_PREFIX = 'comprehendo-mongodb-corpus-';

export interface RealMongo {
  readonly uri: string;
  readonly containerName: string;
  stop(): void;
}

/** A real, ephemeral local port, picked by the OS, never assumed free. */
function freePort(): number {
  const result = spawnSync(
    process.execPath,
    ['-e', 'const s=require("net").createServer();s.listen(0,()=>{console.log(s.address().port);s.close();});'],
    { encoding: 'utf8' },
  );
  const port = Number.parseInt(result.stdout.trim(), 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`could not obtain a free port for the real MongoDB container: ${result.stderr}`);
  }
  return port;
}

/** Real `docker`, or the precondition sentence naming what CI owes. */
function requireDocker(): void {
  try {
    execFileSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'pipe' });
  } catch (cause) {
    throw new Error(
      `this gate induces every mongodb twin against a real, disposable MongoDB server run in Docker, ` +
        `and found no working \`docker\` on PATH: ${(cause as Error).message}`,
    );
  }
}

/** Polls a real TCP connect until the real mongod is actually accepting connections. */
async function waitForReady(port: number, deadlineMs: number): Promise<void> {
  const { Socket } = await import('node:net');
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = new Socket();
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, '127.0.0.1');
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`the real MongoDB container never started accepting connections on port ${String(port)}`);
}

/** One real, disposable `mongod`, up and accepting connections before this resolves. */
export async function startRealMongo(): Promise<RealMongo> {
  requireDocker();
  const port = freePort();
  const containerName = `${CONTAINER_PREFIX}${String(Date.now())}`;
  const run = spawnSync(
    'docker',
    ['run', '-d', '--name', containerName, '-p', `${String(port)}:27017`, IMAGE],
    { encoding: 'utf8' },
  );
  if (run.status !== 0) {
    throw new Error(`could not start a real MongoDB container: ${run.stderr}`);
  }
  await waitForReady(port, 30_000);
  return {
    uri: `mongodb://127.0.0.1:${String(port)}`,
    containerName,
    stop(): void {
      spawnSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
    },
  };
}
