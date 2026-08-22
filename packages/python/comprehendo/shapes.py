"""The wire shapes, as TypedDicts, one per schema in
`packages/spec/kit/shapes/` that the twin family uses.

CC2 [01] is the reason this file exists as its own module: every field name
here is the field name the JSON Schema declares, character for character, and
there is no translation layer in either direction. Reading this file beside
`kit/shapes/twin.schema.json` and `fix.schema.json` should be boring.

The provider-side authoring structures below (`DeclaredCallSchema`,
`CatalogEntry`, `ProviderCatalog`, `TwinContext`) are NOT wire shapes and are
not part of CC2's frozen set: they are spelled in Python's idiom, matching the
kit's own `declared_schema` spelling in
`kit/negative/schema-escaping-fix.json`.
"""

from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

__all__ = [
    "CatalogEntry",
    "Confidence",
    "DeclaredCallSchema",
    "Fix",
    "ProviderCatalog",
    "Twin",
    "TwinContext",
]

Confidence = Literal["high", "likely", "guess"]


class Fix(TypedDict):
    """One remedy on a twin (RFC 5.1.2). `apply` is literal provider call data."""

    title: str
    apply: NotRequired[Any]
    docs: NotRequired[str]
    confidence: NotRequired[Confidence]


class Twin(TypedDict):
    """The structured form every failure arrives in (RFC 5.1.1)."""

    comprehendo: str
    code: str
    reason: str
    path: NotRequired[str]
    namespace: NotRequired[str]
    declared: NotRequired[Any]
    received: NotRequired[Any]
    accepts: NotRequired[list[str]]
    fixes: list[Fix]


class DeclaredCallSchema(TypedDict):
    """The provider's own already-shipped call surface: what an `apply` is
    allowed to express.

    `operations` is the exact vocabulary the CC7 gate checks against, and it
    belongs to the provider, never to this builder.
    """

    surface: str
    operations: list[str]
    #: Declared operations whose value may itself embed another pipeline (a
    #: MongoDB-shaped call surface's $facet/$lookup/$unionWith pattern). CC7's
    #: gate only recurses into a value when its OWNING key is named here; every
    #: other nested object is treated as operand data (a $match filter
    #: document, for instance) and never scanned for keys, so an operand key
    #: can never be mistaken for a second operation. Omit or leave empty when
    #: the provider's call surface has no such operations, most will.
    nested_pipeline_operations: NotRequired[list[str]]


class CatalogEntry(TypedDict):
    """One cataloged failure. `fixes` stays in the author's order,
    most-likely-first."""

    code: str
    reason: str
    path: NotRequired[str]
    namespace: NotRequired[str]
    declared: NotRequired[Any]
    received: NotRequired[Any]
    accepts: NotRequired[list[str]]
    fixes: list[Fix]


class ProviderCatalog(TypedDict):
    """Everything the build-time gate needs: the call schema, the corpus index,
    the catalog."""

    declared_schema: DeclaredCallSchema
    topics: list[str]
    entries: list[CatalogEntry]


class TwinContext(TypedDict):
    """What the throw site knows that the catalog cannot: the actual input."""

    path: NotRequired[str]
    namespace: NotRequired[str]
    declared: NotRequired[Any]
    received: NotRequired[Any]
    accepts: NotRequired[list[str]]
