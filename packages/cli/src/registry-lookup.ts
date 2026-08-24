// Corpus Discovery CLI [NN]: does a corpus exist for a target package, and
// what does the registry say about it, checked against the REAL npm
// registry, never a cache or a second index this project would have to keep
// in sync.
//
// The naming convention IS the index: every corpus publishes as
// `@comprehendo/<flattened-target>` (Scoped Publisher [31]'s own
// `corpusPackageName`), so "does a corpus exist" is exactly "does that one
// package name resolve on the registry every npm client already trusts".
// No second catalog to build, host, or drift from what actually got
// published.
//
// EXPLICIT AND ONE-SHOT, never background: this module is imported by
// nothing except `add.ts`, which runs it only when a consumer or agent types
// `comprehendo add <pkg>`. No other verb, and nothing in @comprehendo/core,
// @comprehendo/python or @comprehendo/registry-tools, ever calls this or
// anything like it — CC6 No Telemetry [27]'s "zero network code" boundary is
// why this whole package exists outside those three.

const REGISTRY_ORIGIN = 'https://registry.npmjs.org';

/** An npm package name, scoped or not, the shape this module refuses to exceed. */
const VALID_NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

/** Whether `name` is a shape the registry's own naming rules would accept. */
export const isValidNpmName = (name: string): boolean => VALID_NPM_NAME.test(name);

export interface RegistryFound {
  readonly outcome: 'found';
  readonly name: string;
  readonly version: string;
}

export interface RegistryNotFound {
  readonly outcome: 'not-found';
  readonly name: string;
}

export interface RegistryError {
  readonly outcome: 'error';
  readonly name: string;
  readonly detail: string;
}

export type RegistryLookup = RegistryFound | RegistryNotFound | RegistryError;

/** The one seam this module has: a real HTTP GET, injectable so tests never touch a real socket. */
export type Fetcher = (url: string) => Promise<{
  readonly status: number;
  readonly json: () => Promise<unknown>;
}>;

const distTagsOf = (body: unknown): Record<string, unknown> => {
  if (typeof body !== 'object' || body === null) return {};
  const tags = (body as Record<string, unknown>)['dist-tags'];
  return typeof tags === 'object' && tags !== null ? (tags as Record<string, unknown>) : {};
};

/**
 * One real, explicit lookup against `registry.npmjs.org`. Never assumes a
 * name is safe to build a URL from: a name that does not match npm's own
 * naming grammar is refused before anything is sent, the same "never build
 * a request from unescaped input" discipline this project's http-security
 * rule already states for a `RegExp`.
 */
export async function lookupCorpusPackage(
  name: string,
  fetcher: Fetcher,
): Promise<RegistryLookup> {
  if (!isValidNpmName(name)) {
    return { outcome: 'error', name, detail: `"${name}" is not a shape a real npm package name takes` };
  }
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(`${REGISTRY_ORIGIN}/${name}`);
  } catch (cause) {
    return { outcome: 'error', name, detail: (cause as Error).message };
  }
  if (response.status === 404) {
    return { outcome: 'not-found', name };
  }
  if (response.status !== 200) {
    return { outcome: 'error', name, detail: `the registry answered ${String(response.status)}` };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    return { outcome: 'error', name, detail: `the registry's response was not readable JSON: ${(cause as Error).message}` };
  }
  const latest = distTagsOf(body)['latest'];
  if (typeof latest !== 'string' || latest === '') {
    return { outcome: 'error', name, detail: 'the registry answered 200 with no dist-tags.latest' };
  }
  return { outcome: 'found', name, version: latest };
}
