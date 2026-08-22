"""Docs Engine [13]: the `docs(query?)` surface.

PACKED-CORPUS ARTIFACT, format version 1. Defined by this component because
this engine is the runtime that reads it; Corpus Generator [17] writes it. One
JSON file carrying `comprehendo`, `packed`, `provider`, `index` (topic names in
menu order), and `topics` (one entry per index name: the `topic.schema.json`
fields plus a `vocabularies_served` block with `own_terms`, `translations`,
`task`).

The whole corpus is one file, read once. `vocabularies_served` is authoring
data: it is what the matcher indexes and it never appears in a response, so a
topic answer stays inside its CC5 [02] budget.

Only two things are touched outside this module: the artifact is read, and
every lookup is appended to a local file. Nothing in this engine can reach a
network (CC6 [27]); `test_docs_miss_log.py` asserts that structurally, over
this module AND everything it imports, because a transitive import is exactly
what would defeat the guarantee.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Literal, NotRequired, TypedDict, cast

from ._frozen import freeze
from .docs_vocabulary import NEAREST_LIMIT, Alias, build_aliases, match_topics, suggest

__all__ = [
    "COMPREHENDO_VERSION",
    "DEFAULT_LOG_PATH",
    "PACKED_CORPUS_FORMAT",
    "DocsIndex",
    "DocsOptions",
    "DocsResponse",
    "DocsSurface",
    "DocsTopic",
    "LogStats",
    "LookupRecord",
    "LookupSink",
    "PackedCorpus",
    "PackedTopic",
    "TopicExample",
    "TranslationVocabulary",
    "Undocumented",
    "VocabulariesServed",
    "create_docs",
    "load_packed_corpus",
    "parse_packed_corpus",
]

COMPREHENDO_VERSION = "0.1"
PACKED_CORPUS_FORMAT = 1
DEFAULT_LOG_PATH = ".comprehendo/docs-usage.log"

#: The topic response's optional fields, in the order `topic.schema.json`
#: declares them, which IS their serialization order (CC2 [01]).
_TOPIC_OPTIONAL = ("signatures", "examples", "see_also")


class TopicExample(TypedDict):
    title: str
    code: str


class TranslationVocabulary(TypedDict):
    known_tool: str
    terms: list[str]


class VocabulariesServed(TypedDict):
    own_terms: list[str]
    translations: list[TranslationVocabulary]
    task: list[str]


class PackedTopic(TypedDict):
    topic: str
    summary: str
    signatures: NotRequired[list[str]]
    examples: NotRequired[list[TopicExample]]
    see_also: NotRequired[list[str]]
    vocabularies_served: VocabulariesServed


class PackedCorpus(TypedDict):
    comprehendo: str
    packed: int
    provider: str
    index: list[str]
    topics: dict[str, PackedTopic]


class DocsIndex(TypedDict):
    """`docs()` with no argument: the menu, never the meal (index.schema.json)."""

    topics: list[str]


class DocsTopic(TypedDict):
    """One topic-sized answer (topic.schema.json)."""

    topic: str
    summary: str
    signatures: NotRequired[list[str]]
    examples: NotRequired[list[TopicExample]]
    see_also: NotRequired[list[str]]


class Undocumented(TypedDict):
    """The honest miss (undocumented.schema.json)."""

    comprehendo: str
    code: Literal["UNDOCUMENTED"]
    query: str
    nearest: list[str]
    source_permitted: Literal[True]


DocsResponse = DocsIndex | DocsTopic | Undocumented


class LookupRecord(TypedDict):
    query: str | None
    timestamp: str
    result: Literal["index", "hit", "miss"]
    topic: NotRequired[str]


LookupSink = Callable[[LookupRecord], None]


class LogStats(TypedDict):
    written: int
    failed: int


class DocsOptions(TypedDict):
    log_path: NotRequired[str]
    sink: NotRequired[LookupSink]
    now: NotRequired[Callable[[], datetime]]


def _is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _assert_translations(name: str, value: Any) -> None:
    """`vocabularies_served.translations[]`'s own shape, validated at parse time
    rather than left to whatever downstream code first happens to read `.terms`.

    A malformed entry here would otherwise pass `parse_packed_corpus` cleanly
    and only surface as an unrelated-looking crash inside the matcher, which
    contradicts "refuses a malformed artifact, never guesses": a caller that
    treats a successful parse as "the artifact is valid" has to be right.
    """
    if not isinstance(value, list):
        raise TypeError(f'packed corpus topic "{name}" carries a non-list translations list')
    for index, entry in enumerate(value):
        translation = entry if isinstance(entry, dict) else {}
        if not isinstance(translation.get("known_tool"), str):
            raise TypeError(
                f'packed corpus topic "{name}" translations[{index}] carries no known_tool'
            )
        if not _is_string_list(translation.get("terms")):
            raise TypeError(
                f'packed corpus topic "{name}" translations[{index}] carries a '
                "non-string-list terms"
            )


def _assert_topic(name: str, value: Any) -> None:
    topic = value if isinstance(value, dict) else {}
    if not isinstance(topic.get("topic"), str) or topic["topic"] != name:
        raise TypeError(f'packed corpus topic "{name}" does not name itself')
    summary = topic.get("summary")
    if not isinstance(summary, str) or summary == "":
        raise TypeError(f'packed corpus topic "{name}" carries no summary')

    served = topic.get("vocabularies_served") or {}
    if not isinstance(served, dict):
        raise TypeError(f'packed corpus topic "{name}" carries a malformed vocabularies_served')
    if "own_terms" in served and not _is_string_list(served["own_terms"]):
        raise TypeError(f'packed corpus topic "{name}" carries a non-string-list own_terms')
    if "translations" in served:
        _assert_translations(name, served["translations"])
    if "task" in served and not _is_string_list(served["task"]):
        raise TypeError(f'packed corpus topic "{name}" carries a non-string-list task')

    terms = (
        len(served.get("own_terms") or [])
        + len(served.get("translations") or [])
        + len(served.get("task") or [])
    )
    if terms == 0:
        raise TypeError(
            f'packed corpus topic "{name}" serves no vocabulary, so nothing could ever reach it'
        )


def parse_packed_corpus(raw: Any) -> PackedCorpus:
    """Read an in-memory artifact, refusing anything this runtime cannot answer from."""
    corpus = raw if isinstance(raw, dict) else {}
    packed = corpus.get("packed")
    if not isinstance(packed, int) or isinstance(packed, bool):
        raise TypeError('a packed corpus must declare its "packed" format version')
    if packed != PACKED_CORPUS_FORMAT:
        raise ValueError(
            f"unsupported packed corpus format version {packed}; "
            f"this runtime reads version {PACKED_CORPUS_FORMAT}"
        )
    if not isinstance(corpus.get("comprehendo"), str) or not isinstance(
        corpus.get("provider"), str
    ):
        raise TypeError('a packed corpus must declare "comprehendo" and "provider"')
    if not _is_string_list(corpus.get("index")) or not isinstance(corpus.get("topics"), dict):
        raise TypeError('a packed corpus must carry an "index" list and a "topics" map')

    for name in corpus["index"]:
        if name not in corpus["topics"]:
            raise TypeError(
                f'the packed index advertises "{name}", which the artifact does not carry'
            )
    advertised = set(corpus["index"])
    for name, topic in corpus["topics"].items():
        if name not in advertised:
            raise TypeError(
                f'the packed artifact carries "{name}", which its index never advertises'
            )
        _assert_topic(name, topic)

    return cast(PackedCorpus, corpus)


def load_packed_corpus(path: str) -> PackedCorpus:
    """The one artifact, read once. This engine never enumerates a folder."""
    return parse_packed_corpus(json.loads(Path(path).read_text(encoding="utf-8")))


def _topic_response(topic: PackedTopic) -> DocsTopic:
    """The topic-sized answer, without the corpus-side matching data."""
    answer: dict[str, Any] = {"topic": topic["topic"], "summary": topic["summary"]}
    for field in _TOPIC_OPTIONAL:
        if field in topic:
            answer[field] = topic[field]  # type: ignore[literal-required]
    return freeze(cast(DocsTopic, answer))


def _undocumented(query: str, nearest: list[str]) -> Undocumented:
    answer: Undocumented = {
        "comprehendo": COMPREHENDO_VERSION,
        "code": "UNDOCUMENTED",
        "query": query,
        "nearest": nearest,
        "source_permitted": True,
    }
    return freeze(answer)


def _file_sink(log_path: str) -> LookupSink:
    """Append-only local file, one JSON object per line. Never transmitted."""
    target = Path(log_path).resolve()

    def write(record: LookupRecord) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a", encoding="utf-8") as handle:
            handle.write(f"{json.dumps(record)}\n")

    return write


def _aliases_of(corpus: PackedCorpus) -> list[Alias]:
    topics = [corpus["topics"][name] for name in corpus["index"] if name in corpus["topics"]]
    return build_aliases(list(topics))


class _Docs:
    """The `docs(query?)` surface bound to one corpus, plus its log counters."""

    __slots__ = ("_aliases", "_clock", "_corpus", "_failed", "_record_sink", "_written")

    def __init__(self, corpus: PackedCorpus, options: DocsOptions) -> None:
        self._corpus = corpus
        self._aliases = _aliases_of(corpus)
        self._clock = options.get("now") or (lambda: datetime.now(timezone.utc))
        sink = options.get("sink")
        self._record_sink: LookupSink = (
            sink if sink is not None else _file_sink(options.get("log_path") or DEFAULT_LOG_PATH)
        )
        self._written = 0
        self._failed = 0

    def _record(self, entry: LookupRecord) -> None:
        # A log this engine cannot write is never a reason not to answer, but a
        # silent failure is how a broken subsystem looks like a quiet week:
        # count it (logging rule, suppression needs a counter).
        try:
            self._record_sink(entry)
        except Exception:  # noqa: BLE001, any sink failure is the sink's, not the answer's
            self._failed += 1
        else:
            self._written += 1

    def __call__(self, query: str | None = None) -> DocsResponse:
        timestamp = self._clock().isoformat()
        if query is None:
            self._record({"query": None, "timestamp": timestamp, "result": "index"})
            index: DocsIndex = {"topics": self._corpus["index"]}
            return freeze(index)

        candidates = match_topics(self._aliases, query)
        only = self._corpus["topics"].get(candidates[0]) if len(candidates) == 1 else None
        if only is not None:
            self._record(
                {
                    "query": query,
                    "timestamp": timestamp,
                    "result": "hit",
                    "topic": only["topic"],
                }
            )
            return _topic_response(only)

        # Ambiguity names its candidates rather than picking one of them. Capped
        # the same as the fuzzy-suggest path (NEAREST_LIMIT): a corpus with more
        # than a handful of exact ties would otherwise return an unbounded list,
        # contradicting "did-you-mean is bounded, never the size of the corpus".
        nearest = (
            candidates[:NEAREST_LIMIT] if len(candidates) > 1 else suggest(self._aliases, query)
        )
        self._record({"query": query, "timestamp": timestamp, "result": "miss"})
        return _undocumented(query, nearest)

    def log_stats(self) -> LogStats:
        return {"written": self._written, "failed": self._failed}


#: What `create_docs` hands back: callable, and carrying its own log counters.
DocsSurface = _Docs


def create_docs(corpus: PackedCorpus, options: DocsOptions | None = None) -> DocsSurface:
    """The `docs(query?)` surface bound to `corpus`.

    `options` is `{log_path?, sink?, now?}`; the returned surface also carries
    `log_stats()` -> `{written, failed}`.
    """
    return _Docs(corpus, options or {})
