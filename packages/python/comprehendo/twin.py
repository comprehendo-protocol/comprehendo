"""Twin Builder [12]: the raise-site twin construction path.

Builds a twin from a cataloged failure, wraps a novel one as UNSTRUCTURED with
the raw error preserved in `received` (CC3 [08]), and validates every
`fixes[].apply` against the provider's declared call schema AT BUILD TIME, so
a fix that would escape the schema fails the build rather than being caught at
runtime, or not at all (CC7 [09]).

This module is the surface consumers import: the checks themselves live in
`twin_validate.py` and are re-exported here.
"""

from __future__ import annotations

from typing import Any, Protocol, TypeVar, cast

from ._frozen import freeze
from .marker import MARKER_ATTR
from .twin_validate import (
    UNSTRUCTURED_CODE,
    UNSTRUCTURED_REASON,
    CatalogEntry,
    Confidence,
    DeclaredCallSchema,
    Fix,
    ProviderCatalog,
    Twin,
    TwinCatalogError,
    TwinContext,
    Violation,
    ViolationReason,
    ViolationRule,
    apply_operations,
    audit_twin,
    raw_text_of,
    validate_catalog,
    violation,
)

__all__ = [
    "SPEC_VERSION",
    "UNSTRUCTURED_CODE",
    "UNSTRUCTURED_REASON",
    "CatalogEntry",
    "ComprehendoError",
    "Confidence",
    "DeclaredCallSchema",
    "Fix",
    "ProviderCatalog",
    "Twin",
    "TwinBuilder",
    "TwinCatalogError",
    "TwinContext",
    "Violation",
    "ViolationReason",
    "ViolationRule",
    "apply_operations",
    "attach_twin",
    "audit_twin",
    "create_twin_builder",
    "raw_text_of",
    "unstructured_twin",
    "validate_catalog",
    "violation",
]

#: The spec version this build implements, carried on every twin.
SPEC_VERSION = "0.1"

E = TypeVar("E", bound=BaseException)

#: The twin's field order, which IS its serialization order (CC2 [01]): a twin
#: built here and the kit's own fixture must be byte-identical, so the optional
#: fields are written in exactly this sequence and an absent one is absent, not
#: an explicit null.
_OPTIONAL_FIELDS = ("path", "namespace", "declared", "received", "accepts")


class ComprehendoError(Exception):
    """The documented surface: `err.twin` on a raised error.

    A real exception type rather than a bare `Exception` with an attribute
    bolted on, because Python has no structural `Error & {twin}` the way
    TypeScript does, and an agent's `except` clause deserves something it can
    name. `attach_twin` still marks ANY exception a provider is about to
    raise, so a provider that raises its own domain exception keeps its type
    and still answers `err.twin` and the probe.
    """

    twin: Twin


class TwinBuilder(Protocol):
    """What a provider's catalog hands its raise sites."""

    @property
    def codes(self) -> list[str]: ...

    def has(self, code: str) -> bool: ...

    def build(self, code: str, context: TwinContext | None = None) -> Twin: ...

    def twin_for(
        self, code: str | None, raw: Any = None, context: TwinContext | None = None
    ) -> Twin: ...

    def error_for(
        self, code: str | None, raw: Any = None, context: TwinContext | None = None
    ) -> ComprehendoError: ...


def _received_of(raw: Any) -> Any:
    """What goes into `received`: the raw text when there is one, otherwise the
    raw value unchanged. Never a stringified stand-in, the raw error is
    preserved, never paraphrased away (CC3 [08])."""
    text = raw_text_of(raw)
    return raw if text is None else text


def _first_present(*candidates: Any) -> Any:
    """The first candidate that is neither the absent sentinel NOR ``None``, or
    the sentinel. Mirrors `packages/core/src/twin.ts`'s `??` chain
    (`context?.field ?? entry.field ?? ...`) exactly: JavaScript's nullish
    -coalescing falls through on BOTH `undefined` and an explicit `null`, so
    an explicit `None` here must fall through too, not be treated as a real
    value. Found by review: treating `None` as present broke the
    byte-identical guarantee (CC2 [01]) for `context={"received": None}` on
    an entry with no `received`, TS correctly omits the field, this used to
    write `"received": null`."""
    for candidate in candidates:
        if candidate is not _ABSENT and candidate is not None:
            return candidate
    return _ABSENT


class _Absent:
    """The "no value at all" sentinel, distinct from Python's ``None`` (which
    `_first_present` treats as equivalent to absent, matching JavaScript's
    `??`, see there)."""

    def __repr__(self) -> str:  # pragma: no cover, debugging aid only
        return "<absent>"


_ABSENT = _Absent()


def unstructured_twin(raw: Any) -> Twin:
    """The honest wrapper for a failure the corpus has no entry for: the raw
    error preserved verbatim in `received`, a fixed reason that states the
    situation, and no fix guessed at (CC3 [08], RFC 5.1.4)."""
    twin: Twin = {
        "comprehendo": SPEC_VERSION,
        "code": UNSTRUCTURED_CODE,
        "reason": UNSTRUCTURED_REASON,
        "received": _received_of(raw),
        "fixes": [],
    }
    return freeze(twin)


def attach_twin(error: E, twin: Twin, probe_value: Any = True) -> E:
    """Attach a twin and the marker to an error the provider is about to raise.

    `probe_value` is what a marker probe reads back; it defaults to ``True``
    (presence is the contract this module owns) and takes the provider's own
    entry when SDK Entry [14] has one.
    """
    setattr(error, "twin", twin)
    setattr(error, MARKER_ATTR, probe_value)
    return error


def _build_twin(entry: CatalogEntry, context: TwinContext | None, raw: Any) -> Twin:
    """One cataloged failure plus what the raise site knows, in kit key order."""
    context = context or {}
    twin: dict[str, Any] = {
        "comprehendo": SPEC_VERSION,
        "code": entry["code"],
        "reason": entry["reason"],
    }
    for field in _OPTIONAL_FIELDS:
        value = _first_present(
            context.get(field, _ABSENT),
            entry.get(field, _ABSENT),
            _received_of(raw) if field == "received" and raw is not None else _ABSENT,
        )
        if value is not _ABSENT:
            twin[field] = value
    twin["fixes"] = entry["fixes"]
    return freeze(cast(Twin, twin))


class _Builder:
    """The provider's twin builder. Construction IS the gate: the whole catalog
    is validated once, here, and a catalog with any violation raises instead of
    returning a builder. Nothing re-validates per raise."""

    __slots__ = ("_entries",)

    def __init__(self, catalog: ProviderCatalog) -> None:
        violations = validate_catalog(catalog)
        if violations:
            raise TwinCatalogError(list(violations))
        # Author order is the corpus author's ordering decision,
        # most-likely-first; this builder never re-sorts fixes, it only carries
        # them.
        self._entries: dict[str, CatalogEntry] = {
            entry["code"]: entry for entry in catalog["entries"]
        }

    @property
    def codes(self) -> list[str]:
        return freeze(list(self._entries))

    def has(self, code: str) -> bool:
        return code in self._entries

    def build(self, code: str, context: TwinContext | None = None) -> Twin:
        return self._build(code, context, None)

    def _build(self, code: str, context: TwinContext | None, raw: Any) -> Twin:
        entry = self._entries.get(code)
        if entry is None:
            raise TwinCatalogError(
                [
                    violation(
                        "CATALOG",
                        "unknown-code",
                        f"build({code})",
                        f"{code} is not in this provider's catalog; an un-cataloged failure "
                        f"goes through twin_for, which wraps it as {UNSTRUCTURED_CODE}",
                    )
                ]
            )
        return _build_twin(entry, context, raw)

    def twin_for(
        self, code: str | None, raw: Any = None, context: TwinContext | None = None
    ) -> Twin:
        if code is not None and code in self._entries:
            return self._build(code, context, raw)
        return unstructured_twin(raw)

    def error_for(
        self, code: str | None, raw: Any = None, context: TwinContext | None = None
    ) -> ComprehendoError:
        twin = self.twin_for(code, raw, context)
        # The message is the twin's reason, never the raw text (CC3 [08]):
        # `str(err)` is the first thing anything prints.
        return attach_twin(ComprehendoError(twin["reason"]), twin)

    def __setattr__(self, name: str, value: Any) -> None:
        if name in getattr(self, "__slots__", ()) and not hasattr(self, name):
            object.__setattr__(self, name, value)
            return
        raise TypeError(
            "comprehendo: a twin builder is frozen once its catalog has passed the gate"
        )


def create_twin_builder(catalog: ProviderCatalog) -> TwinBuilder:
    """Build the provider's twin builder, or raise `TwinCatalogError`.

    A catalog that violates CC3 [08] or CC7 [09] never produces a builder,
    which is what makes both contracts build-time gates rather than runtime
    checks.
    """
    return _Builder(catalog)
