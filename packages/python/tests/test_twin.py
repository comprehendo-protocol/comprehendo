"""Twin Builder [12], the construction half.

Builds a twin from a cataloged failure, wraps a novel one as UNSTRUCTURED with
the raw error preserved in `received` (CC3 [08]), and refuses to exist at all
when the catalog violates a contract (CC7 [09]): construction IS the gate.
"""

from __future__ import annotations

import pytest

from comprehendo import (
    MARKER_ATTR,
    SPEC_VERSION,
    UNSTRUCTURED_CODE,
    UNSTRUCTURED_REASON,
    CatalogEntry,
    TwinCatalogError,
    attach_twin,
    create_twin_builder,
    probe,
    unstructured_twin,
)

from .helpers.toy import RAW, catalog, sort_entry


class TestSpecVersion:
    def test_is_the_version_every_twin_carries(self) -> None:
        assert SPEC_VERSION == "0.1"


class TestUnstructuredTwin:
    def test_states_the_situation_and_never_guesses_a_fix(self) -> None:
        twin = unstructured_twin(RAW)

        assert twin["code"] == UNSTRUCTURED_CODE == "UNSTRUCTURED"
        assert twin["reason"] == UNSTRUCTURED_REASON
        assert twin["reason"] != RAW
        assert twin["fixes"] == []

    def test_preserves_the_raw_error_verbatim_in_received(self) -> None:
        assert unstructured_twin(RAW)["received"] == RAW
        assert unstructured_twin(RuntimeError(RAW))["received"] == RAW
        assert unstructured_twin({"message": RAW})["received"] == RAW

    def test_keeps_a_raw_value_that_carries_no_text_unchanged(self) -> None:
        raw = {"code": 11600, "codeName": "InterruptedAtShutdown"}

        assert unstructured_twin(raw)["received"] == raw

    def test_serializes_in_the_kits_key_order(self) -> None:
        assert list(unstructured_twin(RAW).keys()) == [
            "comprehendo",
            "code",
            "reason",
            "received",
            "fixes",
        ]

    def test_is_frozen_so_a_published_twin_cannot_be_re_pointed(self) -> None:
        twin = unstructured_twin(RAW)

        with pytest.raises(TypeError):
            twin["reason"] = "something else"
        with pytest.raises(TypeError):
            twin["fixes"].append({"title": "invented later"})


class TestAttachTwin:
    def test_puts_the_twin_on_the_error_the_provider_raises(self) -> None:
        error = attach_twin(RuntimeError("boom"), unstructured_twin(RAW))

        assert getattr(error, "twin")["code"] == UNSTRUCTURED_CODE

    def test_answers_the_one_line_probe(self) -> None:
        error = attach_twin(RuntimeError("boom"), unstructured_twin(RAW))

        assert hasattr(error, "__comprehendo__") is True

    def test_defaults_the_probe_value_to_presence_which_carries_no_entry(self) -> None:
        error = attach_twin(RuntimeError("boom"), unstructured_twin(RAW))

        assert getattr(error, MARKER_ATTR) is True
        assert probe(error) is None

    def test_takes_the_providers_own_entry_when_the_sdk_has_one(self) -> None:
        entry = {
            "comprehendo": "0.1",
            "name": "mongodb-operator",
            "level": 1,
            "surfaces": ["docs"],
            "identity": "what the tool is",
            "priming": "the snippet",
        }
        error = attach_twin(RuntimeError("boom"), unstructured_twin(RAW), entry)

        assert probe(error) == entry


class TestCreateTwinBuilder:
    def test_construction_is_the_gate_a_bad_catalog_never_yields_a_builder(self) -> None:
        with pytest.raises(TwinCatalogError) as raised:
            create_twin_builder(catalog({**sort_entry, "fixes": []}))

        assert raised.value.violations[0]["reason"] == "empty-fixes"

    def test_lists_the_codes_it_carries(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        assert builder.codes == ["SORT_UNINDEXED_SPILL"]
        assert builder.has("SORT_UNINDEXED_SPILL") is True
        assert builder.has("NOT_CATALOGED") is False

    def test_builds_the_cataloged_twin_field_for_field(self) -> None:
        twin = create_twin_builder(catalog(sort_entry)).build("SORT_UNINDEXED_SPILL")

        assert twin["comprehendo"] == SPEC_VERSION
        assert twin["code"] == sort_entry["code"]
        assert twin["reason"] == sort_entry["reason"]
        assert twin["path"] == sort_entry["path"]
        assert twin["namespace"] == sort_entry["namespace"]
        assert twin["fixes"] == sort_entry["fixes"]

    def test_never_writes_an_absent_field_as_an_explicit_null(self) -> None:
        twin = create_twin_builder(catalog(sort_entry)).build("SORT_UNINDEXED_SPILL")

        assert "declared" not in twin
        assert "received" not in twin
        assert "accepts" not in twin
        assert list(twin.keys()) == ["comprehendo", "code", "reason", "path", "namespace", "fixes"]

    def test_keeps_the_authors_most_likely_first_fix_order(self) -> None:
        twin = create_twin_builder(catalog(sort_entry)).build("SORT_UNINDEXED_SPILL")

        assert [fix["title"] for fix in twin["fixes"]] == [
            fix["title"] for fix in sort_entry["fixes"]
        ]

    def test_the_throw_sites_own_detail_wins_over_the_catalogs(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        twin = builder.build(
            "SORT_UNINDEXED_SPILL", {"namespace": "reporting.rollups", "received": RAW}
        )

        assert twin["namespace"] == "reporting.rollups"
        assert twin["received"] == RAW
        assert twin["path"] == sort_entry["path"]

    def test_refuses_a_code_it_never_cataloged(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        with pytest.raises(TwinCatalogError) as raised:
            builder.build("NOT_CATALOGED")

        assert raised.value.violations[0]["reason"] == "unknown-code"
        assert "UNSTRUCTURED" in raised.value.violations[0]["message"]

    def test_freezes_every_twin_it_builds(self) -> None:
        twin = create_twin_builder(catalog(sort_entry)).build("SORT_UNINDEXED_SPILL")

        with pytest.raises(TypeError):
            twin["code"] = "SOMETHING_ELSE"
        with pytest.raises(TypeError):
            twin["fixes"][0]["title"] = "rewritten after publication"


class TestTwinFor:
    def test_builds_the_cataloged_twin_when_the_code_is_known(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        assert builder.twin_for("SORT_UNINDEXED_SPILL", RAW)["code"] == "SORT_UNINDEXED_SPILL"

    def test_wraps_an_uncataloged_code_as_unstructured_with_the_raw_preserved(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        twin = builder.twin_for("NEVER_HEARD_OF_IT", RAW)

        assert twin["code"] == UNSTRUCTURED_CODE
        assert twin["received"] == RAW

    def test_wraps_a_failure_with_no_code_at_all_the_same_way(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        assert builder.twin_for(None, RAW)["code"] == UNSTRUCTURED_CODE

    def test_places_the_raw_text_in_received_when_the_catalog_carries_none(self) -> None:
        entry: CatalogEntry = {**sort_entry}
        builder = create_twin_builder(catalog(entry))

        assert builder.twin_for("SORT_UNINDEXED_SPILL", RAW)["received"] == RAW


class TestErrorFor:
    def test_raises_with_the_twins_reason_never_the_raw_text(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        error = builder.error_for(None, RAW)

        assert str(error) == UNSTRUCTURED_REASON
        assert str(error) != RAW

    def test_carries_the_twin_and_answers_the_probe(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        error = builder.error_for("SORT_UNINDEXED_SPILL", RAW)

        assert error.twin["code"] == "SORT_UNINDEXED_SPILL"
        assert hasattr(error, "__comprehendo__") is True

    def test_is_a_real_exception_something_can_raise_and_catch(self) -> None:
        builder = create_twin_builder(catalog(sort_entry))

        with pytest.raises(Exception) as raised:
            raise builder.error_for("SORT_UNINDEXED_SPILL", RAW)

        assert raised.value.twin["code"] == "SORT_UNINDEXED_SPILL"  # type: ignore[attr-defined]
