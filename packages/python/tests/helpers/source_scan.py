"""Source-scanning helpers for the contracts this port's marker is held to.

CC1 (07-cc1-probe-purity): the probe path imports nothing that can do I/O,
transitively, so the probe cannot do I/O even by accident.
CC9 (10-cc9-marker-freeze): the marker attribute name appears as a frozen
literal exactly once in the package, never assembled at run time, never
aliased under a second name.

These live in the test tree on purpose: the scan needs the filesystem, and a
module under `comprehendo/` that imported `pathlib` would itself break CC1.

The scan is an AST walk rather than the TypeScript side's grep-level lexer,
because Python ships a parser: an assembled name (`'__' + 'comprehendo' +
'__'`) is a `BinOp` of constants, not a constant, and constant-folding it is
what tells a computed marker apart from a frozen one. At RUN time the two are
indistinguishable, which is exactly why the gate is a source scan (the
negative kit's computed-marker fixture is the must-fail proof, and it names
both language forms).
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path
from typing import NamedTuple

from comprehendo import MARKER_ATTR

from .kit import PACKAGE_ROOT

__all__ = [
    "IO_MODULES",
    "MARKER_NAME",
    "SRC_ROOT",
    "MarkerSite",
    "SourceFile",
    "external_imports",
    "find_marker_sites",
    "imports_of",
    "marker_sites_in_package",
    "package_files",
    "read_package_sources",
    "stdlib_names",
    "transitive_import_closure",
]

SRC_ROOT = PACKAGE_ROOT / "comprehendo"

#: The name the scan looks for, taken from the package's own single definition
#: site rather than retyped here. The value that constant must EQUAL is
#: asserted against the negative kit's `marker.frozen.python`, so no test in
#: this port hand-writes the marker spelling either.
MARKER_NAME = MARKER_ATTR

#: Standard-library modules that can touch a file, a socket, or a process.
#: A probe that reaches any of these transitively is not side-effect free.
IO_MODULES = frozenset(
    {
        "asyncio",
        "ftplib",
        "http",
        "io",
        "multiprocessing",
        "os",
        "pathlib",
        "shutil",
        "smtplib",
        "socket",
        "sqlite3",
        "ssl",
        "subprocess",
        "tempfile",
        "urllib",
        "webbrowser",
    }
)


class SourceFile(NamedTuple):
    """One module of the package: its path, its text, and its parsed tree."""

    path: str
    text: str
    tree: ast.Module


class MarkerSite(NamedTuple):
    """One place source names the marker, and how it named it."""

    raw: str
    frozen_literal: bool
    computed: bool


def read_package_sources() -> list[SourceFile]:
    """Every `.py` file under `comprehendo/`, recursively, sorted by path."""
    out: list[SourceFile] = []
    for path in sorted(SRC_ROOT.rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        out.append(SourceFile(path.relative_to(SRC_ROOT).as_posix(), text, ast.parse(text)))
    return out


def _docstring_nodes(tree: ast.Module) -> set[int]:
    """Every string constant that is a docstring, by object id.

    Docstrings are prose about the marker, not a definition of it, exactly as
    the TypeScript scan blanks comments before counting.
    """
    found: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", [])
            first = body[0] if body else None
            if (
                isinstance(first, ast.Expr)
                and isinstance(first.value, ast.Constant)
                and isinstance(first.value.value, str)
            ):
                found.add(id(first.value))
    return found


def _fold(node: ast.AST) -> tuple[str | None, bool]:
    """Constant-fold a string expression. Returns (value, was_computed)."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value, False
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left, _ = _fold(node.left)
        right, _ = _fold(node.right)
        if left is None or right is None:
            return None, False
        return left + right, True
    if isinstance(node, ast.JoinedStr):
        parts: list[str] = []
        for value in node.values:
            piece, _ = _fold(value)
            if piece is None:
                return None, False
            parts.append(piece)
        return "".join(parts), True
    if isinstance(node, ast.Call) and len(node.args) == 1:
        func = node.func
        argument = node.args[0]
        # `''.join([...])`, the other way a name gets assembled.
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "join"
            and isinstance(func.value, ast.Constant)
            and isinstance(func.value.value, str)
            and isinstance(argument, (ast.List, ast.Tuple))
        ):
            pieces: list[str] = []
            for element in argument.elts:
                piece, _ = _fold(element)
                if piece is None:
                    return None, False
                pieces.append(piece)
            return func.value.value.join(pieces), True
    return None, False


def find_marker_sites(source: str) -> list[MarkerSite]:
    """Every expression in `source` that names the marker, frozen or computed.

    A bare `__comprehendo__` identifier and the string `"__comprehendo__"` are
    both frozen literals (the attribute and its name). Anything that has to be
    evaluated to become the marker is computed, and computed is the violation.
    """
    tree = ast.parse(source)
    docstrings = _docstring_nodes(tree)
    sites: list[MarkerSite] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == MARKER_NAME:
            sites.append(MarkerSite(MARKER_NAME, True, False))
            continue
        if isinstance(node, ast.Attribute) and node.attr == MARKER_NAME:
            sites.append(MarkerSite(MARKER_NAME, True, False))
            continue
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if node.value == MARKER_NAME and id(node) not in docstrings:
                sites.append(MarkerSite(f'"{MARKER_NAME}"', True, False))
            continue
        value, computed = _fold(node)
        if computed and value == MARKER_NAME:
            sites.append(MarkerSite(ast.unparse(node), False, True))
    return sites


def marker_sites_in_package() -> list[tuple[str, MarkerSite]]:
    """Every marker-naming site in the package, tagged with its module."""
    return [
        (source.path, site)
        for source in read_package_sources()
        for site in find_marker_sites(source.text)
    ]


def imports_of(source: SourceFile) -> set[str]:
    """Every module this file imports, top-level package name only."""
    found: set[str] = set()
    for node in ast.walk(source.tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                found.add(alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.level > 0:
                found.add("." + (node.module or ""))
            elif node.module is not None:
                found.add(node.module.split(".")[0])
    return found


def transitive_import_closure(entry: str) -> list[SourceFile]:
    """The package modules reachable from `entry` (e.g. `marker.py`)."""
    by_path = {source.path: source for source in read_package_sources()}
    visited: set[str] = set()
    queue = [entry]
    while queue:
        path = queue.pop(0)
        if path in visited or path not in by_path:
            visited.add(path)
            continue
        visited.add(path)
        for name in imports_of(by_path[path]):
            if name.startswith("."):
                target = f"{name[1:]}.py"
                if target in by_path and target not in visited:
                    queue.append(target)
    return [by_path[path] for path in sorted(visited) if path in by_path]


def external_imports(sources: list[SourceFile]) -> set[str]:
    """Every non-relative module name the given sources import."""
    found: set[str] = set()
    for source in sources:
        found |= {name for name in imports_of(source) if not name.startswith(".")}
    return found


def stdlib_names() -> frozenset[str]:
    """The standard-library module names this interpreter ships."""
    return frozenset(sys.stdlib_module_names)


def package_files() -> list[Path]:
    """Every source file of the package, as paths (for the size gate)."""
    return sorted(SRC_ROOT.rglob("*.py"))
