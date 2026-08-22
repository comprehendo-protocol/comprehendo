"""The whole conformance kit, run by the Python port, with zero fixture changes.

Steps 1 to 3 of the kit's own "How to run the kit" (both READMEs): read every
file, validate every step's `response` against its shape, and apply the
scenario data on the envelope. Step 4, serializing each fixture back out and
comparing bytes, is `test_byte_identical.py`.

The files are read IN PLACE from `packages/spec/kit`. If anything here fails,
the port is wrong: CC2 [01] makes a fixture-change request a spec bug, and no
port ever gets a special-cased fixture.
"""

from __future__ import annotations

from typing import Any

from comprehendo import parse_declaration, probe, resolve_discovery

from .helpers.jsonschema_mini import Validator
from .helpers.kit import (
    EXPECTED_FIXTURES,
    EXPECTED_NEGATIVE_FIXTURES,
    NAMED_SHAPES,
    SCENARIOS,
    SURFACES,
    all_steps,
    kit_json,
    read_all_fixtures,
    read_all_negative,
    read_all_shapes,
)

SHAPES = read_all_shapes()
VALIDATOR = Validator(SHAPES)

ENVELOPE_HEAD = ("fixture", "title", "scenario", "rfc")
ENVELOPE_EXTRAS = ("discovery", "disagreements", "resolved", "source_pass", "unknown_fields")
NEGATIVE_HEAD = ("fixture", "title", "scenario", "rfc", "violation")
NEGATIVE_EXTRAS = (
    "budget",
    "declared_schema",
    "marker",
    "network_evidence",
    "raw_error",
    "suppression",
)
STEP_HEAD = ("step", "surface", "input")
STEP_TAIL = ("shape", "response")
STEP_ANNOTATIONS = ("did_you_mean", "vocabulary")


def validate(shape_file: str, value: Any) -> list[str]:
    return VALIDATOR.errors(SHAPES[shape_file], value)


class TestTheKitIsAllThere:
    def test_carries_exactly_the_positive_fixtures_the_roster_names(self) -> None:
        assert tuple(sorted(read_all_fixtures())) == EXPECTED_FIXTURES

    def test_carries_exactly_the_negative_fixtures_the_roster_names(self) -> None:
        assert tuple(sorted(read_all_negative())) == EXPECTED_NEGATIVE_FIXTURES

    def test_carries_exactly_the_shapes_the_rfc_names(self) -> None:
        assert tuple(sorted(SHAPES)) == NAMED_SHAPES


class TestTheEnvelope:
    def test_every_positive_fixture_names_itself_and_one_known_scenario(self) -> None:
        for file, fixture in read_all_fixtures().items():
            assert f"{fixture['fixture']}.json" == file
            assert fixture["scenario"] in SCENARIOS

    def test_every_positive_fixture_keeps_the_transcript_last(self) -> None:
        for file, fixture in read_all_fixtures().items():
            keys = list(fixture)
            assert keys[: len(ENVELOPE_HEAD)] == list(ENVELOPE_HEAD), file
            assert keys[-1] == "steps", file
            assert set(keys[len(ENVELOPE_HEAD) : -1]) <= set(ENVELOPE_EXTRAS), file

    def test_every_negative_fixture_adds_the_violation_block(self) -> None:
        for file, fixture in read_all_negative().items():
            keys = list(fixture)
            assert keys[: len(NEGATIVE_HEAD)] == list(NEGATIVE_HEAD), file
            assert keys[-1] == "steps", file
            assert set(keys[len(NEGATIVE_HEAD) : -1]) <= set(NEGATIVE_EXTRAS), file
            assert fixture["violation"]["reason"] == fixture["fixture"]

    def test_every_step_is_a_call_then_a_shaped_response(self) -> None:
        for entry in all_steps():
            keys = list(entry["step"])
            assert keys[: len(STEP_HEAD)] == list(STEP_HEAD), entry["file"]
            assert keys[-len(STEP_TAIL) :] == list(STEP_TAIL), entry["file"]
            assert set(keys[len(STEP_HEAD) : -len(STEP_TAIL)]) <= set(STEP_ANNOTATIONS)
            assert entry["step"]["surface"] in SURFACES


class TestEveryResponseValidatesAgainstItsShape:
    def test_for_every_step_of_the_positive_kit(self) -> None:
        checked = 0
        for entry in all_steps():
            step = entry["step"]
            errors = validate(step["shape"], step["response"])
            assert errors == [], f"{entry['file']} step {entry['index']}: {errors}"
            checked += 1

        assert checked >= 20

    def test_for_every_step_of_the_negative_kit_too(self) -> None:
        # These are non-conforming in one DIMENSION, never malformed: a
        # fixture that failed schema validation would fail its gate for the
        # wrong reason.
        checked = 0
        for file, fixture in read_all_negative().items():
            for index, step in enumerate(fixture["steps"]):
                errors = validate(step["shape"], step["response"])
                assert errors == [], f"{file} step {index}: {errors}"
                checked += 1

        assert checked >= 6

    def test_the_shape_every_step_names_actually_exists_in_the_kit(self) -> None:
        for entry in all_steps():
            assert entry["step"]["shape"] in SHAPES


class TestTheScenarioData:
    def test_the_disagreement_resolves_in_the_markers_favor(self) -> None:
        fixture = kit_json("fixtures", "disagreement.json")
        manifest = fixture["steps"][0]["response"]
        marker = fixture["steps"][1]["response"]

        resolved = resolve_discovery({"marker": marker, "manifest": manifest})

        assert resolved == fixture["resolved"]
        for disagreement in fixture["disagreements"]:
            assert disagreement["wins"] == "marker"
            assert manifest[disagreement["manifest_key"]] == disagreement["manifest_value"]
            assert marker[disagreement["marker_key"]] == disagreement["marker_value"]

    def test_a_manifest_only_answer_carries_no_surfaces_at_all(self) -> None:
        fixture = kit_json("fixtures", "disagreement.json")

        resolved = resolve_discovery({"manifest": fixture["steps"][0]["response"]})

        assert resolved is not None
        assert resolved["source"] == "manifest"
        assert "surfaces" not in resolved

    def test_forward_compatible_fields_are_present_and_accepted_not_rejected(self) -> None:
        fixture = kit_json("fixtures", "forward-compat.json")

        for unknown in fixture["unknown_fields"]:
            response: Any = fixture["steps"][unknown["step"]]["response"]
            # The shape named is the shape of the field's CONTAINER, which for a
            # field inside a fix is the fix, not the twin that carries it.
            container = response
            for segment in unknown["path"][:-1]:
                container = container[segment]

            assert unknown["field"] in container, unknown["field"]
            assert container[unknown["field"]] is not None
            assert validate(unknown["shape"], container) == [], unknown["field"]

    def test_the_manifest_reader_projects_the_forward_compatible_keys_away(self) -> None:
        manifest = kit_json("fixtures", "forward-compat.json")["steps"][2]["response"]

        reading = parse_declaration(manifest)

        assert reading["status"] == "declared"
        assert reading["declaration"] == {"version": "0.1", "level": 2}
        assert "corpus" not in reading["declaration"]
        assert "owners" not in reading["declaration"]

    def test_the_source_pass_is_granted_per_question_and_does_not_generalize(self) -> None:
        fixture = kit_json("fixtures", "undocumented-source-pass.json")
        grant = fixture["source_pass"]

        assert grant["generalizes"] is False
        assert grant["scope"] == "this question only"
        granted = [
            step["response"]["query"]
            for step in fixture["steps"]
            if step["shape"] == "undocumented.schema.json"
        ]
        assert grant["granted_for"] in granted
        assert len(granted) == 2

    def test_mid_failure_discovery_learns_from_the_twins_own_field(self) -> None:
        fixture = kit_json("fixtures", "probe-mid-failure-discovery.json")
        discovery = fixture["discovery"]

        assert discovery["never_probed_before"] is True
        learned = fixture["steps"][discovery["learned_from"]["step"]]["response"]
        assert learned[discovery["learned_from"]["field"]] == "0.1"

    def test_did_you_mean_rides_both_channels_for_the_same_near_miss(self) -> None:
        fixture = kit_json("fixtures", "did-you-mean.json")

        for step in fixture["steps"]:
            hint = step["did_you_mean"]
            assert step["response"][hint["field"]] == hint["candidates"]


class TestTheNegativeKitIsGenuinelyNonConforming:
    def test_the_raw_leak_really_is_in_reason_and_absent_from_received(self) -> None:
        fixture = kit_json("negative", "raw-error-leak.json")
        twin = fixture["steps"][0]["response"]

        assert twin["reason"] == fixture["raw_error"]
        assert "received" not in twin

    def test_the_escaping_apply_really_does_name_an_undeclared_operation(self) -> None:
        fixture = kit_json("negative", "schema-escaping-fix.json")
        escaping = fixture["steps"][0]["response"]["fixes"][1]["apply"]
        declared = fixture["declared_schema"]["operations"]

        used = {key for call in escaping for key in call}
        assert used - set(declared) == {"$out"}

    def test_the_suppression_key_really_is_absent_from_the_manifest_shape(self) -> None:
        fixture = kit_json("negative", "provider-side-corpus-veto.json")
        key = fixture["suppression"]["key"]

        assert key in fixture["steps"][0]["response"]
        assert key not in SHAPES["manifest.schema.json"]["properties"]

    def test_the_network_evidence_really_is_in_the_corpus_text_and_nowhere_else(self) -> None:
        fixture = kit_json("negative", "telemetry-attempt.json")
        code = fixture["steps"][0]["response"]["examples"][0]["code"]

        for evidence in fixture["network_evidence"]:
            assert evidence in code
        for other, positive in read_all_fixtures().items():
            text = str(positive)
            for evidence in fixture["network_evidence"]:
                assert evidence not in text, other

    def test_each_computed_marker_form_really_assembles_the_frozen_value(self) -> None:
        import re

        from .helpers.source_scan import find_marker_sites

        fixture = kit_json("negative", "computed-marker.json")

        sites = find_marker_sites(fixture["marker"]["computed"]["python"])
        assert [site.computed for site in sites] == [True]

        pieces = re.findall(r"'([^']*)'", fixture["marker"]["computed"]["javascript"])
        assert "".join(pieces) == "comprehendo"

    def test_every_negative_fixture_names_the_gate_that_owes_it_a_rejection(self) -> None:
        for file, fixture in read_all_negative().items():
            violation = fixture["violation"]
            assert violation["gate"], file
            assert violation["locator"], file
            assert violation["message"], file
            assert isinstance(violation["enforced"], bool), file


class TestTheKitNeverNamesOneLanguage:
    def test_no_positive_fixture_carries_an_ecosystem_specific_idiom(self) -> None:
        idioms = ("Symbol.for", "pyproject", "package.json", "__comprehendo__", "gemspec")

        for file, fixture in read_all_fixtures().items():
            text = str(fixture)
            for idiom in idioms:
                assert idiom not in text, f"{file} names {idiom}"

    def test_the_one_stated_exemption_is_the_computed_marker_fixture(self) -> None:
        fixture = kit_json("negative", "computed-marker.json")

        assert set(fixture["marker"]["frozen"]) == {"javascript", "python"}
        assert set(fixture["marker"]["computed"]) == {"javascript", "python"}


class TestTheProbeSurfaceAnswersEveryEntryTheKitCarries:
    def test_a_marked_value_hands_back_the_entry_unchanged(self) -> None:
        from comprehendo import attach_marker

        class Handle:
            pass

        checked = 0
        for entry in all_steps():
            if entry["step"]["shape"] != "entry.schema.json":
                continue
            response = entry["step"]["response"]
            known = {
                key: value
                for key, value in response.items()
                if key in ("comprehendo", "name", "level", "surfaces", "identity", "priming")
            }
            marked = attach_marker(Handle(), known)  # type: ignore[arg-type]
            assert probe(marked) == known, entry["file"]
            checked += 1

        assert checked >= 4
