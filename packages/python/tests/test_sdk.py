"""SDK Entry [14], the Python port: `make_provider(corpus, hooks)`.

This module owns the WIRING plus two decisions that can only be made here: the
conformance level is COMPUTED from what `hooks` actually provided, never
declared, and the marker attached to the export, to every raised error, and to
every controlled handle is ONE entry object.
"""

from __future__ import annotations

from typing import Any, cast

import pytest

from comprehendo import (
    SPEC_VERSION,
    ProviderHooks,
    TwinCatalogError,
    make_provider,
    probe,
)

from .helpers.toy import (
    TOY_IDENTITY,
    TOY_PRIMING,
    TOY_RAW_CATALOGED,
    TOY_RAW_NOVEL,
    ToyRuntime,
    catch_all_resolver,
    sort_resolver,
    toy_corpus,
    toy_hooks,
)


def provider_with(**overrides: Any) -> Any:
    hooks = cast(ProviderHooks, {**toy_hooks(), **overrides})
    return make_provider(toy_corpus(), hooks)


class Handle:
    """A controlled handle the provider marks."""


class TestTheLevelIsComputedNeverDeclared:
    def test_both_judge_hooks_reach_level_two(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks("both"))

        assert provider.level == 2
        assert provider.surfaces == ["docs", "validate", "explain"]

    def test_no_judge_hooks_stay_at_level_one(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks("none"))

        assert provider.level == 1
        assert provider.surfaces == ["docs"]

    def test_one_judge_hook_lists_the_surface_and_stays_at_level_one(self) -> None:
        validate_only = make_provider(toy_corpus(), toy_hooks("validate"))
        explain_only = make_provider(toy_corpus(), toy_hooks("explain"))

        assert validate_only.level == 1
        assert validate_only.surfaces == ["docs", "validate"]
        assert explain_only.level == 1
        assert explain_only.surfaces == ["docs", "explain"]

    def test_a_provider_that_cannot_judge_omits_validate_rather_than_stubbing_it(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks("none"))

        assert hasattr(provider, "validate") is False
        assert hasattr(provider, "explain") is False

    def test_the_manifest_declaration_reflects_the_level_actually_reached(self) -> None:
        assert make_provider(toy_corpus(), toy_hooks("both")).manifest == {
            "version": SPEC_VERSION,
            "level": 2,
        }
        assert make_provider(toy_corpus(), toy_hooks("none")).manifest == {
            "version": SPEC_VERSION,
            "level": 1,
        }


class TestTheEntry:
    def test_carries_exactly_the_fields_the_shape_requires(self) -> None:
        entry = make_provider(toy_corpus(), toy_hooks()).entry

        assert list(entry.keys()) == [
            "comprehendo",
            "name",
            "level",
            "surfaces",
            "identity",
            "priming",
        ]

    def test_defaults_the_name_to_the_packed_corpus_own_provider(self) -> None:
        assert make_provider(toy_corpus(), toy_hooks()).name == "mongodb-operator"

    def test_takes_a_name_the_hooks_supply(self) -> None:
        assert provider_with(name="renamed").name == "renamed"

    def test_refuses_an_empty_identity_priming_or_name(self) -> None:
        for field in ("identity", "priming", "name"):
            with pytest.raises(TypeError, match=field):
                provider_with(**{field: "   "})

    def test_carries_the_identity_and_priming_the_hooks_supplied(self) -> None:
        entry = make_provider(toy_corpus(), toy_hooks()).entry

        assert entry["identity"] == TOY_IDENTITY
        assert entry["priming"] == TOY_PRIMING


class TestOneMarkerEntryEverywhere:
    def test_the_export_answers_the_probe(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        assert probe(provider) == provider.entry
        assert hasattr(provider, "__comprehendo__") is True

    def test_a_raised_error_answers_with_the_same_entry_not_a_bare_true(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        error = provider.error_for(TOY_RAW_CATALOGED)

        assert probe(error) is provider.entry

    def test_a_controlled_handle_answers_with_the_same_entry(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())
        handle = provider.mark(Handle())

        assert probe(handle) is provider.entry

    def test_mark_returns_the_same_handle_never_a_copy(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())
        handle = Handle()

        assert provider.mark(handle) is handle


class TestTheThrowSites:
    def test_the_first_claiming_resolver_wins(self) -> None:
        provider = provider_with(twin_resolvers=[sort_resolver, catch_all_resolver])

        assert provider.twin_for(TOY_RAW_CATALOGED)["namespace"] == "analytics.events"
        assert provider.twin_for(TOY_RAW_NOVEL)["path"] == "catch-all"

    def test_a_failure_no_resolver_claims_passes_through_as_unstructured(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        twin = provider.twin_for(TOY_RAW_NOVEL)

        assert twin["code"] == "UNSTRUCTURED"
        assert twin["received"] == TOY_RAW_NOVEL

    def test_the_throw_sites_own_detail_wins_over_the_resolvers(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        twin = provider.twin_for(TOY_RAW_CATALOGED, {"namespace": "reporting.rollups"})

        assert twin["namespace"] == "reporting.rollups"
        assert twin["received"] == TOY_RAW_CATALOGED

    def test_raise_raises_the_twinned_error(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        with pytest.raises(Exception) as raised:
            provider.raise_(TOY_RAW_CATALOGED)

        assert getattr(raised.value, "twin")["code"] == "SORT_UNINDEXED_SPILL"
        assert hasattr(raised.value, "__comprehendo__") is True

    def test_the_error_message_is_the_reason_never_the_raw_text(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        error = provider.error_for(TOY_RAW_NOVEL)

        assert str(error) != TOY_RAW_NOVEL
        assert str(error) == error.twin["reason"]


class TestValidate:
    def test_answers_clean_for_an_input_it_can_judge(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        assert provider.validate([{"$match": {"ok": True}}]) == {"valid": True}

    def test_answers_a_cataloged_twin_through_the_same_catalog_the_throw_sites_use(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        verdict = provider.validate([{"$sort": {"created_at": -1}}])

        assert verdict["code"] == "SORT_UNINDEXED_SPILL"
        assert verdict["path"] == "pipeline[0].$sort"
        assert verdict["fixes"] != []

    def test_abstains_rather_than_guessing_when_it_cannot_judge(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        verdict = provider.validate([{"$merge": {"into": {"$concat": ["events_", "$region"]}}}])

        assert verdict["valid"] is None
        assert verdict["code"] == "UNVALIDATABLE"
        assert list(verdict.keys()) == ["valid", "code", "reason"]

    def test_never_executes_the_input_it_judges(self) -> None:
        runtime = ToyRuntime()
        provider = make_provider(toy_corpus(), toy_hooks("both", runtime))

        provider.validate([{"$match": {"ok": True}}])
        provider.validate([{"$sort": {"created_at": -1}}])
        provider.explain([{"$match": {"ok": True}}])

        assert runtime.executions == 0

    def test_refuses_a_verdict_this_sdk_cannot_read(self) -> None:
        provider = provider_with(validate=lambda value: None)

        with pytest.raises(TypeError, match="cannot read"):
            provider.validate([{"$match": {}}])

    def test_refuses_a_hook_naming_a_code_the_catalog_never_carried(self) -> None:
        provider = provider_with(validate=lambda value: {"code": "NOT_CATALOGED"})

        with pytest.raises(TwinCatalogError):
            provider.validate([{"$match": {}}])


class TestExplain:
    def test_returns_the_literal_form_the_input_would_execute_as(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        explanation = provider.explain([{"$match": {"status": "active"}}])

        assert explanation["would_execute"]["aggregate"] == "events"
        assert "notes" in explanation

    def test_freezes_what_it_hands_back(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        explanation = provider.explain([{"$match": {"status": "active"}}])

        with pytest.raises(TypeError):
            explanation["would_execute"] = "rewritten"
        with pytest.raises(TypeError):
            explanation["notes"].append("invented later")

    def test_refuses_a_hook_that_returns_something_other_than_an_explanation(self) -> None:
        provider = provider_with(explain=lambda value: "just a string")

        with pytest.raises(TypeError, match="would_execute"):
            provider.explain([{"$match": {}}])


class TestEverythingRefusableIsRefusedAtConstruction:
    def test_a_packed_corpus_this_runtime_cannot_read(self) -> None:
        with pytest.raises(ValueError):
            make_provider({**toy_corpus(), "packed": 99}, toy_hooks())

    def test_a_catalog_that_violates_a_contract(self) -> None:
        hooks = toy_hooks()
        hooks["catalog"]["entries"][0]["fixes"] = []

        with pytest.raises(TwinCatalogError):
            make_provider(toy_corpus(), hooks)

    def test_a_provider_either_exists_whole_or_does_not_exist(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        for attribute in ("name", "comprehendo", "level", "surfaces", "entry", "manifest",
                          "docs", "twins"):
            assert hasattr(provider, attribute), attribute


class TestTheProviderIsFrozen:
    def test_nothing_holding_it_can_re_point_a_surface(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks())

        with pytest.raises((TypeError, AttributeError)):
            provider.level = 2
        with pytest.raises((TypeError, AttributeError)):
            provider.docs = cast(Any, None)
