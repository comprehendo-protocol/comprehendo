"""Zero runtime dependencies, scanned, and the project's own size gate.

The TypeScript core scans for this in CI; the port holds itself to the same
discipline, and to the same "one responsibility per file" limit, because a
port that quietly grew a dependency or a 900-line module is not the same
implementation any more.
"""

from __future__ import annotations

import tomllib

from .helpers.kit import PACKAGE_ROOT
from .helpers.source_scan import (
    SRC_ROOT,
    external_imports,
    package_files,
    read_package_sources,
    stdlib_names,
)

MAX_FILE_LINES = 400


class TestZeroRuntimeDependencies:
    def test_the_package_declares_none(self) -> None:
        manifest = tomllib.loads((PACKAGE_ROOT / "pyproject.toml").read_text(encoding="utf-8"))

        assert manifest["project"]["dependencies"] == []

    def test_and_imports_none_the_standard_library_does_not_ship(self) -> None:
        imported = external_imports(read_package_sources())

        assert imported <= stdlib_names(), sorted(imported - stdlib_names())

    def test_the_dev_tools_are_dev_only(self) -> None:
        manifest = tomllib.loads((PACKAGE_ROOT / "pyproject.toml").read_text(encoding="utf-8"))
        dev = manifest["project"]["optional-dependencies"]["dev"]

        assert any(entry.startswith("pytest") for entry in dev)
        assert manifest["project"]["dependencies"] == []

    def test_the_scan_reads_real_source_not_an_empty_set(self) -> None:
        assert len(read_package_sources()) >= 8
        assert external_imports(read_package_sources()) != set()


class TestThePortIsTypedAndPackaged:
    def test_ships_the_typing_marker_so_consumers_get_the_types(self) -> None:
        assert (SRC_ROOT / "py.typed").is_file()

    def test_requires_the_python_version_the_doc_states(self) -> None:
        manifest = tomllib.loads((PACKAGE_ROOT / "pyproject.toml").read_text(encoding="utf-8"))

        assert manifest["project"]["requires-python"] == ">=3.11"


class TestOneResponsibilityPerFile:
    def test_no_module_is_over_the_projects_size_limit(self) -> None:
        oversized = {
            path.name: len(path.read_text(encoding="utf-8").splitlines())
            for path in package_files()
            if len(path.read_text(encoding="utf-8").splitlines()) > MAX_FILE_LINES
        }

        assert oversized == {}

    def test_the_layout_mirrors_the_typescript_core_layer_for_layer(self) -> None:
        modules = {path.name for path in package_files()}

        assert {
            "marker.py",
            "twin.py",
            "twin_validate.py",
            "docs.py",
            "docs_vocabulary.py",
            "sdk.py",
            "config.py",
        } <= modules
