"""Twin Builder [12], the gate half: the pure CC3 [08] and CC7 [09] checks.

Every function here is a value-to-violations transform, which is what lets the
conformance kit run the SAME code the builder runs (test_twin_kit.py), so what
CI checks and what a build enforces cannot drift apart.
"""

from __future__ import annotations

from typing import Any

import pytest

from comprehendo import (
    UNSTRUCTURED_CODE,
    CatalogEntry,
    Fix,
    ProviderCatalog,
    Twin,
    TwinCatalogError,
    apply_operations,
    audit_twin,
    raw_text_of,
    validate_catalog,
    violation,
)

from .helpers.toy import RAW, catalog, declared_schema, sort_entry


def reasons(found: list[Any]) -> list[str]:
    return [item["reason"] for item in found]


class TestRawTextOf:
    def test_reads_a_string_a_raised_error_and_a_message_bearing_object(self) -> None:
        assert raw_text_of(RAW) == RAW
        assert raw_text_of(RuntimeError(RAW)) == RAW
        assert raw_text_of({"message": RAW}) == RAW

    def test_answers_none_for_a_value_carrying_no_text(self) -> None:
        values: list[Any] = [None, 42, [], {}, {"message": 42}]
        for value in values:
            assert raw_text_of(value) is None


class TestApplyOperations:
    def test_reads_the_top_level_operator_keys_of_a_pipeline(self) -> None:
        found = apply_operations([{"$match": {"ok": True}}, {"$group": {"_id": "$k"}}])

        assert found == ["$match", "$group"]

    def test_reads_the_keys_of_a_single_call_object(self) -> None:
        assert apply_operations({"$group": {"_id": "$k"}}) == ["$group"]

    def test_stays_top_level_so_operand_data_is_never_a_second_operation(self) -> None:
        found = apply_operations([{"$match": {"created_at": {"$gte": "2026-01-01"}}}])

        assert found == ["$match"]

    def test_answers_none_when_the_apply_is_not_literal_call_data(self) -> None:
        for value in ("rm -rf /", 42, None, ["not a call"], [{"$match": {}}, "and text"]):
            assert apply_operations(value) is None


class TestValidateCatalog:
    def test_accepts_a_conforming_catalog(self) -> None:
        assert validate_catalog(catalog(sort_entry)) == []

    def test_refuses_the_reserved_unstructured_code(self) -> None:
        entry: CatalogEntry = {**sort_entry, "code": UNSTRUCTURED_CODE}

        found = validate_catalog(catalog(entry))

        assert reasons(found) == ["reserved-code"]
        assert found[0]["rule"] == "CC3"
        assert found[0]["locator"] == "entries[0].code"

    def test_refuses_a_code_cataloged_twice(self) -> None:
        found = validate_catalog(catalog(sort_entry, sort_entry))

        assert "duplicate-code" in reasons(found)

    def test_refuses_an_empty_reason(self) -> None:
        found = validate_catalog(catalog({**sort_entry, "reason": "   "}))

        assert "empty-reason" in reasons(found)

    def test_refuses_a_cataloged_failure_with_no_fix(self) -> None:
        found = validate_catalog(catalog({**sort_entry, "fixes": []}))

        assert reasons(found) == ["empty-fixes"]
        assert found[0]["rule"] == "CC3"

    def test_refuses_a_fix_with_no_title(self) -> None:
        fix: Fix = {**sort_entry["fixes"][0], "title": " "}
        found = validate_catalog(catalog({**sort_entry, "fixes": [fix]}))

        assert "fix-without-title" in reasons(found)

    def test_refuses_a_fix_that_remedies_nothing(self) -> None:
        found = validate_catalog(catalog({**sort_entry, "fixes": [{"title": "Do something"}]}))

        assert reasons(found) == ["fix-without-remedy"]
        assert found[0]["rule"] == "CC7"

    def test_refuses_an_apply_expressing_an_undeclared_operation(self) -> None:
        fix: Fix = {"title": "Materialize it", "apply": [{"$out": "events_hot"}]}
        found = validate_catalog(catalog({**sort_entry, "fixes": [fix]}))

        assert reasons(found) == ["schema-escaping-fix"]
        assert "$out" in found[0]["message"]
        assert found[0]["locator"] == "entries[0].fixes[0].apply"

    def test_refuses_an_apply_that_cannot_be_checked_at_all(self) -> None:
        fix: Fix = {"title": "Just run this", "apply": "mongosh --eval 'db.dropDatabase()'"}
        found = validate_catalog(catalog({**sort_entry, "fixes": [fix]}))

        assert reasons(found) == ["unvalidatable-apply"]

    def test_refuses_an_apply_expressing_no_operation(self) -> None:
        found = validate_catalog(
            catalog({**sort_entry, "fixes": [{"title": "Nothing", "apply": {}}]})
        )

        assert reasons(found) == ["empty-apply"]

    def test_refuses_a_docs_pointer_the_corpus_index_does_not_carry(self) -> None:
        fix: Fix = {"title": "Read up", "docs": "a topic nobody wrote"}
        found = validate_catalog(catalog({**sort_entry, "fixes": [fix]}))

        assert reasons(found) == ["dangling-docs-pointer"]
        assert "a topic nobody wrote" in found[0]["message"]


class TestCc3AtCatalogTime:
    """The review finding from Wave 2: this must fail the BUILD, not only an audit."""

    def test_refuses_an_entry_that_pastes_its_received_text_into_reason(self) -> None:
        entry: CatalogEntry = {
            **sort_entry,
            "reason": f"The sort failed: {RAW}",
            "received": RAW,
        }

        found = validate_catalog(catalog(entry))

        assert reasons(found) == ["raw-error-leak"]
        assert found[0]["rule"] == "CC3"
        assert found[0]["locator"] == "entries[0].reason"

    def test_reads_the_raw_text_through_an_error_valued_received_too(self) -> None:
        entry: CatalogEntry = {
            **sort_entry,
            "reason": f"The sort failed: {RAW}",
            "received": RuntimeError(RAW),
        }

        assert reasons(validate_catalog(catalog(entry))) == ["raw-error-leak"]

    def test_leaves_an_entry_that_places_the_raw_text_correctly_alone(self) -> None:
        entry: CatalogEntry = {**sort_entry, "received": RAW}

        assert validate_catalog(catalog(entry)) == []

    def test_a_catalog_carrying_the_leak_never_produces_a_builder(self) -> None:
        from comprehendo import create_twin_builder

        entry: CatalogEntry = {**sort_entry, "reason": RAW, "received": RAW}

        with pytest.raises(TwinCatalogError):
            create_twin_builder(catalog(entry))


class TestCc7NestedPipelines:
    """The review finding from Wave 2: a write smuggled inside a nested pipeline."""

    def nesting_catalog(self, apply: Any) -> ProviderCatalog:
        return {
            "declared_schema": {
                "surface": "aggregate(pipeline)",
                "operations": ["$match", "$facet", "$lookup", "$sort", "$limit"],
                "nested_pipeline_operations": ["$facet", "$lookup", "pipeline"],
            },
            "topics": list(catalog()["topics"]),
            "entries": [{**sort_entry, "fixes": [{"title": "Try this", "apply": apply}]}],
        }

    def test_catches_an_undeclared_operation_inside_a_facet_branch(self) -> None:
        found = validate_catalog(
            self.nesting_catalog([{"$facet": {"hot": [{"$match": {"ok": True}}, {"$out": "x"}]}}])
        )

        assert reasons(found) == ["schema-escaping-fix"]
        assert "$out" in found[0]["message"]

    def test_catches_an_undeclared_operation_inside_a_lookup_pipeline(self) -> None:
        found = validate_catalog(
            self.nesting_catalog(
                [{"$lookup": {"from": "accounts", "pipeline": [{"$merge": {"into": "x"}}]}}]
            )
        )

        assert reasons(found) == ["schema-escaping-fix"]
        assert "$merge" in found[0]["message"]

    def test_accepts_a_nested_pipeline_that_stays_inside_the_declared_schema(self) -> None:
        found = validate_catalog(
            self.nesting_catalog([{"$facet": {"hot": [{"$match": {"ok": True}}, {"$limit": 5}]}}])
        )

        assert found == []

    def test_never_scans_operand_data_that_merely_looks_like_a_pipeline(self) -> None:
        # `$match` is not a declared nesting key, so its `$or` array of
        # condition objects is operand data and its keys are not operations.
        found = validate_catalog(
            self.nesting_catalog([{"$match": {"$or": [{"a": 1}, {"$out": "not an operation"}]}}])
        )

        assert found == []

    def test_a_schema_declaring_no_nesting_leaves_every_nested_value_alone(self) -> None:
        found = validate_catalog(
            catalog(
                {
                    **sort_entry,
                    "fixes": [
                        {
                            "title": "Try this",
                            "apply": [{"$match": {"nested": [{"$out": "operand data"}]}}],
                        }
                    ],
                }
            )
        )

        assert found == []


class TestAuditTwin:
    def test_catches_the_raw_text_surfaced_as_the_primary_reason(self) -> None:
        twin: Twin = {
            "comprehendo": "0.1",
            "code": "UNSTRUCTURED",
            "reason": RAW,
            "fixes": [],
        }

        found = audit_twin(twin, RAW)

        assert "raw-error-leak" in reasons(found)
        assert found[0]["locator"] == "reason"

    def test_catches_an_unstructured_twin_that_dropped_the_raw_error(self) -> None:
        twin: Twin = {
            "comprehendo": "0.1",
            "code": UNSTRUCTURED_CODE,
            "reason": "Something went wrong.",
            "fixes": [],
        }

        assert "raw-error-discarded" in reasons(audit_twin(twin, RAW))

    def test_says_nothing_about_a_twin_that_places_the_raw_text_correctly(self) -> None:
        from comprehendo import unstructured_twin

        assert audit_twin(unstructured_twin(RAW), RAW) == []


class TestTwinCatalogError:
    def test_carries_every_violation_and_names_them_in_its_message(self) -> None:
        error = TwinCatalogError(
            [violation("CC7", "empty-apply", "entries[0].fixes[0].apply", "nothing to apply")]
        )

        assert len(error.violations) == 1
        assert "CC7" in str(error)
        assert "empty-apply" in str(error)
        assert "entries[0].fixes[0].apply" in str(error)

    def test_freezes_the_violations_it_was_handed(self) -> None:
        error = TwinCatalogError([violation("CC3", "empty-fixes", "entries[0].fixes", "none")])

        with pytest.raises(TypeError):
            error.violations.append(violation("CC3", "empty-fixes", "x", "y"))


class TestTheDeclaredSchemaIsTheProvidersOwn:
    def test_the_gate_checks_against_the_operations_the_provider_declared(self) -> None:
        assert declared_schema["operations"] == [
            "$match",
            "$sort",
            "$limit",
            "$project",
            "$group",
            "$count",
        ]
        assert "$out" not in declared_schema["operations"]
