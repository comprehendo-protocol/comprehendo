"""comprehendo: the protocol that makes software packages understandable to AI.

The Python port of the reference implementation, layer for layer with
`packages/core/src`: marker (11), twin (12), docs (13), SDK entry (14),
manifest wiring (15). Zero runtime dependencies, Python 3.11+, and it passes
the conformance kit in `packages/spec/kit` with zero fixture changes (CC2).

The one-line probe, the whole point of the marker riding on values::

    try:
        thing.do()
    except Exception as exc:
        if hasattr(exc, "__comprehendo__"):
            print(exc.twin["fixes"][0]["title"])

@see .mdd/docs/18-python-core.md
"""

from __future__ import annotations

from .config import (
    MANIFEST_FIELDS,
    MANIFEST_KEY,
    PYPROJECT_TABLE,
    Discovery,
    DiscoveryInput,
    ManifestDeclaration,
    ManifestError,
    ManifestReading,
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
from .docs import (
    COMPREHENDO_VERSION,
    DEFAULT_LOG_PATH,
    PACKED_CORPUS_FORMAT,
    DocsIndex,
    DocsOptions,
    DocsResponse,
    DocsSurface,
    DocsTopic,
    LogStats,
    LookupRecord,
    PackedCorpus,
    PackedTopic,
    TopicExample,
    Undocumented,
    create_docs,
    load_packed_corpus,
    parse_packed_corpus,
)
from .marker import (
    MARKER_ATTR,
    ComprehendoEntry,
    ComprehendoLevel,
    ComprehendoSurface,
    attach_marker,
    has_marker,
    probe,
)
from .sdk import (
    Explanation,
    Provider,
    ProviderHooks,
    TwinResolution,
    TwinResolver,
    Unvalidatable,
    make_provider,
)
from .serialize import canonical
from .twin import (
    SPEC_VERSION,
    UNSTRUCTURED_CODE,
    UNSTRUCTURED_REASON,
    CatalogEntry,
    DeclaredCallSchema,
    Fix,
    ProviderCatalog,
    Twin,
    TwinBuilder,
    TwinCatalogError,
    TwinContext,
    Violation,
    apply_operations,
    attach_twin,
    audit_twin,
    create_twin_builder,
    raw_text_of,
    unstructured_twin,
    validate_catalog,
    violation,
)

__all__ = [
    "COMPREHENDO_VERSION",
    "DEFAULT_LOG_PATH",
    "MANIFEST_FIELDS",
    "MANIFEST_KEY",
    "MARKER_ATTR",
    "PACKED_CORPUS_FORMAT",
    "PYPROJECT_TABLE",
    "SPEC_VERSION",
    "UNSTRUCTURED_CODE",
    "UNSTRUCTURED_REASON",
    "CatalogEntry",
    "ComprehendoEntry",
    "ComprehendoLevel",
    "ComprehendoSurface",
    "DeclaredCallSchema",
    "Discovery",
    "DiscoveryInput",
    "DocsIndex",
    "DocsOptions",
    "DocsResponse",
    "DocsSurface",
    "DocsTopic",
    "Explanation",
    "Fix",
    "LogStats",
    "LookupRecord",
    "ManifestDeclaration",
    "ManifestError",
    "ManifestReading",
    "PackedCorpus",
    "PackedTopic",
    "Provider",
    "ProviderCatalog",
    "ProviderHooks",
    "TopicExample",
    "Twin",
    "TwinBuilder",
    "TwinCatalogError",
    "TwinContext",
    "TwinResolution",
    "TwinResolver",
    "Undocumented",
    "Unvalidatable",
    "Violation",
    "apply_operations",
    "attach_marker",
    "attach_twin",
    "audit_twin",
    "canonical",
    "create_docs",
    "create_twin_builder",
    "declaration_for",
    "has_marker",
    "load_packed_corpus",
    "make_provider",
    "parse_declaration",
    "parse_packed_corpus",
    "probe",
    "raw_text_of",
    "read_manifest_file",
    "read_package_json",
    "read_pyproject",
    "resolve_discovery",
    "stamp_manifest_file",
    "stamp_package_json",
    "stamp_pyproject",
    "unstructured_twin",
    "validate_catalog",
    "violation",
]

__version__ = "0.1.0"
