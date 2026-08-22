"""Docs Engine [13], the three-vocabulary matcher. Pure functions, no I/O and
no imports beyond typing: given the vocabularies a corpus serves, decide which
topic a query asked for, or what it was near. Split out of `docs.py` because
this is the part worth testing on its own terms.

The three tiers (the tool's own words, a known tool's words, plain task
language) are deliberately NOT ranked against each other. A query resolves
through whichever tier it happens to be phrased in, which is the whole point:
fluency in one tool has to interview an unknown one.
"""

from __future__ import annotations

from typing import Any, TypedDict

__all__ = [
    "NEAREST_LIMIT",
    "Alias",
    "build_aliases",
    "match_topics",
    "normalize",
    "suggest",
]

#: Ranking knobs. A candidate below the floor is noise, not a suggestion.
NEAREST_LIMIT = 3
_NEAREST_FLOOR = 0.5
_PREFIX_MIN = 3
_FUZZY_MIN_LEN = 4
_STOPWORDS = frozenset(
    {
        "the", "and", "for", "into", "with", "how", "this", "that", "from",
        "are", "you", "your", "what", "when", "where", "why", "does", "did",
    }
)

#: The characters a normalized phrase keeps. Everything else becomes a space,
#: so `$group` and `see_also` survive while punctuation does not.
_KEPT = frozenset("abcdefghijklmnopqrstuvwxyz0123456789$_-")


class Alias(TypedDict):
    """One phrase any of the three tiers accepts, indexed for matching."""

    topic: str
    normalized: str
    tokens: list[str]
    ranked: list[str]


def normalize(text: str) -> str:
    """Lowercase, punctuation to spaces, operator characters kept, trimmed."""
    lowered = text.lower()
    out: list[str] = []
    for char in lowered:
        out.append(char if char in _KEPT else " ")
    return " ".join("".join(out).split())


def _tokenize(text: str) -> list[str]:
    return [token for token in normalize(text).split(" ") if token]


def _significant(tokens: list[str]) -> list[str]:
    """Tokens worth ranking on: a stopword match is not evidence of a near miss."""
    kept = [token for token in tokens if len(token) >= 3 and token not in _STOPWORDS]
    return kept if kept else list(tokens)


def build_aliases(topics: list[Any]) -> list[Alias]:
    """Every phrase any of the three tiers accepts, flattened, corpus order kept."""
    aliases: list[Alias] = []
    for topic in topics:
        served = topic["vocabularies_served"]
        phrases: list[str] = [topic["topic"]]
        phrases.extend(served.get("own_terms") or [])
        for tier in served.get("translations") or []:
            phrases.extend(tier.get("terms") or [])
        phrases.extend(served.get("task") or [])

        seen: set[str] = set()
        for phrase in phrases:
            normalized = normalize(phrase)
            if normalized in seen:
                continue
            seen.add(normalized)
            tokens = [token for token in normalized.split(" ") if token]
            if not tokens:
                continue
            aliases.append(
                {
                    "topic": topic["topic"],
                    "normalized": normalized,
                    "tokens": tokens,
                    "ranked": _significant(tokens),
                }
            )
    return aliases


def match_topics(aliases: list[Alias], query: str) -> list[str]:
    """All three vocabularies resolve the same way: an exact phrase wins
    outright, otherwise an alias whose every token is present in the query
    scores by how many tokens it pinned down.

    Returns the topics tied at the best score, so a caller can tell one answer
    from an ambiguity it must not guess at.
    """
    normalized = normalize(query)
    if normalized == "":
        return []
    asked = set(normalized.split(" "))

    exact: list[str] = []
    for alias in aliases:
        if alias["normalized"] == normalized and alias["topic"] not in exact:
            exact.append(alias["topic"])
    if exact:
        return exact

    best = 0
    topics: list[str] = []
    for alias in aliases:
        if not all(token in asked for token in alias["tokens"]):
            continue
        if len(alias["tokens"]) > best:
            best = len(alias["tokens"])
            topics = []
        if len(alias["tokens"]) == best and alias["topic"] not in topics:
            topics.append(alias["topic"])
    return topics


def _levenshtein(a: str, b: str) -> int:
    previous = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        row = [i]
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            row.append(min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost))
        previous = row
    return previous[len(b)]


def _token_similarity(term: str, token: str) -> float:
    """Shared prefix or edit distance, whichever is kinder. Short words: exact only."""
    if term == token:
        return 1.0
    if len(term) < _FUZZY_MIN_LEN or len(token) < _FUZZY_MIN_LEN:
        return 0.0
    prefix = 0
    while prefix < len(term) and prefix < len(token) and term[prefix] == token[prefix]:
        prefix += 1
    by_prefix = prefix / min(len(term), len(token)) if prefix >= _PREFIX_MIN else 0.0
    by_edit = 1 - _levenshtein(term, token) / max(len(term), len(token))
    return max(by_prefix, by_edit)


def _alias_score(alias: Alias, asked: list[str]) -> float:
    total = 0.0
    for term in alias["ranked"]:
        best = 0.0
        for token in asked:
            best = max(best, _token_similarity(term, token))
        if best >= _NEAREST_FLOOR:
            total += best
    return total / len(alias["ranked"])


def suggest(aliases: list[Alias], query: str) -> list[str]:
    """Did-you-mean, ranked across all three tiers at once.

    Deliberately allowed to come back empty: padding it with the nearest thing
    in the corpus is exactly the confident wrong answer UNDOCUMENTED exists to
    avoid.
    """
    asked = _tokenize(query)
    if not asked:
        return []
    scores: dict[str, float] = {}
    for alias in aliases:
        score = _alias_score(alias, asked)
        if score < _NEAREST_FLOOR:
            continue
        if score > scores.get(alias["topic"], 0.0):
            scores[alias["topic"]] = score
    ranked = sorted(scores.items(), key=lambda item: -item[1])
    return [topic for topic, _ in ranked[:NEAREST_LIMIT]]
