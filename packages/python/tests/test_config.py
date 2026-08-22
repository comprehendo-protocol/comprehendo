"""Manifest Wiring [15], the Python port: the static-discovery channel.

Reads and writes the provider-side declaration in the manifest each ecosystem
already has: the `comprehendo` key in `package.json`, `[tool.comprehendo]` in
`pyproject.toml`. What a manifest SAYS never raises, it is reported; the
absence of a readable FILE does raise, because there is nothing to report
about.

The three alternate TOML spellings of the same key (inline table, dotted
assignment, and the array-of-tables form) come back `unreadable` with the
limitation named, never `absent`: "this package does not speak Comprehendo" is
the one wrong answer available about one that does.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from comprehendo import (
    MANIFEST_FIELDS,
    MANIFEST_KEY,
    PYPROJECT_TABLE,
    ComprehendoEntry,
    ManifestError,
    declaration_for,
    parse_declaration,
    read_manifest_file,
    read_package_json,
    read_pyproject,
    resolve_discovery,
    stamp_manifest_file,
    stamp_package_json,
    stamp_pyproject,
)

from .helpers.kit import PACKAGE_ROOT, kit_json

ENTRY: ComprehendoEntry = {
    "comprehendo": "0.1",
    "name": "mongodb-operator",
    "level": 2,
    "surfaces": ["docs", "validate", "explain"],
    "identity": "what the tool is",
    "priming": "the snippet",
}

TABLE = f"[{PYPROJECT_TABLE}]" if PYPROJECT_TABLE else "[tool.comprehendo]"


class TestTheFrozenLiterals:
    def test_name_the_keys_this_build_reads_and_writes(self) -> None:
        assert MANIFEST_KEY == "comprehendo"
        assert PYPROJECT_TABLE == "tool.comprehendo"

    def test_the_declaration_is_exactly_two_fields(self) -> None:
        assert MANIFEST_FIELDS == ("version", "level")


class TestDeclarationFor:
    def test_reads_the_declaration_off_the_entry_the_runtime_reached(self) -> None:
        assert declaration_for(ENTRY) == {"version": "0.1", "level": 2}

    def test_refuses_to_stamp_a_declaration_that_would_not_validate(self) -> None:
        with pytest.raises(ManifestError, match="level"):
            declaration_for({**ENTRY, "level": 3})  # type: ignore[typeddict-item]


class TestParseDeclaration:
    def test_reports_absent_when_nothing_is_there(self) -> None:
        assert parse_declaration(None) == {"status": "absent"}

    def test_reports_declared_and_projects_to_the_two_fields(self) -> None:
        reading = parse_declaration({"version": "0.1", "level": 2, "corpus": "@comprehendo/x"})

        assert reading["status"] == "declared"
        assert reading["declaration"] == {"version": "0.1", "level": 2}

    def test_reports_unreadable_naming_the_field_that_is_wrong(self) -> None:
        for value, expected in (
            ("not an object", "must be an object"),
            ({"level": 2}, "version"),
            ({"version": "", "level": 2}, "version"),
            ({"version": "0.1"}, "level"),
            ({"version": "0.1", "level": "2"}, "level"),
            ({"version": "0.1", "level": 3}, "level"),
        ):
            reading = parse_declaration(value)

            assert reading["status"] == "unreadable", value
            assert expected in reading["reason"], value

    def test_never_prints_the_value_it_refused(self) -> None:
        reading = parse_declaration({"version": "0.1", "level": "s3cr3t"})

        assert "s3cr3t" not in reading["reason"]


class TestPackageJson:
    def test_reports_absent_when_the_key_is_not_there(self) -> None:
        assert read_package_json('{"name": "x"}') == {"status": "absent"}

    def test_reads_the_declaration_out_of_the_key(self) -> None:
        text = json.dumps({"name": "x", MANIFEST_KEY: {"version": "0.1", "level": 2}})

        assert read_package_json(text)["declaration"] == {"version": "0.1", "level": 2}

    def test_reports_unreadable_rather_than_raising_on_broken_json(self) -> None:
        reading = read_package_json("{not json")

        assert reading["status"] == "unreadable"
        assert "not valid JSON" in reading["reason"]

    def test_stamps_the_two_fields_in_place(self) -> None:
        text = '{\n  "name": "x"\n}\n'

        stamped = stamp_package_json(text, {"version": "0.1", "level": 2})

        assert json.loads(stamped)[MANIFEST_KEY] == {"version": "0.1", "level": 2}
        assert stamped.endswith("\n")

    def test_merges_rather_than_replacing_what_the_key_already_carries(self) -> None:
        text = json.dumps(
            {"name": "x", MANIFEST_KEY: {"disable": ["noisy"], "version": "0.0", "level": 1}},
            indent=2,
        )

        stamped = json.loads(stamp_package_json(text, {"version": "0.1", "level": 2}))

        assert stamped[MANIFEST_KEY] == {"disable": ["noisy"], "version": "0.1", "level": 2}

    def test_keeps_the_indentation_the_file_already_used(self) -> None:
        text = '{\n    "name": "x"\n}\n'

        stamped = stamp_package_json(text, {"version": "0.1", "level": 2})

        assert '\n    "name"' in stamped

    def test_refuses_to_stamp_something_that_is_not_a_package_json(self) -> None:
        with pytest.raises(ManifestError, match="refusing to stamp"):
            stamp_package_json("[]", {"version": "0.1", "level": 2})


class TestPyprojectTheTableHeaderForm:
    def test_reports_absent_when_the_table_is_not_there(self) -> None:
        assert read_pyproject('[project]\nname = "x"\n') == {"status": "absent"}

    def test_reads_the_two_fields_out_of_the_table(self) -> None:
        text = f'[project]\nname = "x"\n\n{TABLE}\nversion = "0.1"\nlevel = 2\n'

        assert read_pyproject(text)["declaration"] == {"version": "0.1", "level": 2}

    def test_stops_reading_at_the_next_table_header(self) -> None:
        text = f'{TABLE}\nversion = "0.1"\nlevel = 2\n\n[tool.other]\nlevel = 9\n'

        assert read_pyproject(text)["declaration"] == {"version": "0.1", "level": 2}

    def test_ignores_a_trailing_comment_on_a_value(self) -> None:
        text = f'{TABLE}\nversion = "0.1"  # the spec version\nlevel = 2 # computed\n'

        assert read_pyproject(text)["declaration"] == {"version": "0.1", "level": 2}

    def test_stamps_the_fields_in_place_leaving_everything_else_alone(self) -> None:
        text = f'[project]\nname = "x"\n\n{TABLE}\nversion = "0.0"\nlevel = 1\n'

        stamped = stamp_pyproject(text, {"version": "0.1", "level": 2})

        assert '[project]\nname = "x"' in stamped
        assert read_pyproject(stamped)["declaration"] == {"version": "0.1", "level": 2}

    def test_appends_the_table_when_the_file_has_none(self) -> None:
        text = '[project]\nname = "x"\n'

        stamped = stamp_pyproject(text, {"version": "0.1", "level": 2})

        assert TABLE in stamped
        assert read_pyproject(stamped)["declaration"] == {"version": "0.1", "level": 2}

    def test_adds_a_missing_field_to_a_table_that_carries_the_other(self) -> None:
        text = f'{TABLE}\nversion = "0.0"\n'

        stamped = stamp_pyproject(text, {"version": "0.1", "level": 2})

        assert read_pyproject(stamped)["declaration"] == {"version": "0.1", "level": 2}

    def test_keeps_the_line_ending_the_file_already_used(self) -> None:
        text = f'[project]\r\nname = "x"\r\n\r\n{TABLE}\r\nversion = "0.0"\r\nlevel = 1\r\n'

        stamped = stamp_pyproject(text, {"version": "0.1", "level": 2})

        assert "\r\n" in stamped
        assert stamped.count("\n") == stamped.count("\r\n")


class TestPyprojectTheThreeAlternateSpellings:
    """Each is valid TOML for the same key, and each is refused, never ignored."""

    def test_the_inline_table_under_a_tool_header(self) -> None:
        text = '[tool]\ncomprehendo = { version = "0.1", level = 2 }\n'

        reading = read_pyproject(text)

        assert reading["status"] == "unreadable"
        assert "inline table" in reading["reason"]
        assert "line 2" in reading["reason"]

    def test_the_dotted_assignment(self) -> None:
        text = f'{PYPROJECT_TABLE} = {{ version = "0.1", level = 2 }}\n'

        reading = read_pyproject(text)

        assert reading["status"] == "unreadable"
        assert "inline table" in reading["reason"]

    def test_the_array_of_tables(self) -> None:
        text = f'[[{PYPROJECT_TABLE}]]\nversion = "0.1"\nlevel = 2\n'

        reading = read_pyproject(text)

        assert reading["status"] == "unreadable"
        assert "array of tables" in reading["reason"]
        assert "line 1" in reading["reason"]

    def test_the_array_of_tables_is_caught_before_the_generic_header_match(self) -> None:
        # The regression: the double bracket confused a single-bracket capture,
        # so this fell through as silently ABSENT and stamping appended a
        # second, conflicting table, producing invalid TOML.
        text = f'[project]\nname = "x"\n\n[[{PYPROJECT_TABLE}]]\nversion = "0.1"\nlevel = 2\n'

        assert read_pyproject(text)["status"] == "unreadable"

    def test_stamping_any_of_the_three_refuses_rather_than_corrupting_the_file(self) -> None:
        for text in (
            '[tool]\ncomprehendo = { version = "0.1", level = 2 }\n',
            f'{PYPROJECT_TABLE} = {{ version = "0.1", level = 2 }}\n',
            f'[[{PYPROJECT_TABLE}]]\nversion = "0.1"\nlevel = 2\n',
        ):
            with pytest.raises(ManifestError, match="refusing to stamp"):
                stamp_pyproject(text, {"version": "0.1", "level": 2})

    def test_a_similarly_named_table_is_not_this_one(self) -> None:
        text = '[tool.comprehendo-extras]\nversion = "0.1"\nlevel = 2\n'

        assert read_pyproject(text) == {"status": "absent"}


class TestManifestFilesOnDisk:
    def test_reads_a_real_package_json(self, tmp_path: Path) -> None:
        path = tmp_path / "package.json"
        path.write_text(json.dumps({MANIFEST_KEY: {"version": "0.1", "level": 2}}), "utf-8")

        assert read_manifest_file(str(path))["declaration"] == {"version": "0.1", "level": 2}

    def test_reads_this_ports_own_pyproject_toml(self) -> None:
        reading = read_manifest_file(str(PACKAGE_ROOT / "pyproject.toml"))

        assert reading["status"] == "declared"
        assert reading["declaration"] == {"version": "0.1", "level": 2}

    def test_raises_on_a_file_name_this_build_does_not_know(self, tmp_path: Path) -> None:
        path = tmp_path / "setup.cfg"
        path.write_text("[metadata]\n", "utf-8")

        with pytest.raises(ManifestError, match="not a manifest"):
            read_manifest_file(str(path))

    def test_raises_when_there_is_no_file_to_report_about(self, tmp_path: Path) -> None:
        with pytest.raises(ManifestError, match="cannot read"):
            read_manifest_file(str(tmp_path / "package.json"))

    def test_stamping_writes_once_and_is_a_no_op_the_second_time(self, tmp_path: Path) -> None:
        path = tmp_path / "pyproject.toml"
        path.write_text('[project]\nname = "x"\n', "utf-8")

        assert stamp_manifest_file(str(path), {"version": "0.1", "level": 2}) is True
        before = path.read_bytes()
        assert stamp_manifest_file(str(path), {"version": "0.1", "level": 2}) is False
        assert path.read_bytes() == before

    def test_a_re_stamp_leaves_a_conforming_file_byte_for_byte_alone(self) -> None:
        path = PACKAGE_ROOT / "pyproject.toml"
        before = path.read_bytes()

        assert stamp_manifest_file(str(path), {"version": "0.1", "level": 2}) is False
        assert path.read_bytes() == before


class TestResolveDiscovery:
    def test_the_marker_wins_even_where_the_two_channels_agree(self) -> None:
        resolved = resolve_discovery({"marker": ENTRY, "manifest": {"version": "0.1", "level": 2}})

        assert resolved == {
            "comprehendo": "0.1",
            "level": 2,
            "surfaces": ["docs", "validate", "explain"],
            "source": "marker",
        }

    def test_a_manifest_only_answer_claims_no_surfaces_at_all(self) -> None:
        resolved = resolve_discovery({"manifest": {"version": "0.1", "level": 1}})

        assert resolved == {"comprehendo": "0.1", "level": 1, "source": "manifest"}

    def test_neither_channel_answering_is_no_answer_not_a_default(self) -> None:
        assert resolve_discovery({}) is None

    def test_the_kits_disagreement_fixture_resolves_the_markers_way(self) -> None:
        fixture = kit_json("fixtures", "disagreement.json")

        resolved = resolve_discovery(
            {
                "marker": fixture["steps"][1]["response"],
                "manifest": fixture["steps"][0]["response"],
            }
        )

        assert resolved == fixture["resolved"]
