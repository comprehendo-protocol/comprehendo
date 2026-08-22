"""Manifest Wiring [15], the declaration itself: what a provider-side claim is,
and the projection every read applies to it.

Split out of `config.py` so the two manifest formats (`package.json` here in
`config.py`, `[tool.comprehendo]` in `pyproject.py`) can both depend on ONE
definition of the declaration without depending on each other.

CC8 [19] lives in this file, structurally: the declaration is exactly
`{version, level}` (:data:`MANIFEST_FIELDS`) and :func:`project` is the only way
a value becomes one, so whatever else rode along under the manifest key comes
out as those two fields and nothing else. A provider cannot express "do not use
a registry corpus for my package": there is no field for it and nothing to
carry one through.

CC9 [10]: the two manifest key names have one definition site each, here.

@see .mdd/docs/15-manifest-wiring.md
@see .mdd/docs/19-cc8-native-precedence.md
"""

from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

from ._frozen import freeze
from .marker import ComprehendoEntry
from .sdk import ManifestDeclaration

__all__ = [
    "MANIFEST_FIELDS",
    "MANIFEST_KEY",
    "PYPROJECT_TABLE",
    "ManifestDeclaration",
    "ManifestError",
    "ManifestReading",
    "assert_declaration",
    "declaration_for",
    "describe",
    "parse_declaration",
    "project",
]

#: THE package.json key. Frozen literal, one definition site (CC9 [10]).
MANIFEST_KEY = "comprehendo"

#: THE pyproject.toml table. Frozen literal, one definition site (CC9 [10]).
PYPROJECT_TABLE = "tool.comprehendo"

#: Exactly the fields a provider-side declaration carries
#: (manifest.schema.json), and the projection every read applies. A third field
#: is a CC8 [19] decision, not an implementation detail.
MANIFEST_FIELDS: tuple[str, ...] = ("version", "level")


class ManifestReading(TypedDict):
    """What a manifest read found. Three states, not two: "makes no claim" and
    "makes a claim I could not read" are different answers, and conflating them
    turns a broken manifest into a silent "does not speak Comprehendo"."""

    status: Literal["absent", "declared", "unreadable"]
    declaration: NotRequired[ManifestDeclaration]
    reason: NotRequired[str]


class ManifestError(Exception):
    """Raised when a manifest cannot be WRITTEN (a declaration that would not
    validate, host text that is not the format it claims to be), or when there
    is no manifest FILE at all (unknown file name, unreadable path).

    What a manifest SAYS never raises, it is reported (see
    :class:`ManifestReading`).
    """


def describe(value: Any) -> str:
    """What a value is, for an error message, without printing the value itself.

    A malformed manifest is still someone's file, and its contents do not
    belong in a diagnostic.
    """
    if value is None:
        return "None"
    if isinstance(value, bool):
        return "a bool"
    if isinstance(value, list):
        return "a list"
    if isinstance(value, dict):
        return "a mapping"
    return f"a {type(value).__name__}"


def declaration_problem(value: Any) -> str | None:
    """Why this value is not a declaration (naming the field), or None."""

    def bad(what: str, got: Any) -> str:
        return f'the "{MANIFEST_KEY}" declaration {what}, got {describe(got)}'

    if not isinstance(value, dict):
        return bad("must be an object", value)
    version = value.get("version")
    level = value.get("level")
    if not isinstance(version, str) or version.strip() == "":
        return bad("needs a non-empty string version", version)
    if isinstance(level, bool) or level not in (1, 2):
        return bad("needs level 1 or 2 as an integer", level)
    return None


def project(value: dict[str, Any]) -> ManifestDeclaration:
    """The projection CC8 [19] rests on: whatever else rode along under the
    manifest key (RFC 10.6's endorsement keys, the consumer's knobs, a field a
    provider invented), out comes these two fields and nothing else."""
    declaration: ManifestDeclaration = {"version": value["version"], "level": value["level"]}
    return freeze(declaration)


def assert_declaration(declaration: Any) -> ManifestDeclaration:
    """A declaration this component is about to WRITE, refused loudly when
    malformed."""
    problem = declaration_problem(declaration)
    if problem is not None:
        raise ManifestError(f"comprehendo: refusing to stamp a manifest, {problem}")
    return project(declaration)


def declaration_for(entry: ComprehendoEntry) -> ManifestDeclaration:
    """The declaration a provider stamps, read off the entry its own values
    carry.

    Never hand-set: the level is the one the runtime actually reached (SDK
    Entry [14] computes it), so a manifest can only overclaim by drifting.
    """
    return assert_declaration({"version": entry["comprehendo"], "level": entry["level"]})


def parse_declaration(value: Any) -> ManifestReading:
    """Read the value found AT the manifest key (or the pyproject table).

    Both callers (`config.py`'s `read_package_json`, `pyproject.py`'s
    `read_pyproject`) already handle the TRUE "key is not present at all"
    case before ever calling this function, so by the time `value` arrives
    here it is never a stand-in for "absent". Found by review: this used to
    treat Python's `None` as that absent signal, which conflated it with a
    manifest key holding an explicit JSON `null` (`{"comprehendo": null}`
    parses to `None` in Python too), reporting `status: "absent"` (no
    claim) about a package whose OWN manifest is broken (should be
    `status: "unreadable"`), mirroring `packages/core/src/config.ts`'s
    `parseDeclaration`, which only treats JavaScript's `undefined` (the
    real "key never existed" value) as absent and lets a `null` fall
    through to `declarationProblem`. `declaration_problem(None)` already
    reports "must be an object", so no special case is needed here at all.
    """
    problem = declaration_problem(value)
    if problem is not None:
        return {"status": "unreadable", "reason": problem}
    return {"status": "declared", "declaration": project(value)}
