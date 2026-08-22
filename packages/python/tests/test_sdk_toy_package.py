"""The acceptance criterion, literally: a toy package built with
`make_provider` passes the full kit.

Marker on the export, on every raised error, and on a controlled handle;
twins at the declared throw sites; UNSTRUCTURED passthrough; three-vocabulary
docs; UNDOCUMENTED with a working miss log; and the level-2 surfaces. Every
expectation is read from `packages/spec/kit`, unmodified.
"""

from __future__ import annotations

from typing import Any

import pytest

from comprehendo import make_provider, probe, resolve_discovery

from .helpers.kit import kit_json
from .helpers.toy import (
    TOY_RAW_CATALOGED,
    TOY_RAW_NOVEL,
    ToyRuntime,
    toy_corpus,
    toy_hooks,
)
from .test_docs import assert_same_answer


class Cursor:
    """A controlled handle: the third value shape a provider marks."""


@pytest.fixture()
def runtime() -> ToyRuntime:
    return ToyRuntime()


@pytest.fixture()
def provider(runtime: ToyRuntime) -> Any:
    return make_provider(toy_corpus(), toy_hooks("both", runtime))


class TestTheProbeTranscriptHit:
    def test_the_probe_answers_with_the_kits_own_entry(self, provider: Any) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][0]

        assert probe(provider) == step["response"]

    def test_docs_with_no_argument_answers_the_kits_index(self, provider: Any) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][1]

        assert provider.docs() == step["response"]

    def test_one_question_gets_one_topic_sized_answer(self, provider: Any) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][2]

        assert provider.docs(step["input"]) == step["response"]

    def test_validate_abstains_exactly_as_the_kit_transcript_does(self, provider: Any) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][3]

        assert provider.validate(step["input"]) == step["response"]

    def test_explain_shows_what_would_run_without_running_it(
        self, provider: Any, runtime: ToyRuntime
    ) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][4]

        assert provider.explain(step["input"]) == step["response"]
        assert runtime.executions == 0


class TestTheProbeTranscriptMiss:
    def test_the_probe_still_hits_a_miss_on_one_question_is_not_a_miss_on_the_contract(
        self, provider: Any
    ) -> None:
        steps = kit_json("fixtures", "probe-miss.json")["steps"]

        assert probe(provider) == steps[0]["response"]
        assert_same_answer(provider.docs(steps[1]["input"]), steps[1]["response"])

    def test_the_miss_is_recorded_locally_and_nothing_is_transmitted(
        self, provider: Any, runtime: ToyRuntime
    ) -> None:
        provider.docs("how do I shard a capped collection")

        assert runtime.lookups[-1]["result"] == "miss"
        assert runtime.lookups[-1]["query"] == "how do I shard a capped collection"


class TestMidFailureDiscovery:
    def test_an_agent_that_never_probed_learns_the_path_from_the_twin_it_caught(
        self, provider: Any
    ) -> None:
        fixture = kit_json("fixtures", "probe-mid-failure-discovery.json")

        error = provider.error_for(TOY_RAW_CATALOGED)
        twin = error.twin

        assert twin["comprehendo"] == fixture["steps"][0]["response"]["comprehendo"]
        assert fixture["discovery"]["learned_from"]["field"] == "comprehendo"

    def test_then_probes_the_caught_error_itself_and_gets_the_entry(
        self, provider: Any
    ) -> None:
        step = kit_json("fixtures", "probe-mid-failure-discovery.json")["steps"][1]

        error = provider.error_for(TOY_RAW_CATALOGED)

        assert probe(error) == step["response"]

    def test_and_follows_the_fixs_docs_pointer_into_the_corpus(self, provider: Any) -> None:
        step = kit_json("fixtures", "probe-mid-failure-discovery.json")["steps"][2]

        assert provider.docs(step["input"]) == step["response"]


class TestTheThrowSites:
    def test_a_cataloged_failure_arrives_twinned_with_at_least_one_fix(
        self, provider: Any
    ) -> None:
        twin = provider.twin_for(TOY_RAW_CATALOGED)

        assert twin["code"] == "SORT_UNINDEXED_SPILL"
        assert len(twin["fixes"]) >= 1
        assert twin["received"] == TOY_RAW_CATALOGED

    def test_a_novel_failure_arrives_honestly_marked_never_raw(self, provider: Any) -> None:
        twin = provider.twin_for(TOY_RAW_NOVEL)

        assert twin["code"] == "UNSTRUCTURED"
        assert twin["received"] == TOY_RAW_NOVEL
        assert twin["fixes"] == []
        assert twin["reason"] != TOY_RAW_NOVEL

    def test_every_error_the_provider_raises_carries_the_marker(self, provider: Any) -> None:
        for raw in (TOY_RAW_CATALOGED, TOY_RAW_NOVEL):
            error = provider.error_for(raw)

            assert hasattr(error, "__comprehendo__") is True
            assert probe(error) == provider.entry

    def test_a_controlled_handle_carries_the_same_marker(self, provider: Any) -> None:
        cursor = provider.mark(Cursor())

        assert hasattr(cursor, "__comprehendo__") is True
        assert probe(cursor) is provider.entry


class TestTheOneLineProbeInAgentTerms:
    def test_reads_the_first_fix_off_a_caught_error(self, provider: Any) -> None:
        caught: Exception | None = None
        try:
            provider.raise_(TOY_RAW_CATALOGED)
        except Exception as exc:  # noqa: BLE001, the agent's own except block
            caught = exc

        assert caught is not None
        assert hasattr(caught, "__comprehendo__")
        assert caught.twin["fixes"][0]["title"] == (  # type: ignore[attr-defined]
            "Sort on the indexed field the pipeline already filters on"
        )


class TestTheDisagreementFixture:
    def test_resolves_in_the_markers_favor_when_both_channels_answer(
        self, provider: Any
    ) -> None:
        fixture = kit_json("fixtures", "disagreement.json")
        manifest = fixture["steps"][0]["response"]
        marker = fixture["steps"][1]["response"]

        resolved = resolve_discovery({"marker": marker, "manifest": manifest})

        assert resolved == fixture["resolved"]

    def test_the_toy_provider_is_the_marker_side_of_that_resolution(
        self, provider: Any
    ) -> None:
        resolved = resolve_discovery({"marker": provider.entry, "manifest": provider.manifest})

        assert resolved is not None
        assert resolved["source"] == "marker"
        assert resolved["level"] == provider.level
