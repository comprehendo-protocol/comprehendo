"""The anti-vacuity control for the conformance run's own validator.

`test_conformance_kit.py` is green only if `jsonschema_mini` can actually go
red. A validator that reported "no errors" because it did not understand the
schema would pass the whole kit while asserting nothing, which is worse than
no validator: this file is what makes that impossible to miss.
"""

from __future__ import annotations

from typing import Iterator

import pytest

from .helpers.jsonschema_mini import SchemaError, Validator
from .helpers.kit import read_all_shapes

SHAPES = read_all_shapes()
VALIDATOR = Validator(SHAPES)

GOOD_TWIN = {
    "comprehendo": "0.1",
    "code": "STAGE_UNKNOWN",
    "reason": "Pipeline stage 1 names an operator that does not exist.",
    "fixes": [{"title": "Rename it", "docs": "aggregation stages"}],
}


def errors(shape: str, value: object) -> list[str]:
    return VALIDATOR.errors(SHAPES[shape], value)


def keywords_of(node: object) -> "Iterator[str]":
    """Every keyword used in `node` and in the sub-schemas it holds.

    Recurses only into SCHEMA positions, so a property name is never mistaken
    for a keyword.
    """
    if not isinstance(node, dict):
        return
    yield from node.keys()
    for key, value in node.items():
        if key == "properties" and isinstance(value, dict):
            for sub in value.values():
                yield from keywords_of(sub)
        elif key == "anyOf" and isinstance(value, list):
            for sub in value:
                yield from keywords_of(sub)
        elif key in ("items", "additionalProperties"):
            yield from keywords_of(value)


class TestItAcceptsWhatIsValid:
    def test_a_conforming_twin(self) -> None:
        assert errors("twin.schema.json", GOOD_TWIN) == []

    def test_a_conforming_undocumented(self) -> None:
        value = {
            "comprehendo": "0.1",
            "code": "UNDOCUMENTED",
            "query": "how do I shard a capped collection",
            "nearest": [],
            "source_permitted": True,
        }

        assert errors("undocumented.schema.json", value) == []


class TestItRejectsWhatIsNot:
    def test_a_missing_required_field(self) -> None:
        broken = {k: v for k, v in GOOD_TWIN.items() if k != "reason"}

        assert any("reason" in error for error in errors("twin.schema.json", broken))

    def test_a_field_of_the_wrong_type(self) -> None:
        assert errors("twin.schema.json", {**GOOD_TWIN, "code": 42}) != []

    def test_an_integer_field_handed_a_boolean(self) -> None:
        value = {"version": "0.1", "level": True}

        assert errors("manifest.schema.json", value) != []

    def test_a_value_outside_an_enum(self) -> None:
        entry = {
            "comprehendo": "0.1",
            "name": "x",
            "level": 3,
            "surfaces": ["docs"],
            "identity": "i",
            "priming": "p",
        }

        assert errors("entry.schema.json", entry) != []

    def test_a_const_that_does_not_hold(self) -> None:
        value = {
            "comprehendo": "0.1",
            "code": "UNDOCUMENTED",
            "query": "q",
            "nearest": [],
            "source_permitted": False,
        }

        assert any("source_permitted" in error for error in errors("undocumented.schema.json", value))

    def test_an_anyof_branch_that_matches_none(self) -> None:
        # A fix must carry at least one of `apply` or `docs`.
        assert errors("fix.schema.json", {"title": "Remedies nothing"}) != []

    def test_a_nested_item_that_breaks_the_referenced_shape(self) -> None:
        broken = {**GOOD_TWIN, "fixes": [{"title": "Remedies nothing"}]}

        assert errors("twin.schema.json", broken) != []

    def test_an_additional_property_of_the_wrong_type(self) -> None:
        assert errors("config.schema.json", {"pin": {"@comprehendo/ffmpeg": 142}}) != []

    def test_a_null_where_a_string_belongs(self) -> None:
        assert errors("topic.schema.json", {"topic": None, "summary": "s"}) != []


class TestItRefusesToPassWhatItCannotRead:
    def test_an_unknown_keyword_raises_rather_than_being_ignored(self) -> None:
        validator = Validator(SHAPES)

        with pytest.raises(SchemaError, match="does not implement"):
            validator.errors({"type": "string", "pattern": "^a"}, "abc")

    def test_an_unknown_type_name_raises(self) -> None:
        validator = Validator(SHAPES)

        with pytest.raises(SchemaError, match="unknown JSON Schema type"):
            validator.errors({"type": "date"}, "2026-08-22")

    def test_an_unresolvable_ref_raises(self) -> None:
        validator = Validator(SHAPES)

        with pytest.raises(SchemaError, match="unresolvable"):
            validator.errors({"$ref": "https://example.com/nope.json"}, {})

    def test_it_understands_every_keyword_the_kits_schemas_actually_use(self) -> None:
        # If the kit adds a keyword this validator does not implement, this
        # goes red HERE, at the validator, rather than silently widening what
        # the conformance run accepts.
        from .helpers.jsonschema_mini import _ANNOTATIONS, _SUPPORTED

        known = _ANNOTATIONS | _SUPPORTED
        for name, schema in SHAPES.items():
            used = set(keywords_of(schema))

            assert used <= known, f"{name} uses {sorted(used - known)}"
            assert used != set(), name
