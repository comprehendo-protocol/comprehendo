"""CC8 [19], the schema half: no provider-side veto over a community corpus.

Structural, not policy. The declaration is exactly `{version, level}` and every
read PROJECTS to those two fields, so a provider cannot express "do not use a
registry corpus for my package": there is no field for it, and nothing to
carry one through. The negative kit's provider-side-corpus-veto fixture is the
must-fail proof and it is driven here against the real reader.

CC8's runtime half is Router & Precedence [22]'s, Wave 4.
"""

from __future__ import annotations

from comprehendo import MANIFEST_FIELDS, parse_declaration, read_package_json

from .helpers.kit import kit_json, read_all_shapes

FIXTURE = kit_json("negative", "provider-side-corpus-veto.json")
SUPPRESSION = FIXTURE["suppression"]["key"]


class TestTheDeclarationHasNoRoomForAVeto:
    def test_carries_exactly_two_fields_and_a_third_is_a_cc8_decision(self) -> None:
        assert MANIFEST_FIELDS == ("version", "level")

    def test_the_shape_itself_names_no_suppression_field(self) -> None:
        manifest_schema = read_all_shapes()["manifest.schema.json"]

        assert set(manifest_schema["properties"]) == {"version", "level"}
        assert SUPPRESSION not in manifest_schema["properties"]


class TestTheVetoFixtureIsProjectedAway:
    def test_names_this_component_as_the_gate_that_owes_the_rejection(self) -> None:
        assert FIXTURE["violation"]["rule"] == "CC8"
        assert FIXTURE["violation"]["gate"] == "manifest-scan"

    def test_the_real_reader_reads_the_declaration_and_drops_the_suppression(self) -> None:
        declared = FIXTURE["steps"][0]["response"]

        reading = parse_declaration(declared)

        assert SUPPRESSION in declared
        assert reading["status"] == "declared"
        assert set(reading["declaration"]) == {"version", "level"}
        assert SUPPRESSION not in reading["declaration"]

    def test_the_same_holds_reading_it_out_of_a_real_package_json(self) -> None:
        import json

        text = json.dumps({"name": "x", "comprehendo": FIXTURE["steps"][0]["response"]})

        reading = read_package_json(text)

        assert reading["declaration"] == {"version": "0.1", "level": 2}

    def test_no_reader_in_this_port_can_hand_a_veto_to_a_caller(self) -> None:
        # Whatever else rides under the manifest key, out come these two
        # fields and nothing else. That is the projection CC8 rests on.
        for extra in ("registry", "corpus", "owners", "disable", "prefer"):
            reading = parse_declaration(
                {"version": "0.1", "level": 2, extra: {"corpus": "disabled"}}
            )

            assert set(reading["declaration"]) == {"version", "level"}, extra
