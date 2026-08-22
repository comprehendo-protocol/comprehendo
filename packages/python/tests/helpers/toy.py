"""The toy package the SDK Entry suites build with `make_provider`.

One place, because the acceptance criterion is literally "a toy package built
with makeProvider passes the full kit": every sdk suite drives THIS package
rather than re-inlining a provider each, so what the composition tests
exercise and what the kit walkthrough exercises cannot drift apart. Mirrors
`packages/core/test/helpers/{catalog,toy-provider}.ts` value for value, so a
divergence between the two ports shows up as a failing assertion rather than
as two suites quietly testing different things.
"""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Literal

from comprehendo import (
    CatalogEntry,
    DeclaredCallSchema,
    Explanation,
    LookupRecord,
    PackedCorpus,
    ProviderCatalog,
    ProviderHooks,
    TwinResolution,
)

from .kit import KIT_ROOT, PACKAGE_ROOT

__all__ = [
    "PRIMING_REFERENCE",
    "TOY_IDENTITY",
    "TOY_PRIMING",
    "TOY_RAW_CATALOGED",
    "TOY_RAW_NOVEL",
    "ToyRuntime",
    "catalog",
    "catch_all_resolver",
    "declared_schema",
    "sort_entry",
    "sort_resolver",
    "topics",
    "toy_catalog",
    "toy_corpus",
    "toy_explain",
    "toy_hooks",
    "toy_validate",
]

PACKED_FIXTURE = PACKAGE_ROOT / "tests" / "fixtures" / "mongodb-operator.packed.json"

# The provider's declared call surface, same shape the negative kit declares.
declared_schema: DeclaredCallSchema = {
    "surface": "aggregate(pipeline)",
    "operations": ["$match", "$sort", "$limit", "$project", "$group", "$count"],
}

# The provider's corpus index: the topics a `docs` pointer can resolve to.
topics = ("index selection", "capped collections")

# One cataloged failure, two fixes, in the author's most-likely-first order.
sort_entry: CatalogEntry = {
    "code": "SORT_UNINDEXED_SPILL",
    "reason": (
        "The sort at pipeline[1] has no index to satisfy it, so it would buffer "
        "the whole matched set in memory."
    ),
    "path": "pipeline[1].$sort",
    "namespace": "analytics.events",
    "fixes": [
        {
            "title": "Sort on the indexed field the pipeline already filters on",
            "apply": [
                {"$match": {"status": "active"}},
                {"$sort": {"status": 1, "created_at": -1}},
            ],
            "docs": "index selection",
            "confidence": "high",
        },
        {
            "title": "Narrow the match before sorting, so the sort fits the memory ceiling",
            "apply": [{"$match": {"status": "active"}}, {"$limit": 20}],
            "confidence": "likely",
        },
    ],
}

#: The raw driver text the kit uses for the un-cataloged failure.
RAW = "Sort exceeded memory limit of 33554432 bytes"

TOY_RAW_CATALOGED = RAW

#: A raw failure nothing in the toy catalog covers: the UNSTRUCTURED path.
TOY_RAW_NOVEL = "connection 4 to cluster0-shard-00-02 closed"

#: The toy's identity and priming, read from the kit's own probe-hit entry
#: rather than retyped. Two reasons, both load-bearing: the toy provider's
#: entry then equals `probe-hit.json`'s entry field for field (which is the
#: acceptance criterion, not an approximation of it), and no copy of the
#: reference snippet lands in this package, whose SOURCE a CC9 [10] scan reads
#: without understanding semantics.
_KIT_ENTRY: dict[str, Any] = json.loads(
    (KIT_ROOT / "fixtures" / "probe-hit.json").read_text(encoding="utf-8")
)["steps"][0]["response"]

TOY_IDENTITY: str = _KIT_ENTRY["identity"]
TOY_PRIMING: str = _KIT_ENTRY["priming"]

#: The RFC 5.5 reference snippet as the budget harness measures it. Kept
#: separate from the entry above: one is the measured artifact, the other is
#: what a provider actually ships.
PRIMING_REFERENCE = (KIT_ROOT / "budget" / "fixtures" / "priming.reference.md").read_text(
    encoding="utf-8"
).strip()


def catalog(*entries: CatalogEntry) -> ProviderCatalog:
    """A provider catalog over the shared schema and index.

    Deep-copied on the way out. `sort_entry` is module state shared by every
    suite, and a test that edits its catalog to prove the gate fires would
    otherwise poison every test that ran after it, which reads as an unrelated
    failure three files later.
    """
    return {
        "declared_schema": deepcopy(declared_schema),
        "topics": list(topics),
        "entries": [deepcopy(entry) for entry in entries],
    }


def toy_corpus() -> PackedCorpus:
    """The packed artifact the toy package ships. Read fresh, never mutated."""
    corpus: PackedCorpus = json.loads(PACKED_FIXTURE.read_text(encoding="utf-8"))
    return corpus


def toy_catalog(corpus: PackedCorpus, *extra: CatalogEntry) -> ProviderCatalog:
    """The toy catalog, whose `topics` is the REAL corpus index, deep-copied."""
    return {
        "declared_schema": deepcopy(declared_schema),
        "topics": list(corpus["index"]),
        "entries": [deepcopy(entry) for entry in (sort_entry, *extra)],
    }


def sort_resolver(raw: Any) -> TwinResolution | None:
    """The throw site: raw driver text in, the cataloged code plus site detail out."""
    if isinstance(raw, str) and raw.startswith("Sort exceeded memory limit"):
        return {
            "code": "SORT_UNINDEXED_SPILL",
            "context": {"received": raw, "namespace": "analytics.events"},
        }
    return None


def catch_all_resolver(raw: Any) -> TwinResolution | None:
    """A second throw site, used to prove resolver order: it claims everything."""
    return {"code": "SORT_UNINDEXED_SPILL", "context": {"path": "catch-all"}}


def _is_stage(stage: Any, operator: str) -> bool:
    return isinstance(stage, dict) and operator in stage


class ToyRuntime:
    """The toy's observable state: what ran, and what was looked up."""

    def __init__(self) -> None:
        self.executions = 0
        self.lookups: list[LookupRecord] = []

    def execute(self, value: Any) -> Any:
        """The toy's REAL call, the one thing validate and explain must never reach."""
        self.executions += 1
        return value


def toy_validate(runtime: ToyRuntime) -> Any:
    """The judge-without-executing hook: it reads the pipeline, it never runs one."""

    def judge(value: Any) -> Any:
        stages = value if isinstance(value, list) else [value]
        if any(_is_stage(stage, "$merge") for stage in stages):
            return {
                "unvalidatable": (
                    "The $merge target is computed from each document's own data, so "
                    "whether it names a collection this operator may write to cannot "
                    "be decided without executing the pipeline."
                )
            }
        if any(_is_stage(stage, "$sort") for stage in stages) and not any(
            _is_stage(stage, "$match") for stage in stages
        ):
            return {
                "code": "SORT_UNINDEXED_SPILL",
                "context": {"path": "pipeline[0].$sort", "namespace": "analytics.events"},
            }
        return {"valid": True}

    return judge


def toy_explain(runtime: ToyRuntime) -> Any:
    """Show what would run, without running it."""

    def explainer(value: Any) -> Explanation:
        return {
            "would_execute": {
                "aggregate": "events",
                "pipeline": value,
                "cursor": {"batchSize": 101},
                "readConcern": {"level": "majority"},
                "maxTimeMS": 5000,
            },
            # Verbatim from the kit's probe-hit transcript, so
            # `provider.explain(input)` reproduces it field for field rather
            # than approximately.
            "notes": [
                "applied the operator's default read concern, majority",
                "applied the operator's default deadline, 5000 ms",
                "resolved the collection name from the handle, events",
            ],
        }

    return explainer


Judge = Literal["both", "validate", "explain", "none"]


def toy_hooks(
    judge: Judge = "both",
    runtime: ToyRuntime | None = None,
    resolvers: list[Any] | None = None,
    corpus: PackedCorpus | None = None,
) -> ProviderHooks:
    """The toy package's hooks, with the judge surfaces switchable per test."""
    runtime = runtime if runtime is not None else ToyRuntime()
    corpus = corpus if corpus is not None else toy_corpus()
    hooks: ProviderHooks = {
        "catalog": toy_catalog(corpus),
        "identity": TOY_IDENTITY,
        "priming": TOY_PRIMING,
        "twin_resolvers": list(resolvers) if resolvers is not None else [sort_resolver],
        "docs": {"sink": runtime.lookups.append},
    }
    if judge in ("both", "validate"):
        hooks["validate"] = toy_validate(runtime)
    if judge in ("both", "explain"):
        hooks["explain"] = toy_explain(runtime)
    return hooks


def toy_paths() -> dict[str, Path]:
    """Where the toy's own artifacts live, for tests that need real files."""
    return {"packed": PACKED_FIXTURE, "kit": KIT_ROOT}
