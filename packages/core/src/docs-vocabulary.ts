// Docs Engine [13], the three-vocabulary matcher. Pure functions, no I/O and
// no imports at all: given the vocabularies a corpus serves, decide which
// topic a query asked for, or what it was near. Split out of docs.ts because
// this is the part worth testing on its own terms.
//
// The three tiers (the tool's own words, a known tool's words, plain task
// language) are deliberately NOT ranked against each other. A query resolves
// through whichever tier it happens to be phrased in, which is the whole
// point: fluency in one tool has to interview an unknown one.

/** Ranking knobs. A candidate below the floor is noise, not a suggestion. */
export const NEAREST_LIMIT = 3;
const NEAREST_FLOOR = 0.5;
const PREFIX_MIN = 3;
const FUZZY_MIN_LEN = 4;
const STOPWORDS = new Set([
  'the', 'and', 'for', 'into', 'with', 'how', 'this', 'that', 'from',
  'are', 'you', 'your', 'what', 'when', 'where', 'why', 'does', 'did',
]);

/** The corpus-side authoring data this module indexes, structurally. */
export interface VocabularySource {
  readonly topic: string;
  readonly vocabularies_served: {
    readonly own_terms: readonly string[];
    readonly translations: readonly { readonly terms: readonly string[] }[];
    readonly task: readonly string[];
  };
}

export interface Alias {
  readonly topic: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
  readonly ranked: readonly string[];
}

export const normalize = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9$_-]+/g, ' ').trim();

const tokenize = (text: string): string[] =>
  normalize(text).split(' ').filter((token) => token.length > 0);

/** Tokens worth ranking on: a stopword match is not evidence of a near miss. */
function significant(tokens: readonly string[]): string[] {
  const kept = tokens.filter((token) => token.length >= 3 && !STOPWORDS.has(token));
  return kept.length > 0 ? kept : [...tokens];
}

/** Every phrase any of the three tiers accepts, flattened, corpus order kept. */
export function buildAliases(topics: readonly VocabularySource[]): Alias[] {
  const aliases: Alias[] = [];
  for (const topic of topics) {
    const served = topic.vocabularies_served;
    const phrases = [
      topic.topic,
      ...served.own_terms,
      ...served.translations.flatMap((tier) => tier.terms),
      ...served.task,
    ];
    for (const phrase of new Set(phrases.map(normalize))) {
      const tokens = phrase.split(' ').filter((token) => token.length > 0);
      if (tokens.length === 0) continue;
      aliases.push({ topic: topic.topic, normalized: phrase, tokens, ranked: significant(tokens) });
    }
  }
  return aliases;
}

/**
 * All three vocabularies resolve the same way: an exact phrase wins outright,
 * otherwise an alias whose every token is present in the query scores by how
 * many tokens it pinned down. Returns the topics tied at the best score, so a
 * caller can tell one answer from an ambiguity it must not guess at.
 */
export function matchTopics(aliases: readonly Alias[], query: string): string[] {
  const normalized = normalize(query);
  if (normalized === '') return [];
  const asked = new Set(normalized.split(' '));

  const exact = aliases.filter((alias) => alias.normalized === normalized);
  if (exact.length > 0) return [...new Set(exact.map((alias) => alias.topic))];

  let best = 0;
  const topics = new Set<string>();
  for (const alias of aliases) {
    if (!alias.tokens.every((token) => asked.has(token))) continue;
    if (alias.tokens.length > best) {
      best = alias.tokens.length;
      topics.clear();
    }
    if (alias.tokens.length === best) topics.add(alias.topic);
  }
  return [...topics];
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(
        Math.min((row[j - 1] ?? 0) + 1, (previous[j] ?? 0) + 1, (previous[j - 1] ?? 0) + cost),
      );
    }
    previous = row;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

/** Shared prefix or edit distance, whichever is kinder. Short words: exact only. */
function tokenSimilarity(term: string, token: string): number {
  if (term === token) return 1;
  if (term.length < FUZZY_MIN_LEN || token.length < FUZZY_MIN_LEN) return 0;
  let prefix = 0;
  while (prefix < term.length && prefix < token.length && term[prefix] === token[prefix]) {
    prefix += 1;
  }
  const byPrefix = prefix >= PREFIX_MIN ? prefix / Math.min(term.length, token.length) : 0;
  const byEdit = 1 - levenshtein(term, token) / Math.max(term.length, token.length);
  return Math.max(byPrefix, byEdit);
}

function aliasScore(alias: Alias, asked: readonly string[]): number {
  let total = 0;
  for (const term of alias.ranked) {
    let best = 0;
    for (const token of asked) best = Math.max(best, tokenSimilarity(term, token));
    if (best >= NEAREST_FLOOR) total += best;
  }
  return total / alias.ranked.length;
}

/**
 * Did-you-mean, ranked across all three tiers at once. Deliberately allowed to
 * come back empty: padding it with the nearest thing in the corpus is exactly
 * the confident wrong answer UNDOCUMENTED exists to avoid.
 */
export function suggest(aliases: readonly Alias[], query: string): string[] {
  const asked = tokenize(query);
  if (asked.length === 0) return [];
  const scores = new Map<string, number>();
  for (const alias of aliases) {
    const score = aliasScore(alias, asked);
    if (score < NEAREST_FLOOR) continue;
    if (score > (scores.get(alias.topic) ?? 0)) scores.set(alias.topic, score);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, NEAREST_LIMIT)
    .map(([topic]) => topic);
}
