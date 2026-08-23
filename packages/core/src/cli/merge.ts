// Corpus Generator [17]: the field-ownership rule, in one place.
//
// Machine-owned fields are regenerated wholesale on every scan. Human-owned
// fields are written only while they are still stubs, and never again, even
// when the underlying code changed: that drift is what `diff` reports, and
// silently applying it is how a corpus loses the only content a machine could
// not have produced. Nothing here ever deletes a record either; an export that
// disappears leaves its topic marked orphaned, prose intact.

import {
  STUB,
  COMPREHENDO_VERSION,
  statusOf,
  topicStubFields,
  twinStubFields,
  type AuthoringCorpus,
  type FixRecord,
  type TopicRecord,
  type TwinRecord,
} from './format.js';
import type { ExportedSymbol, TargetScan, ThrowSite } from './scanner.js';

/** The scaffold `init` writes: identity, a manifest hint, and an empty menu. */
export function emptyCorpus(
  provider: string,
  target: { readonly package: string; readonly version: string; readonly source: string },
): AuthoringCorpus {
  return {
    provider,
    target,
    manifest_hint: { comprehendo: { version: COMPREHENDO_VERSION, level: 1 } },
    topics: [],
    twins: [],
    fixes: {},
  };
}

const at = (symbol: ExportedSymbol): string => `${symbol.file}:${symbol.line}`;

/** A brand-new topic: machine fields filled, human fields seeded once. */
function seedTopic(symbol: ExportedSymbol): TopicRecord {
  const summary = symbol.docstring === '' ? STUB : symbol.docstring;
  const partial = {
    topic: symbol.name,
    kind: symbol.kind,
    source: at(symbol),
    signatures: [symbol.signature],
    summary,
    see_also: [],
    examples: [],
    // The export's own name IS the tool's own vocabulary, so it is the one
    // alias a machine can seed. Every other alias is a human's to add.
    vocabularies_served: { own_terms: [symbol.name], translations: [], task: [] },
    orphaned: false,
  };
  return { ...partial, status: statusOf(topicStubFields({ ...partial, status: 'stub' })) };
}

/** An existing topic, re-scanned: machine fields replaced, prose untouched. */
function refreshTopic(topic: TopicRecord, symbol: ExportedSymbol): TopicRecord {
  const partial = {
    ...topic,
    kind: symbol.kind,
    source: at(symbol),
    signatures: [symbol.signature],
    orphaned: false,
  };
  return { ...partial, status: statusOf(topicStubFields(partial), topic.status) };
}

const orphanTopic = (topic: TopicRecord): TopicRecord => ({ ...topic, orphaned: true });

function fingerprintOf(site: ThrowSite): TwinRecord['fingerprint'] {
  return {
    exception: site.exception,
    message_pattern: site.message_pattern,
    source: `${site.file}:${site.line}`,
    raised_by: site.raised_by,
  };
}

function seedTwin(site: ThrowSite): TwinRecord {
  const partial = {
    id: site.id,
    // A published twin code cannot change meaning, and the exception class is
    // not one: naming it is the author's call, so the scan refuses to invent it.
    code: STUB,
    reason: STUB,
    fingerprint: fingerprintOf(site),
    docs: site.raised_by,
    orphaned: false,
  };
  return { ...partial, status: statusOf(twinStubFields({ ...partial, status: 'stub' })) };
}

function refreshTwin(twin: TwinRecord, site: ThrowSite): TwinRecord {
  const partial = { ...twin, fingerprint: fingerprintOf(site), docs: site.raised_by, orphaned: false };
  return { ...partial, status: statusOf(twinStubFields(partial), twin.status) };
}

/** One stub fix per twin, carrying the only part a machine can know: the pointer. */
function seedFix(twin: TwinRecord): FixRecord[] {
  return [
    {
      title: STUB,
      ...(twin.docs === '' ? {} : { docs: twin.docs }),
      status: 'stub',
    },
  ];
}

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const fileStem = (file: string): string => (file.split('/').pop() ?? file).replace(/\.[^.]+$/, '');

/**
 * Two different modules can export a same-named symbol (`export function
 * validate` in both src/a.ts and src/b.ts): `symbol.name` alone is NOT a
 * unique topic key. Left unhandled, keying topics by bare name would make
 * one export's signature/docstring silently vanish (the second scan
 * overwrites the first in a by-name Map) while its own throw sites still
 * carry `docs:` pointing at the SURVIVING, unrelated topic.
 *
 * Disambiguates every member of a colliding name-group to `name (file-stem)`
 * (both members, not just the second, so the result never depends on scan
 * order), and returns the rename lookup keyed by `file#name` so callers can
 * re-point a throw site's `docs` pointer at the correct disambiguated topic
 * for ITS OWN file.
 */
function disambiguateExports(
  exports: readonly ExportedSymbol[],
): { readonly symbols: readonly ExportedSymbol[]; readonly topicNameOf: ReadonlyMap<string, string> } {
  const byName = new Map<string, ExportedSymbol[]>();
  for (const symbol of exports) {
    const group = byName.get(symbol.name);
    if (group === undefined) byName.set(symbol.name, [symbol]);
    else group.push(symbol);
  }

  const topicNameOf = new Map<string, string>();
  const symbols: ExportedSymbol[] = [];
  for (const [name, group] of byName) {
    const deduped = uniqueBy(group, (symbol) => `${symbol.file}#${symbol.name}`);
    const colliding = deduped.length > 1;
    for (const symbol of deduped) {
      const topicName = colliding ? `${name} (${fileStem(symbol.file)})` : name;
      topicNameOf.set(`${symbol.file}#${symbol.name}`, topicName);
      symbols.push(colliding ? { ...symbol, name: topicName } : symbol);
    }
  }
  return { symbols, topicNameOf };
}

/**
 * Fold a fresh target scan into an existing corpus. Menu order is preserved
 * (order is a human curation act), new topics are appended in source order.
 */
export function mergeScan(existing: AuthoringCorpus, scan: TargetScan): AuthoringCorpus {
  const { symbols, topicNameOf } = disambiguateExports(scan.exports);
  const sites = uniqueBy(scan.throws, (site) => site.id).map((site) => {
    const topicName = topicNameOf.get(`${site.file}#${site.raised_by}`);
    return topicName === undefined || topicName === site.raised_by
      ? site
      : { ...site, raised_by: topicName };
  });
  const bySymbol = new Map(symbols.map((symbol) => [symbol.name, symbol]));
  const bySite = new Map(sites.map((site) => [site.id, site]));

  const kept = new Set(existing.topics.map((topic) => topic.topic));
  const topics = [
    ...existing.topics.map((topic) => {
      const symbol = bySymbol.get(topic.topic);
      return symbol === undefined ? orphanTopic(topic) : refreshTopic(topic, symbol);
    }),
    ...symbols.filter((symbol) => !kept.has(symbol.name)).map(seedTopic),
  ];

  const known = new Set(existing.twins.map((twin) => twin.id));
  const twins = [
    ...existing.twins.map((twin) => {
      const site = bySite.get(twin.id);
      return site === undefined ? { ...twin, orphaned: true } : refreshTwin(twin, site);
    }),
    ...sites.filter((site) => !known.has(site.id)).map(seedTwin),
  ];

  // Fixes are human-owned end to end: a skeleton appears only where there is
  // no entry at all, and an existing list is never rewritten.
  const fixes: Record<string, readonly FixRecord[]> = { ...existing.fixes };
  for (const twin of twins) {
    if (fixes[twin.id] === undefined) fixes[twin.id] = seedFix(twin);
  }

  return {
    provider: existing.provider,
    target: { package: scan.package, version: scan.version, source: scan.source },
    manifest_hint: existing.manifest_hint,
    // Human-owned, same as manifest_hint: a scan can never know a provider's
    // apply grammar, so it is carried through untouched. Found by review
    // (28-corpus-format): writeCorpus previously had no field to carry it
    // through at all, so a hand-added declared_schema was silently dropped
    // by the next scan.
    ...(existing.declared_schema === undefined ? {} : { declared_schema: existing.declared_schema }),
    topics,
    twins,
    fixes,
  };
}
