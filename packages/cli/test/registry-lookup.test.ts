/**
 * Corpus Discovery CLI [NN]: `lookupCorpusPackage`, hermetic. Every case
 * below injects a fake `Fetcher`, so nothing here ever opens a real socket;
 * the one real-network proof lives in `cli-main.test.ts`'s process-boundary
 * describe block, against a name guaranteed not to exist.
 */
import { describe, expect, it, vi } from 'vitest';

import { isValidNpmName, lookupCorpusPackage, type Fetcher } from '../src/registry-lookup.js';

const jsonResponse = (status: number, body: unknown): Awaited<ReturnType<Fetcher>> => ({
  status,
  json: () => Promise.resolve(body),
});

describe('isValidNpmName', () => {
  it('accepts a bare name and a scoped name', () => {
    expect(isValidNpmName('ffmpeg')).toBe(true);
    expect(isValidNpmName('@comprehendo/ffmpeg')).toBe(true);
    expect(isValidNpmName('@comprehendo/modelcontextprotocol__sdk')).toBe(true);
  });

  it('refuses a shape npm itself would refuse', () => {
    expect(isValidNpmName('')).toBe(false);
    expect(isValidNpmName('Not-Lowercase')).toBe(false);
    expect(isValidNpmName('@scope/')).toBe(false);
    expect(isValidNpmName('has space')).toBe(false);
    expect(isValidNpmName('../traversal')).toBe(false);
  });
});

describe('lookupCorpusPackage', () => {
  it('reports found with the real dist-tags.latest version, for a real 200', async () => {
    const fetcher: Fetcher = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { name: '@comprehendo/ffmpeg', 'dist-tags': { latest: '1.2.3' } })),
    );
    const result = await lookupCorpusPackage('@comprehendo/ffmpeg', fetcher);
    expect(result).toEqual({ outcome: 'found', name: '@comprehendo/ffmpeg', version: '1.2.3' });
    expect(fetcher).toHaveBeenCalledWith('https://registry.npmjs.org/@comprehendo/ffmpeg');
  });

  it('reports not-found for a real 404, the shape the real registry actually returns', async () => {
    const fetcher: Fetcher = vi.fn(() => Promise.resolve(jsonResponse(404, { error: 'Not found' })));
    const result = await lookupCorpusPackage('@comprehendo/never-published', fetcher);
    expect(result).toEqual({ outcome: 'not-found', name: '@comprehendo/never-published' });
  });

  it('reports error, never a throw, when the registry answers an unexpected status', async () => {
    const fetcher: Fetcher = vi.fn(() => Promise.resolve(jsonResponse(500, { error: 'internal' })));
    const result = await lookupCorpusPackage('@comprehendo/ffmpeg', fetcher);
    if (result.outcome !== 'error') throw new Error(`expected error, got ${result.outcome}`);
    expect(result.detail).toContain('500');
  });

  it('reports error, never a throw, when the fetch itself fails (DNS, offline, refused)', async () => {
    const fetcher: Fetcher = vi.fn(() => Promise.reject(new Error('getaddrinfo ENOTFOUND registry.npmjs.org')));
    const result = await lookupCorpusPackage('@comprehendo/ffmpeg', fetcher);
    if (result.outcome !== 'error') throw new Error(`expected error, got ${result.outcome}`);
    expect(result.detail).toContain('ENOTFOUND');
  });

  it('reports error when a 200 carries no readable dist-tags.latest', async () => {
    const fetcher: Fetcher = vi.fn(() => Promise.resolve(jsonResponse(200, { name: '@comprehendo/ffmpeg' })));
    const result = await lookupCorpusPackage('@comprehendo/ffmpeg', fetcher);
    if (result.outcome !== 'error') throw new Error(`expected error, got ${result.outcome}`);
    expect(result.detail).toContain('dist-tags.latest');
  });

  it('refuses a malformed name before ever calling the fetcher, never sends an unescaped request', async () => {
    const fetcher: Fetcher = vi.fn(() => Promise.resolve(jsonResponse(200, {})));
    const result = await lookupCorpusPackage('../../etc/passwd', fetcher);
    expect(result.outcome).toBe('error');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
