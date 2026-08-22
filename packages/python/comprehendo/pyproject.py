"""Manifest Wiring [15], the pyproject half: `[tool.comprehendo]`.

Split out of `config.py` because it is one job (a line-oriented TOML reader and
writer for one table of two flat scalars) and because it is the half with the
edge cases worth testing on their own terms: the three other valid TOML
spellings of the same key, each of which must be REFUSED by name rather than
read as absent.

Deliberately not a TOML parser. `tomllib` (standard library since 3.11) reads
TOML but cannot write it, and a stamp that round-tripped a maintainer's
pyproject.toml through a parser would reformat their whole file to set two
fields. What a minimal reader owes its caller instead is honesty about the
spellings it does not handle, which is what `unreadable` is for: "this package
does not speak Comprehendo" is the one wrong answer available about one that
does.

@see .mdd/docs/15-manifest-wiring.md
"""

from __future__ import annotations

import json
import re
from typing import Any, NamedTuple

from .declaration import (
    MANIFEST_KEY,
    PYPROJECT_TABLE,
    ManifestDeclaration,
    ManifestError,
    ManifestReading,
    assert_declaration,
    parse_declaration,
)

__all__ = ["read_pyproject", "stamp_pyproject"]


class _TomlTable(NamedTuple):
    """Where `[tool.comprehendo]` sits, or why it could not be read.

    `header` is the header line's index (-1 when there is none), `end` one past
    the table's last body line, `inline` the reason it could not be read.
    """

    header: int
    end: int
    inline: str | None = None


_ESCAPED_TABLE = PYPROJECT_TABLE.replace(".", r"\.")
_TABLE_HEADER = re.compile(rf"^\s*\[{_ESCAPED_TABLE}\]\s*(#.*)?$")
# The array-of-tables spelling, [[tool.comprehendo]]: a third valid TOML way to
# occupy this key, alongside the inline-table and dotted-assignment forms
# refused below. Checked BEFORE the generic header match, which would otherwise
# capture the inner "[tool.comprehendo" (the double bracket confuses a
# single-bracket capture) as garbage and silently ignore it.
_ARRAY_TABLE_HEADER = re.compile(rf"^\s*\[\[{_ESCAPED_TABLE}\]\]\s*(#.*)?$")
_ANY_HEADER = re.compile(r"^\s*\[")
_HEADER_NAME = re.compile(r"^\s*\[([^\]]+)\]")
_KEY_NAME = re.compile(r"^\s*([A-Za-z0-9_.-]+)\s*=")


def _locate_table(lines: list[str]) -> _TomlTable:
    """Find `[tool.comprehendo]`, or say why this reader cannot handle it.

    The pyproject half is deliberately NOT a TOML parser: this is one table of
    two flat scalars, a line-oriented job, and zero runtime dependencies is a
    hard constraint. (`tomllib` reads TOML but cannot WRITE it, and a stamp
    that reformatted a maintainer's whole file to round-trip two fields is not
    a stamp.) What a minimal reader owes its caller is honesty about the
    spellings it does not handle, so the inline forms come back `unreadable`
    with the limitation named, never `absent`: "this package does not speak
    Comprehendo" is the one wrong answer available about one that does.
    """
    current = ""
    for index, line in enumerate(lines):
        if _ARRAY_TABLE_HEADER.match(line):
            return _TomlTable(
                -1,
                -1,
                f"[{PYPROJECT_TABLE}] is written as an array of tables ([[...]]) at "
                f"line {index + 1}; this build reads and writes only the "
                "single-table-header form",
            )
        if _TABLE_HEADER.match(line):
            end = index + 1
            while end < len(lines) and not _ANY_HEADER.match(lines[end]):
                end += 1
            return _TomlTable(index, end)
        header = _HEADER_NAME.match(line)
        if header is not None:
            current = header.group(1).strip()
            continue
        key = _KEY_NAME.match(line)
        name = key.group(1) if key is not None else ""
        if name == PYPROJECT_TABLE or (current == "tool" and name == MANIFEST_KEY):
            return _TomlTable(
                -1,
                -1,
                f"[{PYPROJECT_TABLE}] is written as an inline table at line {index + 1}; "
                "this build reads and writes only the table-header form",
            )
    return _TomlTable(-1, -1)


def _toml_value(line: str) -> str:
    """A TOML line's value, with any trailing comment (outside quotes) removed."""
    equals = line.find("=")
    if equals == -1:
        return ""
    quote = ""
    end = len(line)
    for i in range(equals + 1, len(line)):
        char = line[i]
        if quote:
            if char == quote:
                quote = ""
        elif char in ('"', "'"):
            quote = char
        elif char == "#":
            end = i
            break
    return line[equals + 1 : end].strip()


def _toml_key(line: str) -> str:
    found = _KEY_NAME.match(line)
    return found.group(1) if found is not None else ""


def _toml_scalar(raw: str) -> str | int | None:
    """Basic strings and integers, the only two value kinds this table holds."""
    if len(raw) >= 2 and raw[0] in ('"', "'") and raw.endswith(raw[0]):
        return raw[1:-1]
    return int(raw) if re.fullmatch(r"[+-]?\d+", raw) else None


def read_pyproject(text: str) -> ManifestReading:
    """Read `[tool.comprehendo]` out of pyproject.toml text. Never raises."""
    lines = re.split(r"\r?\n", text)
    table = _locate_table(lines)
    if table.inline is not None:
        return {"status": "unreadable", "reason": table.inline}
    if table.header == -1:
        return {"status": "absent"}
    found: dict[str, Any] = {}
    for line in lines[table.header + 1 : table.end]:
        key = _toml_key(line)
        if key == "":
            continue
        value = _toml_scalar(_toml_value(line))
        if value is not None:
            found[key] = value
    return parse_declaration(found)


def stamp_pyproject(text: str, declaration: ManifestDeclaration) -> str:
    """Write the declaration into pyproject.toml text: the table's own `version`
    and `level` lines are edited in place, everything else (other tables, other
    keys, comments, spacing) preserved character for character."""
    stamped = assert_declaration(declaration)
    newline = "\r\n" if "\r\n" in text else "\n"
    lines = re.split(r"\r?\n", text)
    table = _locate_table(lines)
    if table.inline is not None:
        raise ManifestError(
            f"comprehendo: refusing to stamp this pyproject.toml, {table.inline}. "
            "Rewrite it as a table header, or set the two fields by hand."
        )
    written = {
        "version": f"version = {json.dumps(stamped['version'])}",
        "level": f"level = {stamped['level']}",
    }
    if table.header == -1:
        head = re.sub(r"\s*$", "", text)
        added = newline.join([f"[{PYPROJECT_TABLE}]", written["version"], written["level"], ""])
        return added if head == "" else f"{head}{newline}{newline}{added}"

    body = lines[table.header + 1 : table.end]
    missing = [key for key in written if not any(_toml_key(line) == key for line in body)]
    edited = [written.get(_toml_key(line), line) for line in body]
    insert_at = len(edited)
    while insert_at > 0 and edited[insert_at - 1].strip() == "":
        insert_at -= 1
    edited[insert_at:insert_at] = [written[key] for key in missing]
    return newline.join([*lines[: table.header + 1], *edited, *lines[table.end :]])
