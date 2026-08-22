"""Marker & Probe [11], the Python port.

`hasattr(exc, "__comprehendo__")` is the documented one-line probe, so the
marker has to be a real attribute on the value the agent is already holding.
Everything else here is the same contract the TypeScript module carries:
attachment happens once, at construction or throw time; a second, different
entry is refused; probing never throws, whatever it is handed.
"""

from __future__ import annotations

from typing import Any

import pytest

from comprehendo import (
    MARKER_ATTR,
    ComprehendoEntry,
    attach_marker,
    has_marker,
    probe,
)

from .helpers.kit import kit_json


def an_entry(**overrides: Any) -> ComprehendoEntry:
    entry: dict[str, Any] = {
        "comprehendo": "0.1",
        "name": "mongodb-operator",
        "level": 2,
        "surfaces": ["docs", "validate", "explain"],
        "identity": "mongodb-operator is a pipeline-first wrapper over a document database.",
        "priming": "The packages in this project speak Comprehendo.",
    }
    entry.update(overrides)
    return entry  # type: ignore[return-value]


class Handle:
    """A controlled handle, the third value shape a provider marks."""


class TestTheMarkerName:
    def test_is_the_dunder_the_kit_names_for_python(self) -> None:
        fixture = kit_json("negative", "computed-marker.json")

        assert MARKER_ATTR == fixture["marker"]["frozen"]["python"]

    def test_probe_reads_it_by_that_exact_name(self) -> None:
        entry = an_entry()
        error = attach_marker(RuntimeError("boom"), entry)

        assert getattr(error, MARKER_ATTR) == entry


class TestTheOneLineProbe:
    def test_hasattr_answers_true_on_a_marked_error(self) -> None:
        error = attach_marker(RuntimeError("boom"), an_entry())

        assert hasattr(error, "__comprehendo__") is True

    def test_hasattr_answers_false_on_an_ordinary_error(self) -> None:
        assert hasattr(RuntimeError("boom"), "__comprehendo__") is False


class TestAttachMarker:
    def test_marks_a_root_export_an_error_and_a_handle(self) -> None:
        entry = an_entry()

        for target in (Handle(), RuntimeError("boom"), Handle()):
            assert probe(attach_marker(target, entry)) == entry

    def test_returns_the_same_object_never_a_copy(self) -> None:
        handle = Handle()

        assert attach_marker(handle, an_entry()) is handle

    def test_is_idempotent_for_the_same_entry(self) -> None:
        entry = an_entry()
        handle = Handle()

        assert attach_marker(attach_marker(handle, entry), entry) is handle
        assert probe(handle) == entry

    def test_refuses_a_second_different_entry(self) -> None:
        handle = attach_marker(Handle(), an_entry())

        with pytest.raises(TypeError, match="already carries a different"):
            attach_marker(handle, an_entry(name="someone-else"))

    def test_refuses_a_value_that_is_not_an_entry(self) -> None:
        broken: list[Any] = [
            {},
            {"comprehendo": "0.1"},
            an_entry(level=3),
            an_entry(surfaces="docs"),
        ]
        for candidate in broken:
            with pytest.raises(TypeError, match="not a valid"):
                attach_marker(Handle(), candidate)

    def test_freezes_the_entry_so_a_claim_cannot_be_edited_afterwards(self) -> None:
        entry = an_entry()
        carried = probe(attach_marker(Handle(), entry))

        assert carried is not None
        with pytest.raises(TypeError):
            carried["level"] = 1
        with pytest.raises(TypeError):
            carried["surfaces"].append("comprehend")

    def test_refuses_a_target_that_cannot_carry_an_attribute(self) -> None:
        with pytest.raises(TypeError):
            attach_marker(object(), an_entry())


class TestProbe:
    def test_returns_none_for_anything_that_never_spoke_the_protocol(self) -> None:
        values: list[Any] = [None, 1, "text", [], {}, Handle(), RuntimeError("boom")]
        for value in values:
            assert probe(value) is None

    def test_returns_none_when_the_marker_key_carries_something_else(self) -> None:
        handle = Handle()
        setattr(handle, MARKER_ATTR, "not an entry")

        assert probe(handle) is None
        assert has_marker(handle) is False

    def test_never_raises_even_on_a_booby_trapped_attribute(self) -> None:
        class Trapped:
            def __getattr__(self, name: str) -> Any:
                raise RuntimeError("this getter is a trap")

        assert probe(Trapped()) is None
        assert has_marker(Trapped()) is False

    def test_has_marker_is_the_one_line_form_of_the_same_read(self) -> None:
        marked = attach_marker(Handle(), an_entry())

        assert has_marker(marked) is True
        assert has_marker(Handle()) is False
