"""CC2 [01]: byte-identical, not "semantically equivalent".

The kit's canonical serialization is frozen: `JSON.stringify(value, null, 2)`
plus one trailing newline, key order as authored. This suite is the proof that
the Python port reproduces those exact bytes, three ways:

1. Every kit file, read and written back out by this port, is byte-identical
   to the file on disk (step 4 of the kit's own "How to run the kit").
2. A twin BUILT in Python, serialized canonically, is byte-identical to the
   corresponding fixture's twin. Field order, key casing, and null-versus-
   absent all matter, so this is what catches a port that reorders keys or
   writes an absent optional as an explicit null.
3. Every other shape this port produces (entry, index, topic, UNDOCUMENTED,
   UNVALIDATABLE, explanation, manifest) is byte-identical to the kit's own.
"""

from __future__ import annotations

import json
from typing import Any

from comprehendo import canonical, create_twin_builder, make_provider, unstructured_twin

from .helpers.kit import KIT_ROOT, all_steps, kit_json, read_kit_text
from .helpers.toy import ToyRuntime, toy_corpus, toy_hooks
from .test_twin_kit import built_from, entry_of, topics_of


class TestTheCanonicalSerializer:
    def test_writes_two_space_indent_and_one_trailing_newline(self) -> None:
        assert canonical({"a": 1}) == '{\n  "a": 1\n}\n'

    def test_writes_an_empty_array_and_object_the_way_the_kit_does(self) -> None:
        assert canonical({"fixes": [], "topics": {}}) == '{\n  "fixes": [],\n  "topics": {}\n}\n'

    def test_keeps_the_key_order_it_was_handed_never_sorting(self) -> None:
        assert canonical({"b": 1, "a": 2}) == '{\n  "b": 1,\n  "a": 2\n}\n'

    def test_writes_non_ascii_as_itself_never_as_an_escape(self) -> None:
        assert canonical({"reason": "café"}) == '{\n  "reason": "café"\n}\n'

    def test_writes_true_and_null_in_json_spelling(self) -> None:
        assert canonical({"ok": True, "valid": None}) == '{\n  "ok": true,\n  "valid": null\n}\n'


class TestEveryKitFileRoundTripsByteForByte:
    def test_for_every_positive_fixture(self) -> None:
        checked = 0
        for path in sorted((KIT_ROOT / "fixtures").glob("*.json")):
            text = path.read_text(encoding="utf-8")
            assert canonical(json.loads(text)) == text, path.name
            checked += 1

        assert checked == 9

    def test_for_every_negative_fixture(self) -> None:
        checked = 0
        for path in sorted((KIT_ROOT / "negative").glob("*.json")):
            text = path.read_text(encoding="utf-8")
            assert canonical(json.loads(text)) == text, path.name
            checked += 1

        assert checked == 6

    def test_but_not_for_the_shape_schemas_which_are_hand_formatted(self) -> None:
        # Scope, stated as a test so nobody later "fixes" the schemas by
        # reformatting them. CC2's canonical rule is written in BOTH fixture
        # READMEs and covers the fixture kits; the schemas in `kit/shapes/` are
        # hand-formatted (`"required": ["topic", "summary"]` on one line, which
        # `JSON.stringify(x, null, 2)` never emits) and no README claims
        # otherwise. What this port owes them is to read them and never rewrite
        # them.
        reformatted = 0
        for path in sorted((KIT_ROOT / "shapes").glob("*.schema.json")):
            text = path.read_text(encoding="utf-8")
            parsed = json.loads(text)

            assert json.loads(canonical(parsed)) == parsed, path.name
            assert text.endswith("\n"), path.name
            if canonical(parsed) != text:
                reformatted += 1

        assert reformatted == 10


class TestATwinBuiltInPythonIsByteIdenticalToItsNodeFixture:
    def _bytes_of(self, file: str, index: int) -> str:
        """The canonical bytes of one fixture step's response, as the file has them."""
        return canonical(kit_json("fixtures", file)["steps"][index]["response"])

    def test_the_fully_structured_twin(self) -> None:
        twin = kit_json("fixtures", "twin-round-trip.json")["steps"][0]["response"]
        catalog: Any = {
            "declared_schema": {
                "surface": "aggregate(pipeline)",
                "operations": ["$match", "$sort", "$limit", "$project", "$group", "$count"],
            },
            "topics": topics_of(twin),
            "entries": [entry_of(twin)],
        }

        built = create_twin_builder(catalog).build(twin["code"])

        assert canonical(built) == self._bytes_of("twin-round-trip.json", 0)

    def test_the_unstructured_passthrough(self) -> None:
        twin = kit_json("fixtures", "twin-round-trip.json")["steps"][1]["response"]

        built = unstructured_twin(twin["received"])

        assert canonical(built) == self._bytes_of("twin-round-trip.json", 1)

    def test_the_docs_only_twin(self) -> None:
        twin = kit_json("fixtures", "twin-round-trip.json")["steps"][2]["response"]
        catalog: Any = {
            "declared_schema": {"surface": "aggregate(pipeline)", "operations": ["$match"]},
            "topics": topics_of(twin),
            "entries": [entry_of(twin)],
        }

        built = create_twin_builder(catalog).build(twin["code"])

        assert canonical(built) == self._bytes_of("twin-round-trip.json", 2)

    def test_every_twin_the_positive_kit_carries(self) -> None:
        checked = 0
        for entry in all_steps():
            step = entry["step"]
            if step["shape"] != "twin.schema.json":
                continue
            twin = step["response"]
            known = {
                key: value
                for key, value in twin.items()
                if key
                in (
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
            }
            if twin["code"] == "UNSTRUCTURED":
                built: Any = unstructured_twin(twin["received"])
            else:
                built = built_from(twin)

            assert canonical(built) == canonical(known), f"{entry['file']} step {entry['index']}"
            checked += 1

        assert checked >= 5


class TestEveryOtherShapeThisPortProduces:
    def provider(self) -> Any:
        return make_provider(toy_corpus(), toy_hooks("both", ToyRuntime()))

    def test_the_entry_a_probe_hands_back(self) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][0]

        assert canonical(self.provider().entry) == canonical(step["response"])

    def test_the_index_docs_returns_with_no_argument(self) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][1]

        assert canonical(self.provider().docs()) == canonical(step["response"])

    def test_one_topic_sized_answer(self) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][2]

        assert canonical(self.provider().docs(step["input"])) == canonical(step["response"])

    def test_the_undocumented_miss(self) -> None:
        # did-you-mean's miss, not probe-miss's: this one's `nearest` ranking is
        # unambiguous, so the bytes are determined end to end. The two whose
        # ranking ties or sits on the floor are pinned, with their evidence, in
        # `test_docs.py::TestWhereTheRankingAndTheTranscriptDiffer`.
        step = kit_json("fixtures", "did-you-mean.json")["steps"][1]

        assert canonical(self.provider().docs(step["input"])) == canonical(step["response"])

    def test_the_unvalidatable_abstention(self) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][3]

        assert canonical(self.provider().validate(step["input"])) == canonical(step["response"])

    def test_the_explanation(self) -> None:
        step = kit_json("fixtures", "probe-hit.json")["steps"][4]

        assert canonical(self.provider().explain(step["input"])) == canonical(step["response"])

    def test_the_manifest_declaration(self) -> None:
        from comprehendo import declaration_for

        entry = kit_json("fixtures", "disagreement.json")["steps"][1]["response"]

        assert canonical(declaration_for(entry)) == canonical({"version": "0.1", "level": 1})

    def test_the_resolved_discovery_view(self) -> None:
        from comprehendo import resolve_discovery

        fixture = kit_json("fixtures", "disagreement.json")

        resolved = resolve_discovery(
            {
                "marker": fixture["steps"][1]["response"],
                "manifest": fixture["steps"][0]["response"],
            }
        )

        assert canonical(resolved) == canonical(fixture["resolved"])


class TestNullVersusAbsent:
    def test_an_absent_optional_never_becomes_an_explicit_null(self) -> None:
        twin = unstructured_twin("Sort exceeded memory limit of 33554432 bytes")

        assert "null" not in canonical(twin)
        assert '"path"' not in canonical(twin)

    def test_a_shape_whose_field_IS_null_writes_it_as_null(self) -> None:
        provider = make_provider(toy_corpus(), toy_hooks("both", ToyRuntime()))

        verdict = provider.validate([{"$merge": {"into": {"$concat": ["a", "$b"]}}}])

        assert '"valid": null' in canonical(verdict)


class TestTheKitReadsUnmodified:
    def test_no_fixture_file_was_touched_by_this_suite(self) -> None:
        # Read twice, with the whole conformance suite in between (pytest runs
        # this file after the others in the same session): the bytes on disk
        # are the bytes the kit shipped.
        for kind in ("fixtures", "negative"):
            for path in sorted((KIT_ROOT / kind).glob("*.json")):
                assert read_kit_text(kind, path.name) == path.read_text(encoding="utf-8")
