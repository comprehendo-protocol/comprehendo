"""Twin Builder [12], the gate half: the pure build-time checks CC3 [08] and
CC7 [09] are made of, kept out of the construction path in `twin.py` because
they are the testable part and because one file does one job.

Nothing here allocates a twin or touches an error. Every function is a pure
value-to-violations transform, which is what lets the conformance kit run the
SAME code the builder runs, so what CI checks and what a build enforces cannot
drift apart. `twin.py` re-exports all of it, so consumers import one module.

The `apply` grammar is LITERAL call data, shaped exactly like the provider's
own call surface, and the rule is the one the conformance kit already encodes:
every top-level operator key used in an `apply` must be a member of the
declared call schema's operations.
"""

from __future__ import annotations

from typing import Any, Literal, TypedDict

from ._frozen import freeze
from .shapes import (
    CatalogEntry,
    Confidence,
    DeclaredCallSchema,
    Fix,
    ProviderCatalog,
    Twin,
    TwinContext,
)

__all__ = [
    "UNSTRUCTURED_CODE",
    "UNSTRUCTURED_REASON",
    "CatalogEntry",
    "Confidence",
    "DeclaredCallSchema",
    "Fix",
    "ProviderCatalog",
    "Twin",
    "TwinCatalogError",
    "TwinContext",
    "Violation",
    "ViolationReason",
    "ViolationRule",
    "apply_operations",
    "audit_twin",
    "raw_text_of",
    "validate_catalog",
    "violation",
]

#: The code reserved for a failure the corpus has no entry for (RFC 5.1.4).
UNSTRUCTURED_CODE = "UNSTRUCTURED"

#: The reason an UNSTRUCTURED twin carries. Fixed text on purpose: the raw
#: error is never the primary message (CC3 [08]), and this sentence is what the
#: kit's twin-round-trip fixture asserts verbatim.
UNSTRUCTURED_REASON = (
    "This failure is not yet in the corpus; the underlying message is preserved "
    "verbatim in received, and no fix is being guessed at."
)

ViolationRule = Literal["CC3", "CC7", "CATALOG"]
ViolationReason = Literal[
    "schema-escaping-fix",
    "unvalidatable-apply",
    "empty-apply",
    "fix-without-remedy",
    "fix-without-title",
    "dangling-docs-pointer",
    "empty-fixes",
    "empty-reason",
    "reserved-code",
    "duplicate-code",
    "unknown-code",
    "raw-error-leak",
    "raw-error-discarded",
]


class Violation(TypedDict):
    """One way a catalog fails a contract, as data."""

    rule: ViolationRule
    reason: ViolationReason
    locator: str
    message: str


class TwinCatalogError(Exception):
    """A provider catalog that does not conform. Raised at builder
    construction, which is what makes the check a BUILD-time gate: a provider
    carrying a schema-escaping fix never gets a builder, so it never ships one.

    Deliberately a plain exception rather than a twinned one: this is a
    developer error about the provider's own corpus, not a failure surfaced to
    an agent, and a twin here would need a `code` vocabulary that belongs to
    the provider, not to this shared builder.
    """

    def __init__(self, violations: list[Violation]) -> None:
        detail = "\n".join(
            f"  {item['rule']} {item['reason']} at {item['locator']}: {item['message']}"
            for item in violations
        )
        super().__init__(
            f"comprehendo: the provider catalog carries {len(violations)} "
            f"violation(s) and cannot ship:\n{detail}"
        )
        self.violations: list[Violation] = freeze(list(violations))


def violation(
    rule: ViolationRule, reason: ViolationReason, locator: str, message: str
) -> Violation:
    """One violation, frozen, so a reported finding cannot be edited."""
    found: Violation = {"rule": rule, "reason": reason, "locator": locator, "message": message}
    return freeze(found)


def _is_record(value: Any) -> bool:
    return isinstance(value, dict)


def raw_text_of(raw: Any) -> str | None:
    """The raw error as text, when the raw value carries any."""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, BaseException):
        return str(raw)
    if _is_record(raw) and isinstance(raw.get("message"), str):
        message: str = raw["message"]
        return message
    return None


def apply_operations(apply: Any) -> list[str] | None:
    """The top-level operator keys an `apply` expresses, or ``None`` when the
    `apply` is not structured call data at all.

    Top-level only: ``{"$match": {"created_at": {"$gte": x}}}`` expresses
    `$match`, and `$gte` is operand data inside it, not a second operation.
    ``None`` is not "no operations", it is "this cannot be checked", which the
    caller turns into a violation: an opaque string is exactly how corpus text
    would become a command channel.
    """
    if isinstance(apply, list):
        operations: list[str] = []
        for call in apply:
            if not _is_record(call):
                return None
            operations.extend(call.keys())
        return operations
    if _is_record(apply):
        return list(apply.keys())
    return None


def _collect_nested_operations(
    record: dict[str, Any], nesting_keys: frozenset[str], operations: list[str]
) -> None:
    """Recurse into a call/stage record's own values looking for a NESTED
    pipeline, but only under a key the schema explicitly names in
    `nested_pipeline_operations`.

    A stage nested there ($facet's per-branch arrays, $lookup/$unionWith's
    `pipeline`) is just as capable of expressing a write as a top-level one, so
    its keys count too. Every other nested value, named or not, is left alone:
    operand data ($match's filter document) is never scanned for keys, because
    nothing declares it as a nesting operation.
    """
    for key, value in record.items():
        if key not in nesting_keys:
            continue
        _collect_pipeline_like(value, nesting_keys, operations)


def _collect_pipeline_like(
    value: Any, nesting_keys: frozenset[str], operations: list[str]
) -> None:
    """A value that might itself be a pipeline (a list of stages) or a mapping
    of them ($facet's per-branch shape); collects operator keys from either."""
    if isinstance(value, list):
        for item in value:
            if not _is_record(item):
                continue
            operations.extend(item.keys())
            _collect_nested_operations(item, nesting_keys, operations)
        return
    if _is_record(value):
        # $facet-shaped: a mapping whose OWN values are pipelines, not a stage
        # itself, so its keys (the branch names) are never collected as
        # operations, only recursed through.
        for branch in value.values():
            _collect_pipeline_like(branch, nesting_keys, operations)


def _validate_apply(apply: Any, schema: DeclaredCallSchema, at: str) -> list[Violation]:
    """One fix's `apply`, against the provider's declared call schema (CC7 [09])."""
    operations = apply_operations(apply)
    if operations is None:
        return [
            violation(
                "CC7",
                "unvalidatable-apply",
                f"{at}.apply",
                f"the fix at {at} expresses its apply as something other than literal "
                f"call data for {schema['surface']}, so it cannot be checked against "
                "the declared schema at all",
            )
        ]
    if not operations:
        return [
            violation(
                "CC7",
                "empty-apply",
                f"{at}.apply",
                f"the fix at {at} expresses no operation, so there is nothing for an "
                "agent to apply",
            )
        ]

    nesting_keys = frozenset(schema.get("nested_pipeline_operations") or ())
    all_operations = list(operations)
    if nesting_keys:
        calls = apply if isinstance(apply, list) else [apply]
        for call in calls:
            if _is_record(call):
                _collect_nested_operations(call, nesting_keys, all_operations)

    declared = schema["operations"]
    return [
        violation(
            "CC7",
            "schema-escaping-fix",
            f"{at}.apply",
            f"the fix at {at} expresses {operation}, an operation the provider never "
            f"declared: {schema['surface']} declares only {', '.join(declared)}",
        )
        for operation in all_operations
        if operation not in declared
    ]


def _validate_fix(
    fix: Fix, schema: DeclaredCallSchema, topics: list[str], at: str
) -> list[Violation]:
    """One fix against the declared call schema and the corpus index (CC7 [09])."""
    found: list[Violation] = []
    if fix["title"].strip() == "":
        found.append(violation("CATALOG", "fix-without-title", f"{at}.title", "a fix owes a title"))
    if "apply" not in fix and "docs" not in fix:
        found.append(
            violation(
                "CC7",
                "fix-without-remedy",
                at,
                f"the fix at {at} carries neither apply nor docs, so it remedies nothing",
            )
        )
    if "apply" in fix:
        found.extend(_validate_apply(fix["apply"], schema, at))
    if "docs" in fix and fix["docs"] not in topics:
        found.append(
            violation(
                "CC7",
                "dangling-docs-pointer",
                f"{at}.docs",
                f'the fix at {at} points at the topic "{fix["docs"]}", which the corpus '
                "index does not carry",
            )
        )
    return found


def validate_catalog(catalog: ProviderCatalog) -> list[Violation]:
    """Every way this catalog fails the contracts, as data.

    The builder runs this once at construction and refuses to exist if it
    returns anything, which is what "fails the build, not a runtime check"
    means here.
    """
    found: list[Violation] = []
    seen: set[str] = set()
    for index, entry in enumerate(catalog["entries"]):
        at = f"entries[{index}]"
        if entry["code"] == UNSTRUCTURED_CODE:
            found.append(
                violation(
                    "CC3",
                    "reserved-code",
                    f"{at}.code",
                    f"{UNSTRUCTURED_CODE} is reserved for a failure the corpus has no "
                    "entry for; a cataloged failure owes its own code",
                )
            )
        if entry["code"] in seen:
            found.append(
                violation(
                    "CATALOG",
                    "duplicate-code",
                    f"{at}.code",
                    f"the code {entry['code']} is cataloged twice, and a published code "
                    "means exactly one thing",
                )
            )
        seen.add(entry["code"])
        if entry["reason"].strip() == "":
            found.append(
                violation(
                    "CATALOG",
                    "empty-reason",
                    f"{at}.reason",
                    f"the cataloged failure {entry['code']} carries no reason, and a twin "
                    "owes a self-sufficient explanation",
                )
            )
        # CC3 [08], at catalog time: an author who pastes the driver's raw text
        # straight into `reason` (rather than leaving it in `received`, where
        # this contract puts it) ships the exact leak this component exists to
        # catch, and it MUST fail here, not only when audit_twin() is run by
        # hand against a constructed Twin. See audit_twin()'s matching check.
        raw_text = raw_text_of(entry.get("received"))
        if raw_text not in (None, "") and raw_text in entry["reason"]:
            found.append(
                violation(
                    "CC3",
                    "raw-error-leak",
                    f"{at}.reason",
                    f"the cataloged failure {entry['code']} surfaces its own received text "
                    "inside reason; the raw text belongs in received, verbatim, and is "
                    "never the primary answer",
                )
            )
        if not entry["fixes"]:
            found.append(
                violation(
                    "CC3",
                    "empty-fixes",
                    f"{at}.fixes",
                    f"the cataloged failure {entry['code']} carries no fix, and a cataloged "
                    "failure owes at least one",
                )
            )
        for fix_index, fix in enumerate(entry["fixes"]):
            found.extend(
                _validate_fix(
                    fix, catalog["declared_schema"], catalog["topics"], f"{at}.fixes[{fix_index}]"
                )
            )
    return freeze(found)


def audit_twin(twin: Twin, raw: Any = None) -> list[Violation]:
    """The CC3 [08] audit: a twin must never hand back the raw error as its
    primary message, and must never drop it either.

    `raw` is the underlying text the provider actually received, when known.
    """
    found: list[Violation] = []
    raw_text = raw_text_of(raw)
    if raw_text not in (None, "") and raw_text in twin["reason"]:
        found.append(
            violation(
                "CC3",
                "raw-error-leak",
                "reason",
                "the twin surfaced the underlying raw error text as its primary reason; "
                "the raw text belongs in received, verbatim, and is never the answer",
            )
        )
    if twin["code"] == UNSTRUCTURED_CODE and "received" not in twin:
        found.append(
            violation(
                "CC3",
                "raw-error-discarded",
                "received",
                "an UNSTRUCTURED twin preserves the raw error in received; this one "
                "dropped it, leaving the agent blind",
            )
        )
    return freeze(found)
