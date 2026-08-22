"""The conformance kit, fed to the REAL Python validator.

Not a content assertion: every fixture below is turned into a provider catalog
and pushed through `validate_catalog` / `audit_twin`, the same functions the
builder itself runs at build time. The negative kit's two twin-builder
fixtures (raw-error-leak, CC3 [08]; schema-escaping-fix, CC7 [09]) must FAIL
here, each for the exact reason its own `violation` block names, and the
positive kit must pass field for field. Zero fixture changes: the files are
read in place, unmodified.
"""

from __future__ import annotations

from typing import Any, cast

import pytest

from comprehendo import (
    CatalogEntry,
    ProviderCatalog,
    Twin,
    TwinCatalogError,
    audit_twin,
    create_twin_builder,
    unstructured_twin,
    validate_catalog,
)

from .helpers.kit import kit_json


def entry_of(twin: Twin) -> Any:
    """A twin from the kit, read back as the catalog entry that would produce it."""
    entry: dict[str, Any] = {
        "code": twin["code"],
        "reason": twin["reason"],
        "fixes": twin["fixes"],
    }
    for optional in ("path", "namespace", "declared", "received", "accepts"):
        if optional in twin:
            entry[optional] = twin[optional]
    return entry


def topics_of(twin: Twin) -> list[str]:
    """Every topic any fix in this twin points at, so `docs` resolves by construction."""
    return [fix["docs"] for fix in twin["fixes"] if "docs" in fix]


def raise_site_of(twin: Twin) -> tuple[Any, Any]:
    """The same twin, split the way a real provider carries it: the CATALOG
    entry (what the corpus author wrote) and the RAISE SITE's own context (what
    the call actually observed).

    `received` belongs to the raise site, not to the catalog, and putting it
    there is not a convenience: a cataloged entry whose `received` text also
    appears in its `reason` is a CC3 [08] raw-error-leak by the catalog-time
    check, in this port and in the TypeScript one alike. The kit's STAGE_UNKNOWN
    twin is exactly that shape (`received: "$grup"`, and the reason necessarily
    names `$grup`), which is a false positive of the substring heuristic both
    implementations share, recorded as a known issue on the feature doc. What
    it is NOT is a fixture bug: the twin is conforming, and a provider producing
    it through its real raise site never trips the gate.
    """
    entry = entry_of(twin)
    context = {}
    if "received" in entry:
        context["received"] = entry.pop("received")
    return entry, (context or None)


def built_from(twin: Twin, operations: list[str] | None = None) -> Twin:
    """One kit twin, rebuilt by the real builder through its real raise site."""
    entry, context = raise_site_of(twin)
    catalog: ProviderCatalog = {
        "declared_schema": {
            "surface": "aggregate(pipeline)",
            "operations": operations
            or ["$match", "$sort", "$limit", "$project", "$group", "$count"],
        },
        "topics": topics_of(twin),
        "entries": [entry],
    }
    return create_twin_builder(catalog).build(twin["code"], context)


class TestSchemaEscapingFixFailsTheCc7Gate:
    fixture = kit_json("negative", "schema-escaping-fix.json")
    twin: Twin = fixture["steps"][0]["response"]
    declared = fixture["declared_schema"]

    def as_catalog(self, fixes: list[Any]) -> ProviderCatalog:
        return {
            "declared_schema": {
                "surface": self.declared["surface"],
                "operations": self.declared["operations"],
            },
            "topics": topics_of(self.twin),
            "entries": [cast(CatalogEntry, {**entry_of(self.twin), "fixes": fixes})],
        }

    def test_the_real_validator_rejects_it_once_with_the_fixtures_rule_and_reason(self) -> None:
        found = validate_catalog(self.as_catalog(self.twin["fixes"]))

        assert self.fixture["violation"]["gate"] == "twin-builder"
        assert len(found) == 1
        assert found[0]["rule"] == self.fixture["violation"]["rule"]
        assert found[0]["reason"] == self.fixture["violation"]["reason"]

    def test_the_diagnostic_names_the_operation_the_provider_never_declared(self) -> None:
        found = validate_catalog(self.as_catalog(self.twin["fixes"]))

        assert "$out" in found[0]["message"]
        assert "$out" in self.fixture["violation"]["message"]

    def test_the_violation_locator_agrees_with_the_fixtures_locator(self) -> None:
        found = validate_catalog(self.as_catalog(self.twin["fixes"]))

        assert found[0]["locator"] == "entries[0].fixes[1].apply"
        assert self.fixture["violation"]["locator"].endswith("fixes[1].apply")

    def test_a_build_of_this_catalog_fails_it_never_produces_a_builder(self) -> None:
        with pytest.raises(TwinCatalogError):
            create_twin_builder(self.as_catalog(self.twin["fixes"]))

    def test_the_sibling_fix_is_inside_the_schema_so_only_the_escaping_one_fails(self) -> None:
        conforming = self.twin["fixes"][0]

        assert validate_catalog(self.as_catalog([conforming])) == []
        assert create_twin_builder(self.as_catalog([conforming])).codes == [self.twin["code"]]


class TestRawErrorLeakFailsTheCc3Gate:
    fixture = kit_json("negative", "raw-error-leak.json")
    twin: Twin = fixture["steps"][0]["response"]
    raw: str = fixture["raw_error"]

    def test_the_real_audit_rejects_it_with_the_fixture_reason_pointing_at_reason(self) -> None:
        found = audit_twin(self.twin, self.raw)

        assert self.fixture["violation"]["gate"] == "twin-builder"
        assert self.fixture["violation"]["reason"] in [item["reason"] for item in found]
        assert found[0]["rule"] == self.fixture["violation"]["rule"]
        assert found[0]["locator"] == "reason"
        assert self.fixture["violation"]["locator"].endswith("reason")

    def test_the_audit_also_catches_the_raw_text_dropped_from_received(self) -> None:
        found = audit_twin(self.twin, self.raw)

        assert "raw-error-discarded" in [item["reason"] for item in found]

    def test_this_builder_handles_the_same_raw_error_correctly(self) -> None:
        honest = unstructured_twin(self.raw)

        assert audit_twin(honest, self.raw) == []
        assert honest["received"] == self.raw
        assert honest["reason"] != self.raw


class TestTwinRoundTripThroughTheRealBuilder:
    fixture = kit_json("fixtures", "twin-round-trip.json")
    responses: list[Twin] = [step["response"] for step in fixture["steps"]]
    structured, unstructured, docs_only = responses

    def catalog_for(self, twin: Twin) -> ProviderCatalog:
        return {
            "declared_schema": {
                "surface": "aggregate(pipeline)",
                "operations": ["$match", "$sort", "$limit", "$project", "$group", "$count"],
            },
            "topics": ["index selection", "capped collections"],
            "entries": [entry_of(twin)],
        }

    def test_the_fully_structured_twin_round_trips_field_for_field(self) -> None:
        built = create_twin_builder(self.catalog_for(self.structured)).build(
            self.structured["code"]
        )

        assert built == self.structured

    def test_and_serializes_in_the_kit_key_order_so_both_kits_stay_byte_identical(self) -> None:
        built = create_twin_builder(self.catalog_for(self.structured)).build(
            self.structured["code"]
        )

        assert list(built.keys()) == list(self.structured.keys())

    def test_the_unstructured_passthrough_is_exactly_what_this_port_produces(self) -> None:
        built = unstructured_twin(self.unstructured["received"])

        assert built == self.unstructured
        assert list(built.keys()) == list(self.unstructured.keys())

    def test_the_docs_only_twin_round_trips_its_pointer_resolving(self) -> None:
        built = create_twin_builder(self.catalog_for(self.docs_only)).build(self.docs_only["code"])

        assert built == self.docs_only

    def test_every_cataloged_fix_in_the_positive_kit_is_inside_the_declared_schema(self) -> None:
        for twin in (self.structured, self.docs_only):
            assert validate_catalog(self.catalog_for(twin)) == []

    def test_and_no_twin_in_the_positive_kit_leaks_its_raw_error(self) -> None:
        for twin in self.responses:
            received = twin.get("received")
            assert audit_twin(twin, received if isinstance(received, str) else None) == []


#: The fields twin.schema.json defines at this spec version. A later minor may
#: add more (forward-compat.json carries `severity` and `retryable`), and this
#: port must ACCEPT those, which is a different claim from round-tripping them.
TWIN_FIELDS = (
    "comprehendo",
    "code",
    "reason",
    "path",
    "namespace",
    "declared",
    "received",
    "accepts",
    "fixes",
)


class TestEveryTwinTheKitCarries:
    def catalog_for(self, twin: Twin) -> ProviderCatalog:
        entry, _ = raise_site_of(twin)
        return {
            "declared_schema": {
                "surface": "aggregate(pipeline)",
                "operations": ["$match", "$sort", "$limit", "$project", "$group", "$count"],
            },
            "topics": topics_of(twin),
            "entries": [entry],
        }

    def test_round_trips_through_the_builder_for_every_positive_fixture(self) -> None:
        from .helpers.kit import steps_of_shape

        seen = 0
        for step in steps_of_shape("twin.schema.json"):
            twin: Twin = step["step"]["response"]
            at = f"{step['file']} step {step['index']}"
            known = {key: value for key, value in twin.items() if key in TWIN_FIELDS}
            if twin["code"] == "UNSTRUCTURED":
                assert unstructured_twin(twin["received"]) == known, at
            else:
                built = built_from(twin)
                assert built == known, at
                assert list(built.keys()) == list(known.keys()), at
            seen += 1

        assert seen >= 5

    def test_accepts_a_twin_carrying_fields_this_version_never_defined(self) -> None:
        twin: Twin = kit_json("fixtures", "forward-compat.json")["steps"][0]["response"]

        assert validate_catalog(self.catalog_for(twin)) == []
        assert create_twin_builder(self.catalog_for(twin)).codes == [twin["code"]]

    def test_and_carries_an_unknown_field_inside_a_fix_straight_through(self) -> None:
        twin: Twin = kit_json("fixtures", "forward-compat.json")["steps"][0]["response"]

        built = built_from(twin)

        assert built["fixes"][0]["blast_radius"] == "this call only"  # type: ignore[typeddict-item]

    def test_the_cc3_catalog_check_is_what_moves_received_to_the_raise_site(self) -> None:
        # The heuristic, stated as a test rather than left as a comment: put the
        # raise site's own `received` into the CATALOG and the gate fires, in
        # this port exactly as in the TypeScript one.
        twin: Twin = kit_json("fixtures", "did-you-mean.json")["steps"][0]["response"]
        catalog: ProviderCatalog = {
            "declared_schema": {
                "surface": "aggregate(pipeline)",
                "operations": ["$match", "$sort", "$limit", "$project", "$group", "$count"],
            },
            "topics": topics_of(twin),
            "entries": [entry_of(twin)],
        }

        found = validate_catalog(catalog)

        assert [item["reason"] for item in found] == ["raw-error-leak"]
        assert built_from(twin) == {
            key: value for key, value in twin.items() if key in TWIN_FIELDS
        }
