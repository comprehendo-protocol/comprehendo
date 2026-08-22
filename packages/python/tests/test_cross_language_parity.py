"""Cross-language parity, proven by running BOTH implementations.

CC2 [01] is a cross-language contract, and Wave 3's exit gate is this port
passing the kit unchanged. The strongest evidence available for "the two ports
behave identically" is not two suites that happen to be green: it is one
process running the TypeScript modules over the same input and the Python
suite asserting the two answers are equal.

That is what this file does. It is a PROCESS BOUNDARY test, same technique as
the CC5 budget gate: the parent (pytest) asserts what the child (node)
actually produced, and the child reads the same corpus and the same kit files
the Python side reads. It skips, loudly, when node is not available, because a
green that silently measured nothing is the failure mode this whole port
exists to avoid.

Where the two agree and a kit transcript shows something else, the transcript
is human-authored corpus-ranking data, not an engine contract: see
`tests/test_docs.py::TestWhereTheRankingAndTheTranscriptDiffer`.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

from comprehendo import canonical, create_twin_builder, unstructured_twin
from comprehendo.docs_vocabulary import build_aliases, match_topics, suggest

from .helpers.kit import PACKAGE_ROOT, kit_json
from .helpers.toy import PACKED_FIXTURE, toy_corpus
from .test_twin_kit import raise_site_of, topics_of

CORE_SRC = PACKAGE_ROOT.parent / "core" / "src"

QUERIES = (
    "how do I shard a capped collection",
    "how do I resize a capped collection in place",
    "$grup",
    "horizontal partitionin",
    "aggregation stages",
    "the SQL equivalent of GROUP BY",
    "how to count events per key",
    "zzzzqqqq",
    "   ",
)

#: Node strips TypeScript types natively from 22.6 on; the two modules this
#: driver imports have no runtime dependencies of their own.
DRIVER = """
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';

// The core's ESM specifiers are '.js' (what the compiled output will be);
// this driver imports the '.ts' sources directly, so the specifier is mapped
// back. Nothing under packages/core is written, copied, or patched: the
// mapping lives here, in this port's test tree.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL ?? '';
    if (specifier.endsWith('.js') && parent.includes('/packages/core/src/')) {
      return nextResolve(specifier.replace(/\\.js$/, '.ts'), context);
    }
    return nextResolve(specifier, context);
  },
});

const [corpusPath, twinPath] = process.argv.slice(2);
const { buildAliases, matchTopics, suggest } = await import('%(core)s/docs-vocabulary.ts');
const { createTwinBuilder, unstructuredTwin } = await import('%(core)s/twin.ts');

const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const aliases = buildAliases(corpus.index.map((name) => corpus.topics[name]));
const queries = %(queries)s;
const matcher = queries.map((query) => ({
  query,
  match: matchTopics(aliases, query),
  suggest: suggest(aliases, query),
}));

const jobs = JSON.parse(readFileSync(twinPath, 'utf8'));
const twins = jobs.map((job) =>
  job.code === 'UNSTRUCTURED'
    ? unstructuredTwin(job.received)
    : createTwinBuilder({
        declaredSchema: job.declared_schema,
        topics: job.topics,
        entries: [job.entry],
      }).build(job.code, job.context ?? undefined),
);

process.stdout.write(JSON.stringify({ matcher, twins }));
"""


def node_available() -> bool:
    return shutil.which("node") is not None and (CORE_SRC / "docs-vocabulary.ts").is_file()


requires_node = pytest.mark.skipif(
    not node_available(),
    reason="cross-language parity needs node and packages/core checked out",
)


def twin_jobs() -> list[dict[str, Any]]:
    """The same twins, described so either implementation can build them."""
    jobs: list[dict[str, Any]] = []
    for file in ("twin-round-trip.json", "did-you-mean.json", "forward-compat.json"):
        for step in kit_json("fixtures", file)["steps"]:
            if step["shape"] != "twin.schema.json":
                continue
            twin = step["response"]
            if twin["code"] == "UNSTRUCTURED":
                jobs.append({"code": "UNSTRUCTURED", "received": twin["received"]})
                continue
            entry, context = raise_site_of(twin)
            jobs.append(
                {
                    "code": twin["code"],
                    "declared_schema": {
                        "surface": "aggregate(pipeline)",
                        "operations": [
                            "$match",
                            "$sort",
                            "$limit",
                            "$project",
                            "$group",
                            "$count",
                        ],
                    },
                    "topics": topics_of(twin),
                    "entry": entry,
                    "context": context,
                }
            )
    return jobs


@pytest.fixture(scope="module")
def reference(tmp_path_factory: pytest.TempPathFactory) -> Any:
    """What the TypeScript implementation answers, for the same inputs."""
    tmp: Path = tmp_path_factory.mktemp("parity")
    driver = tmp / "driver.mjs"
    driver.write_text(
        DRIVER
        % {
            "core": CORE_SRC.as_posix(),
            "queries": json.dumps(list(QUERIES)),
        },
        encoding="utf-8",
    )
    jobs = tmp / "twins.json"
    jobs.write_text(json.dumps(twin_jobs()), encoding="utf-8")

    finished = subprocess.run(
        [
            "node",
            "--experimental-strip-types",
            "--no-warnings",
            str(driver),
            str(PACKED_FIXTURE),
            str(jobs),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    if finished.returncode != 0:
        pytest.skip(f"the TypeScript reference did not run: {finished.stderr.strip()[:400]}")
    return json.loads(finished.stdout)


@requires_node
class TestTheMatcherAgreesAcrossLanguages:
    def test_the_child_really_ran_and_answered(self, reference: Any) -> None:
        assert len(reference["matcher"]) == len(QUERIES)
        assert any(entry["suggest"] for entry in reference["matcher"])

    def test_match_topics_returns_the_identical_list_for_every_query(
        self, reference: Any
    ) -> None:
        aliases = build_aliases([toy_corpus()["topics"][n] for n in toy_corpus()["index"]])

        for entry in reference["matcher"]:
            assert match_topics(aliases, entry["query"]) == entry["match"], entry["query"]

    def test_suggest_returns_the_identical_list_for_every_query(self, reference: Any) -> None:
        aliases = build_aliases([toy_corpus()["topics"][n] for n in toy_corpus()["index"]])

        for entry in reference["matcher"]:
            assert suggest(aliases, entry["query"]) == entry["suggest"], entry["query"]

    def test_including_the_two_queries_whose_ranking_differs_from_the_transcript(
        self, reference: Any
    ) -> None:
        answers = {entry["query"]: entry["suggest"] for entry in reference["matcher"]}

        assert answers["how do I shard a capped collection"] == [
            "capped collections",
            "sharding",
        ]
        assert answers["how do I resize a capped collection in place"] == [
            "capped collections",
            "$match",
        ]


@requires_node
class TestTheTwinBuilderAgreesByteForByte:
    def test_every_twin_serializes_to_the_identical_bytes(self, reference: Any) -> None:
        jobs = twin_jobs()

        assert len(reference["twins"]) == len(jobs)
        for job, from_node in zip(jobs, reference["twins"], strict=True):
            if job["code"] == "UNSTRUCTURED":
                built: Any = unstructured_twin(job["received"])
            else:
                built = create_twin_builder(
                    {
                        "declared_schema": job["declared_schema"],
                        "topics": job["topics"],
                        "entries": [job["entry"]],
                    }
                ).build(job["code"], job["context"])

            assert canonical(built) == canonical(from_node), job["code"]

    def test_and_the_field_order_is_the_same_in_both(self, reference: Any) -> None:
        for from_node in reference["twins"]:
            assert list(from_node)[:3] == ["comprehendo", "code", "reason"]
            assert list(from_node)[-1] == "fixes"
