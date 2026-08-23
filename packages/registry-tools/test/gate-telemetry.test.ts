// CC6 No Telemetry [27], extended from the core packages to a corpus's own
// content by Submission Gate [29].
//
// Same scan shape CC1 [07] uses on the marker module (a module table plus a
// forbidden-import list), pointed at the two places a corpus carries something
// executable: a worked example's code and a fix's `apply` payload. Nothing a
// corpus ships may reach a network, and the gate says so by name.

import { afterEach, describe, expect, it } from 'vitest';

import { NETWORK_BUILTINS, NETWORK_MODULES, telemetryFindings } from '../src/gate-telemetry.js';
import { cleanAll, fixture } from './helpers/gate-fixture.js';
import type { AuthoredCorpus, Fixture } from './helpers/gate-fixture.js';

afterEach(cleanAll);

const encodeTwinId = (corpus: AuthoredCorpus): string =>
  String(corpus.twins.find((twin) => String(twin['id']).includes('#encode#'))?.['id']);

/** Put a worked example carrying `code` on the decode topic. */
async function exampleCode(made: Fixture, code: string): Promise<void> {
  await made.rewrite((corpus) => ({
    ...corpus,
    topics: corpus.topics.map((topic) =>
      topic['topic'] === 'decode'
        ? { ...topic, examples: [{ title: 'Decoding a frame', code }] }
        : topic,
    ),
  }));
}

describe('a corpus that can reach the network is rejected (CC6)', () => {
  it('scans a real forbidden-module list, so the scan is not over nothing', () => {
    expect(NETWORK_MODULES).toContain('http');
    expect(NETWORK_MODULES).toContain('net');
    expect(NETWORK_MODULES).toContain('child_process');
    expect(NETWORK_BUILTINS).toContain('fetch(');
  });

  it('passes the corpus as authored', async () => {
    const made = await fixture();

    expect(telemetryFindings(made.submission())).toEqual([]);
  });

  it.each([...['http', 'net', 'dns', 'child_process']])(
    'rejects a worked example importing node:%s',
    async (module) => {
      const made = await fixture();
      await exampleCode(made, `import client from 'node:${module}';\ndecode('7:payload');`);

      expect(telemetryFindings(made.submission()).length).toBeGreaterThan(0);
    },
  );

  it('rejects a worked example that calls fetch', async () => {
    const made = await fixture();
    await exampleCode(made, "await fetch('https://example.invalid/report', { method: 'POST' });");

    const found = telemetryFindings(made.submission());

    expect(found.map((entry) => entry.message).join(' ')).toContain('fetch(');
  });

  it('rejects a worked example that requires a network module', async () => {
    const made = await fixture();
    await exampleCode(made, "const https = require('https');");

    expect(telemetryFindings(made.submission()).length).toBeGreaterThan(0);
  });

  it('rejects an apply payload carrying a URL', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => {
      const id = encodeTwinId(corpus);
      return {
        ...corpus,
        fixes: {
          ...corpus.fixes,
          [id]: [
            ...(corpus.fixes[id] ?? []),
            {
              title: 'Encode the reported payload',
              apply: { encode: ['https://telemetry.example.invalid/collect'] },
              status: 'draft',
            },
          ],
        },
      };
    });

    const found = telemetryFindings(made.submission());

    expect(found.length).toBeGreaterThan(0);
    expect(found.map((entry) => entry.message).join(' ')).toContain('https://');
  });

  it('leaves a documentation link in prose alone, which is not network code', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      topics: corpus.topics.map((topic) =>
        topic['topic'] === 'decode'
          ? {
              ...topic,
              summary: `${String(topic['summary'])} See https://example.invalid/toy-encoder for the wire format.`,
            }
          : topic,
      ),
    }));

    expect(telemetryFindings(made.submission())).toEqual([]);
  });
});
