"""Marker and probe: how any value from a Comprehendo-speaking package tells
the agent holding it that it understands more than its plain type suggests.

Discovery channel one of four (the other three are the manifest, the package's
COMPREHENDO.md, and the twin's own `comprehendo` field): the marker rides on
the provider's root export, on every raised error, and on controlled handles,
so the failure the agent is already looking at is a discovery moment.

In Python the marker is a dunder attribute, the counterpart of JavaScript's
`Symbol.for('comprehendo')`, and the probe is the idiom every Python developer
already has in their fingers::

    if hasattr(exc, "__comprehendo__"):
        ...

Two cross-cutting contracts land in this file:

CC9, marker freeze. The attribute name has exactly one definition site, here
(the constant below). Every other module in every tier imports it. It is never
assembled at run time and never re-exported under a second name; at run time an
assembled name and a literal one reach the identical attribute, so a source
scan is the only thing that can tell them apart.

CC1, probe purity. Probing does no I/O, mutates nothing, and allocates nothing:
it is one attribute read handing back the entry the provider attached. This
module imports only typing and the freeze primitive, so there is no transitive
path in which that could stop being true.

@see .mdd/docs/11-marker-probe.md
@see .mdd/docs/07-cc1-probe-purity.md
@see .mdd/docs/10-cc9-marker-freeze.md
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict, TypeVar

from ._frozen import freeze

__all__ = [
    "MARKER_ATTR",
    "ComprehendoEntry",
    "ComprehendoLevel",
    "ComprehendoSurface",
    "attach_marker",
    "has_marker",
    "probe",
]

#: THE definition site. Frozen literal, one per implementation (CC9). Import
#: this constant, never write the name again, never compute it.
MARKER_ATTR = "__comprehendo__"

#: The callable surfaces a provider offers. Twins are unconditional, so they
#: are not listed.
ComprehendoSurface = Literal["docs", "validate", "explain", "comprehend"]

#: Conformance level: 1 is twins plus docs plus identity, 2 adds validate and
#: explain.
ComprehendoLevel = Literal[1, 2]

T = TypeVar("T")


class ComprehendoEntry(TypedDict):
    """What a successful probe hands back: the entry's data fields, exactly the
    set `entry.schema.json` requires.

    In each ecosystem the same object also travels with the provider's callable
    surfaces, which no JSON Schema can describe; in Python those live on the
    provider object itself rather than on the entry mapping.
    """

    #: The spec version this provider implements, e.g. "0.1".
    comprehendo: str
    #: The provider's own name.
    name: str
    #: The conformance level actually achieved, never aspirational.
    level: ComprehendoLevel
    #: The callable surfaces that exist. A provider that cannot judge omits
    #: `validate`.
    surfaces: list[ComprehendoSurface]
    #: What the tool is, the completeness contract, and the pointer, in order.
    identity: str
    #: The adoption snippet, under 150 tokens.
    priming: str


def _is_entry(candidate: Any) -> bool:
    """A structural guard, not schema validation (that is the conformance
    kit's job): it keeps `probe` from handing back whatever happens to occupy
    the marker attribute on a value that never spoke the protocol.
    """
    if not isinstance(candidate, dict):
        return False
    return (
        isinstance(candidate.get("comprehendo"), str)
        and isinstance(candidate.get("name"), str)
        and candidate.get("level") in (1, 2)
        and not isinstance(candidate.get("level"), bool)
        and isinstance(candidate.get("surfaces"), list)
        and isinstance(candidate.get("identity"), str)
        and isinstance(candidate.get("priming"), str)
    )


def attach_marker(target: T, entry: ComprehendoEntry) -> T:
    """Attach the marker to a provider's root export, to an error about to be
    raised, or to a controlled handle.

    Attachment happens at construction or raise time, never lazily on first
    access: presence is decided once and cannot vary between probes.

    The entry (and its `surfaces` list) is frozen here, so the claim a value
    makes about itself cannot be edited afterwards by anything holding it.

    Idempotent for an equal entry. Attaching a DIFFERENT entry to an already
    marked value raises: a value whose marker could change is a value whose
    probe result is non-deterministic, which is the failure this component
    exists to rule out.

    :returns: the same object, now carrying the marker. Never a copy.
    """
    if not _is_entry(entry):
        # A type annotation does not stop a caller from passing a value that is
        # only CLAIMED to be a ComprehendoEntry (parsed JSON, a hand-built dict
        # with a typo'd field). Without this check, attach_marker would install
        # it anyway, and probe()/has_marker() would then silently report "no
        # marker" on that exact object: an attach that appeared to succeed but
        # is invisible to the only way anyone reads it back. Fail loudly at the
        # write instead of going quiet at every future read.
        raise TypeError(
            "comprehendo: attach_marker() was given a value that is not a valid "
            "ComprehendoEntry (needs comprehendo, name, level (1 or 2), surfaces[], "
            "identity, priming as strings/list). Attaching it would make probe() "
            "and has_marker() silently report no marker on this exact value."
        )

    existing = probe(target)
    if existing is not None:
        if existing != entry:
            raise TypeError(
                "comprehendo: this value already carries a different Comprehendo entry. "
                "The marker is attached once, at construction or raise time."
            )
        return target

    try:
        setattr(target, MARKER_ATTR, freeze(entry))
    except AttributeError as cause:
        raise TypeError(
            f"comprehendo: {type(target).__name__} cannot carry the marker "
            "(it takes no attributes), so nothing holding this value could ever "
            "discover that it speaks the protocol. Mark the object the caller "
            "actually receives."
        ) from cause

    return target


def probe(value: Any) -> ComprehendoEntry | None:
    """Probe any value for the marker: an export, a caught error, a handle.

    One attribute read, no I/O, no mutation, no allocation, and it never
    raises, whatever it is handed (a booby-trapped ``__getattr__`` answers "no
    marker", which is the honest answer for a value whose claim cannot be
    read).

    :returns: the entry the provider attached, or ``None`` for anything else.
    """
    try:
        carried = getattr(value, MARKER_ATTR, None)
    except Exception:  # noqa: BLE001, a claim that cannot be read is no claim
        return None

    return carried if _is_entry(carried) else None


def has_marker(value: Any) -> bool:
    """The one-line form of :func:`probe` for callers that only need to branch:
    does this value speak Comprehendo. Same single attribute read, same purity.
    """
    return probe(value) is not None
