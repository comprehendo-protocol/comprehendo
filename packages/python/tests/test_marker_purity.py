"""CC1 (07-cc1-probe-purity), enforced against the Python port's probe.

Probing does no I/O, mutates nothing, and answers identically however many
times it is asked. Two halves, because either alone is satisfiable by a
mistake: a structural half (the probe path cannot even IMPORT anything that
touches a file, a socket, or a process) and a behavioral half (10,000 probes,
same answer, no observable trace).
"""

from __future__ import annotations

import sys
from typing import Any

from comprehendo import MARKER_ATTR, ComprehendoEntry, attach_marker, has_marker, probe

from .helpers.source_scan import (
    IO_MODULES,
    external_imports,
    read_package_sources,
    stdlib_names,
    transitive_import_closure,
)

ENTRY: ComprehendoEntry = {
    "comprehendo": "0.1",
    "name": "mongodb-operator",
    "level": 1,
    "surfaces": ["docs"],
    "identity": "mongodb-operator is a pipeline-first wrapper over a document database.",
    "priming": "The packages in this project speak Comprehendo.",
}


class Handle:
    pass


class TestTheProbePathCannotDoIo:
    def test_scans_real_source_not_an_empty_set(self) -> None:
        closure = transitive_import_closure("marker.py")

        assert [source.path for source in closure] != []
        assert any(source.path == "marker.py" for source in closure)
        assert len(read_package_sources()) > 5

    def test_imports_nothing_that_can_touch_a_file_a_socket_or_a_process(self) -> None:
        imported = external_imports(transitive_import_closure("marker.py"))

        assert imported & IO_MODULES == set()

    def test_imports_only_the_standard_library_typing_surface(self) -> None:
        imported = external_imports(transitive_import_closure("marker.py"))

        assert imported <= stdlib_names()
        assert imported <= {"typing", "types", "collections", "__future__"}


class TestTenThousandProbes:
    def test_answer_identically_every_time(self) -> None:
        marked = attach_marker(Handle(), ENTRY)
        plain = Handle()

        answers = {probe(marked) is not None for _ in range(10_000)}
        misses = {probe(plain) for _ in range(10_000)}

        assert answers == {True}
        assert misses == {None}

    def test_hand_back_the_same_entry_object_every_time(self) -> None:
        marked = attach_marker(Handle(), ENTRY)
        first = probe(marked)

        assert all(probe(marked) is first for _ in range(10_000))

    def test_leave_no_observable_trace_on_the_value(self) -> None:
        marked = attach_marker(Handle(), ENTRY)
        before = dict(vars(marked))

        for _ in range(10_000):
            has_marker(marked)

        assert dict(vars(marked)) == before

    def test_allocate_no_module_state_and_import_nothing_new(self) -> None:
        marked = attach_marker(Handle(), ENTRY)
        before = set(sys.modules)

        for _ in range(10_000):
            probe(marked)

        assert set(sys.modules) - before == set()


class TestTheProbeIsOneAttributeRead:
    def test_reads_the_marker_attribute_and_nothing_else(self) -> None:
        seen: list[str] = []

        class Watched:
            def __getattribute__(self, name: str) -> Any:
                seen.append(name)
                return object.__getattribute__(self, name)

        watched = Watched()
        setattr(watched, MARKER_ATTR, ENTRY)
        seen.clear()
        probe(watched)

        assert seen == [MARKER_ATTR]
