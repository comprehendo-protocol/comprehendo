"""Manifest Wiring [15]: the provider-side manifest declaration, written into
and read back out of the manifest each ecosystem already has.

Discovery channel two of four, and the only one that answers BEFORE anything is
imported: a tool can learn that a package speaks Comprehendo by reading its
manifest, no code loaded, no side effect. The marker (Marker & Probe [11]) is
the runtime truth, this is the pre-import truth, and it is ADVISORY: when they
disagree, :func:`resolve_discovery` resolves in the marker's favor (the
disagreement fixture, Conformance Fixtures [04]).

This module is the surface consumers import: the `package.json` half plus the
resolution rule, with the declaration itself in `declaration.py` and the
`[tool.comprehendo]` half in `pyproject.py`, both re-exported here.

@see .mdd/docs/15-manifest-wiring.md
@see .mdd/docs/19-cc8-native-precedence.md
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Callable, Literal, NamedTuple, NotRequired, TypedDict

from ._frozen import freeze
from .declaration import (
    MANIFEST_FIELDS,
    MANIFEST_KEY,
    PYPROJECT_TABLE,
    ManifestDeclaration,
    ManifestError,
    ManifestReading,
    assert_declaration,
    declaration_for,
    describe,
    parse_declaration,
)
from .marker import ComprehendoEntry, ComprehendoLevel, ComprehendoSurface
from .pyproject import read_pyproject, stamp_pyproject

__all__ = [
    "MANIFEST_FIELDS",
    "MANIFEST_KEY",
    "PYPROJECT_TABLE",
    "Discovery",
    "DiscoveryInput",
    "ManifestDeclaration",
    "ManifestError",
    "ManifestReading",
    "declaration_for",
    "parse_declaration",
    "read_manifest_file",
    "read_package_json",
    "read_pyproject",
    "resolve_discovery",
    "stamp_manifest_file",
    "stamp_package_json",
    "stamp_pyproject",
]


class Discovery(TypedDict):
    """The resolved discovery view: what a tool should believe, and which
    channel it came from."""

    comprehendo: str
    level: ComprehendoLevel
    #: Present only from the marker: static discovery cannot know the surfaces.
    surfaces: NotRequired[list[ComprehendoSurface]]
    source: Literal["marker", "manifest"]


class DiscoveryInput(TypedDict):
    """Both discovery channels, either of which may be missing."""

    marker: NotRequired[ComprehendoEntry | None]
    manifest: NotRequired[ManifestDeclaration | None]


def _host_json(text: str) -> dict[str, Any] | str:
    """package.json text as the mapping it must be, or the reason it is not."""
    try:
        host = json.loads(text)
    except ValueError as error:
        return f"package.json is not valid JSON: {error}"
    if not isinstance(host, dict):
        return f"a package.json must be a JSON object, got {describe(host)}"
    return host


def read_package_json(text: str) -> ManifestReading:
    """Read the `comprehendo` key out of package.json text. Never raises."""
    host = _host_json(text)
    if isinstance(host, str):
        return {"status": "unreadable", "reason": host}
    if MANIFEST_KEY not in host:
        return {"status": "absent"}
    return parse_declaration(host[MANIFEST_KEY])


def _indent_of(text: str) -> int | str:
    """The indentation the file already used, so a stamp is not also a reformat."""
    found = re.search(r'\n([ \t]+)"', text)
    if found is None:
        return 2
    whitespace = found.group(1)
    return "\t" if whitespace.startswith("\t") else len(whitespace)


def stamp_package_json(text: str, declaration: ManifestDeclaration) -> str:
    """Write the declaration into package.json text, MERGING into whatever the
    key already carries rather than replacing it: the consumer's five knobs
    (config.schema.json) and RFC 10.6's endorsement keys live under this same
    key, and a stamp that replaced it would delete a consumer's configuration.

    :returns: the new text: same indentation, same trailing newline, same field
        order, with `version` and `level` set in place.
    """
    stamped = assert_declaration(declaration)
    host = _host_json(text)
    if isinstance(host, str):
        raise ManifestError(f"comprehendo: refusing to stamp a package.json, {host}")
    existing = host.get(MANIFEST_KEY)
    host[MANIFEST_KEY] = {
        **(existing if isinstance(existing, dict) else {}),
        "version": stamped["version"],
        "level": stamped["level"],
    }
    body = json.dumps(host, indent=_indent_of(text), ensure_ascii=False)
    return f"{body}\n" if text.endswith("\n") or text.strip() == "" else body


class _Format(NamedTuple):
    read: Callable[[str], ManifestReading]
    stamp: Callable[[str, ManifestDeclaration], str]


#: The two manifests a provider-side declaration can live in, by file name.
_FORMATS = {
    "package.json": _Format(read_package_json, stamp_package_json),
    "pyproject.toml": _Format(read_pyproject, stamp_pyproject),
}


def _format_for(path: str) -> _Format:
    name = Path(path).name
    if name not in _FORMATS:
        raise ManifestError(
            f"comprehendo: {name} is not a manifest this build reads or writes "
            f"(package.json or pyproject.toml, at {path})"
        )
    return _FORMATS[name]


def _read_host(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8")
    except OSError as error:
        raise ManifestError(f"comprehendo: cannot read {path}: {error}") from error


def read_manifest_file(path: str) -> ManifestReading:
    """Read the declaration out of a real manifest on disk.

    What the manifest SAYS never raises (an unreadable claim is reported); the
    absence of a readable FILE does, because there is nothing to report about.
    """
    return _format_for(path).read(_read_host(path))


def stamp_manifest_file(path: str, declaration: ManifestDeclaration) -> bool:
    """Stamp the declaration into a real manifest on disk.

    :returns: True when the file was written. A manifest already carrying this
        exact declaration is left untouched, byte for byte, so re-stamping is a
        no-op rather than a reformat and this is safe to run on every build.
    """
    fmt = _format_for(path)
    stamped = assert_declaration(declaration)
    text = _read_host(path)
    current = fmt.read(text)
    if current["status"] == "declared" and current["declaration"] == stamped:
        return False
    Path(path).write_text(fmt.stamp(text, stamped), encoding="utf-8")
    return True


def resolve_discovery(input: DiscoveryInput) -> Discovery | None:
    """The rule this whole component is subordinate to: the marker is
    authoritative, the manifest advisory.

    When both channels answer, the marker's claim is the resolved one and the
    manifest's is discarded EVEN WHERE THEY AGREE, so nothing here depends on
    them happening to match (the disagreement fixture, Conformance Fixtures
    [04]). A manifest-only answer carries no `surfaces` at all: static
    discovery cannot know which exist, and an empty list would be a claim that
    none do.
    """
    marker = input.get("marker")
    manifest = input.get("manifest")
    if marker is not None:
        resolved: Discovery = {
            "comprehendo": marker["comprehendo"],
            "level": marker["level"],
            "surfaces": marker["surfaces"],
            "source": "marker",
        }
        return freeze(resolved)
    if manifest is not None:
        from_manifest: Discovery = {
            "comprehendo": manifest["version"],
            "level": manifest["level"],
            "source": "manifest",
        }
        return freeze(from_manifest)
    return None
