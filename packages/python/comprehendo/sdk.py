"""SDK Entry [14]: `make_provider(corpus, hooks)`, the one call a package
maintainer makes.

This module composes the three pieces into the object a package exports:
Marker & Probe [11] for discovery, Twin Builder [12] for the raise sites, Docs
Engine [13] for `docs()`. It owns no protocol behavior of its own; what it owns
is the WIRING, and two decisions that can only be made here:

1. The conformance level is COMPUTED from what `hooks` actually provided, never
   declared by the maintainer. A provider that cannot judge without executing
   omits `validate` entirely, so `hasattr(provider, "validate")` is False
   rather than a stub that always answers valid (RFC section 3).
2. The marker attached to the provider's export, to its raised errors, and to
   its controlled handles is ONE frozen entry object, so probing any value a
   package hands out answers with the same claim. This closes the integration
   point 12 leaves open: `attach_twin`'s `probe_value` defaults to a bare
   ``True``, which `probe()` reads back as "no marker"; here it gets the real
   entry.

@see .mdd/docs/14-sdk-entry.md
"""

from __future__ import annotations

from typing import Any, Callable, Literal, NotRequired, Protocol, TypedDict, TypeVar

from ._frozen import freeze
from .docs import DocsOptions, DocsSurface, PackedCorpus, create_docs, parse_packed_corpus
from .marker import ComprehendoEntry, ComprehendoLevel, ComprehendoSurface, attach_marker
from .twin import (
    SPEC_VERSION,
    ComprehendoError,
    ProviderCatalog,
    Twin,
    TwinBuilder,
    TwinContext,
    attach_twin,
    create_twin_builder,
    unstructured_twin,
)

__all__ = [
    "ExplainHook",
    "Explanation",
    "ManifestDeclaration",
    "Provider",
    "ProviderHooks",
    "TwinResolution",
    "TwinResolver",
    "Unvalidatable",
    "ValidateHook",
    "Validation",
    "ValidationVerdict",
    "make_provider",
]

T = TypeVar("T")


class ManifestDeclaration(TypedDict):
    """The provider-side manifest declaration (manifest.schema.json). Computed,
    never hand-set."""

    version: str
    level: ComprehendoLevel


class TwinResolution(TypedDict):
    """What a resolver says about a raw failure: which cataloged code it is, and
    the raise site's own detail."""

    code: str
    context: NotRequired[TwinContext]


#: One declared raise site: raw failure in, cataloged code out, ``None`` for
#: "not mine".
TwinResolver = Callable[[Any], TwinResolution | None]


class Unvalidatable(TypedDict):
    """The honest abstention (unvalidatable.schema.json): `valid` is None,
    never a boolean."""

    valid: None
    code: Literal["UNVALIDATABLE"]
    reason: str


class Explanation(TypedDict):
    """What `explain(input)` returns (explanation.schema.json)."""

    would_execute: Any
    notes: NotRequired[list[str]]


#: What `validate(input)` returns: clean, a cataloged twin, or an abstention.
Validation = Any
#: What a `validate` hook hands back, before this SDK shapes it into a
#: Validation: ``{"valid": True}``, ``{"code", "context"?}``, or
#: ``{"unvalidatable": reason}``.
ValidationVerdict = Any
ValidateHook = Callable[[Any], ValidationVerdict]
ExplainHook = Callable[[Any], Explanation]


class ProviderHooks(TypedDict):
    """Everything the provider knows that the packed corpus cannot carry."""

    #: The cataloged failures, the declared call surface, the topics a fix may
    #: point at.
    catalog: ProviderCatalog
    #: What the tool is, its completeness contract, its pointer (RFC 5.5).
    identity: str
    #: The declared raise sites, in order. First claimant wins; none means
    #: UNSTRUCTURED.
    twin_resolvers: list[TwinResolver]
    #: The adoption snippet an agent is primed with (RFC 5.5), under CC5's
    #: 150-token cap. Required, and deliberately NOT defaulted here: shipping
    #: the canonical snippet is Priming Snippet [36]'s job.
    priming: str
    #: Defaults to the packed corpus's own `provider` name.
    name: NotRequired[str]
    #: Judge without executing. Omit it when you cannot; never stub it.
    validate: NotRequired[ValidateHook]
    #: Show what would run, without running it. Omit it when you cannot.
    explain: NotRequired[ExplainHook]
    #: Passed through to the docs engine (log path, sink, clock).
    docs: NotRequired[DocsOptions]


class Provider(Protocol):
    """The object a package exports. Level 1 always; `validate`/`explain` only
    at Level 2."""

    name: str
    comprehendo: str
    level: ComprehendoLevel
    surfaces: list[ComprehendoSurface]
    entry: ComprehendoEntry
    manifest: ManifestDeclaration
    docs: DocsSurface
    twins: TwinBuilder

    def twin_for(self, raw: Any, context: TwinContext | None = None) -> Twin: ...

    def error_for(self, raw: Any, context: TwinContext | None = None) -> ComprehendoError: ...

    def raise_(self, raw: Any, context: TwinContext | None = None) -> Any: ...

    def mark(self, target: T) -> T: ...

    #: Present only at Level 2, when `hooks` supplied the logic. Declared here
    #: so a caller gets types for them; presence is checked with `hasattr`,
    #: never assumed, because a provider that cannot judge without executing
    #: omits `validate` entirely rather than stubbing it (RFC section 3).
    validate: ValidateHook
    explain: ExplainHook


#: The clean verdict, one frozen instance: nothing about it varies per call.
_CLEAN: Validation = freeze({"valid": True})


def _require_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or value.strip() == "":
        raise TypeError(
            f"comprehendo: make_provider() needs a non-empty {field}. An entry without "
            "one is an entry no agent can orient from, and the marker would carry it anyway."
        )
    return value


def _merge_context(
    derived: TwinContext | None, given: TwinContext | None
) -> TwinContext | None:
    """The raise site's own detail wins over what the resolver derived."""
    if derived is None and given is None:
        return None
    merged: dict[str, Any] = {**(derived or {}), **(given or {})}
    return merged  # type: ignore[return-value]


# A verdict type is a static claim: nothing at run time stops a `validate` hook
# from returning ``None`` (a missing return in one branch is a plausible
# authoring bug) or a primitive. Without this guard, the membership tests below
# would raise their own unexplained TypeError before the crafted, explanatory
# one ever fired, for exactly the malformed-hook case that message exists for.
def _is_verdict_like(value: Any) -> bool:
    return isinstance(value, dict)


def _build_entry(packed: PackedCorpus, hooks: ProviderHooks) -> ComprehendoEntry:
    """The entry a provider's values will claim, computed from what `hooks`
    actually provided.

    The level is a claim about the whole Level 2 SET, so it takes both judge
    hooks; `surfaces` is a statement of what exists, so it takes each on its
    own.
    """
    surfaces: list[ComprehendoSurface] = ["docs"]
    if "validate" in hooks:
        surfaces.append("validate")
    if "explain" in hooks:
        surfaces.append("explain")
    entry: ComprehendoEntry = {
        "comprehendo": SPEC_VERSION,
        "name": _require_text(hooks.get("name", packed["provider"]), "name"),
        "level": 2 if "validate" in hooks and "explain" in hooks else 1,
        "surfaces": surfaces,
        "identity": _require_text(hooks.get("identity"), "identity"),
        "priming": _require_text(hooks.get("priming"), "priming"),
    }
    return freeze(entry)


def _twin_site(
    twins: TwinBuilder, resolvers: list[TwinResolver]
) -> Callable[[Any, TwinContext | None], Twin]:
    """The declared raise sites, in order: first claimant wins, none means
    UNSTRUCTURED."""

    def at_site(raw: Any, context: TwinContext | None = None) -> Twin:
        for resolve in resolvers:
            resolution = resolve(raw)
            if resolution is not None:
                return twins.build(
                    resolution["code"], _merge_context(resolution.get("context"), context)
                )
        # No declared raise site claims it: the honest wrapper, raw preserved.
        return unstructured_twin(raw)

    return at_site


def _shape_verdict(twins: TwinBuilder, verdict: ValidationVerdict) -> Validation:
    """A hook's verdict, shaped into the response `validate(input)` owes."""
    if _is_verdict_like(verdict) and verdict.get("valid") is True:
        return _CLEAN
    if _is_verdict_like(verdict) and isinstance(verdict.get("unvalidatable"), str):
        abstention: Unvalidatable = {
            "valid": None,
            "code": "UNVALIDATABLE",
            "reason": verdict["unvalidatable"],
        }
        return freeze(abstention)
    # A named code is built through the same catalog the raise sites use, so a
    # twin from `validate` is never hand-rolled and an unknown code fails
    # loudly instead of shipping a fix no gate ever checked.
    if _is_verdict_like(verdict) and isinstance(verdict.get("code"), str):
        return twins.build(verdict["code"], verdict.get("context"))
    raise TypeError(
        "comprehendo: the validate() hook returned a verdict this SDK cannot read. "
        'Return {"valid": True}, {"code", "context"?} naming a cataloged failure, or '
        '{"unvalidatable": reason}. Defaulting to valid is the one answer a judge '
        "must never guess."
    )


def _freeze_explanation(explanation: Explanation) -> Explanation:
    """Frozen, so an explanation cannot be edited after the caller has it."""
    if not _is_verdict_like(explanation):
        raise TypeError(
            "comprehendo: the explain() hook returned something other than a mapping. "
            'Return {"would_execute", "notes"?}: the literal form input would execute as.'
        )
    return freeze(explanation)


class _Provider:
    """The provider object, sealed once built: a provider either exists whole or
    does not exist."""

    def __init__(self, corpus: PackedCorpus, hooks: ProviderHooks) -> None:
        packed = parse_packed_corpus(corpus)
        twins = create_twin_builder(hooks["catalog"])
        entry = _build_entry(packed, hooks)
        at_site = _twin_site(twins, list(hooks["twin_resolvers"]))

        self.name = entry["name"]
        self.comprehendo = entry["comprehendo"]
        self.level = entry["level"]
        self.surfaces = entry["surfaces"]
        self.entry = entry
        manifest: ManifestDeclaration = {"version": SPEC_VERSION, "level": entry["level"]}
        self.manifest = freeze(manifest)
        self.docs = create_docs(packed, hooks.get("docs") or {})
        self.twins = twins
        self._at_site = at_site

        judge = hooks.get("validate")
        if judge is not None:
            self.validate = lambda value: _shape_verdict(twins, judge(value))
        explainer = hooks.get("explain")
        if explainer is not None:
            self.explain = lambda value: _freeze_explanation(explainer(value))

        attach_marker(self, entry)
        self._sealed = True

    def twin_for(self, raw: Any, context: TwinContext | None = None) -> Twin:
        return self._at_site(raw, context)

    def error_for(self, raw: Any, context: TwinContext | None = None) -> ComprehendoError:
        twin = self._at_site(raw, context)
        # The entry, not `True`: a bare boolean is what `probe()` reads back as
        # "no marker", so the caught error would answer the probe with nothing.
        return attach_twin(ComprehendoError(twin["reason"]), twin, self.entry)

    def raise_(self, raw: Any, context: TwinContext | None = None) -> Any:
        raise self.error_for(raw, context)

    def mark(self, target: T) -> T:
        return attach_marker(target, self.entry)

    def __setattr__(self, name: str, value: Any) -> None:
        if self.__dict__.get("_sealed"):
            raise TypeError(
                "comprehendo: a provider is frozen once built. Its surfaces are what a "
                "package published, and anything holding one is entitled to the claim it "
                "was handed."
            )
        object.__setattr__(self, name, value)

    def __delattr__(self, name: str) -> None:
        raise TypeError("comprehendo: a provider is frozen once built")


def make_provider(corpus: PackedCorpus, hooks: ProviderHooks) -> Provider:
    """Build a Comprehendo provider from a packed corpus and the hooks only the
    provider can supply.

    The returned object carries the marker, answers `docs()`, builds twins at
    its declared raise sites, and exposes `validate`/`explain` exactly when
    `hooks` supplied the logic for them.

    Everything that can be refused is refused here, at construction: an
    unreadable corpus, a catalog that violates CC3/CC7, a missing identity. A
    provider either exists whole or does not exist.
    """
    return _Provider(corpus, hooks)
