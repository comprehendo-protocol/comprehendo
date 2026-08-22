"""One place that knows where the conformance kit lives and how it is read.

The kit is `packages/spec/kit`, read IN PLACE and never copied, never
rewritten (CC2 [01]: a port that needs a fixture changed has found a spec
bug, and the spec gets fixed first). Every Python conformance suite imports
from here; nothing re-inlines the loader.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

__all__ = [
    "EXPECTED_FIXTURES",
    "EXPECTED_NEGATIVE_FIXTURES",
    "KIT_ROOT",
    "NAMED_SHAPES",
    "PACKAGE_ROOT",
    "REPO_ROOT",
    "SCENARIOS",
    "SURFACES",
    "all_steps",
    "kit_json",
    "read_all_fixtures",
    "read_all_negative",
    "read_all_shapes",
    "read_kit_text",
    "steps_of_shape",
]

PACKAGE_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PACKAGE_ROOT.parents[1]
KIT_ROOT = PACKAGE_ROOT.parent / "spec" / "kit"

# The fixture roster, asserted as an exact set the same way the TypeScript
# helper does: a kit that quietly loses the disagreement fixture still passes
# every per-file test, so the roster itself is a test.
EXPECTED_FIXTURES = (
    "did-you-mean.json",
    "disagreement.json",
    "docs-three-vocabularies.json",
    "forward-compat.json",
    "probe-hit.json",
    "probe-mid-failure-discovery.json",
    "probe-miss.json",
    "twin-round-trip.json",
    "undocumented-source-pass.json",
)

EXPECTED_NEGATIVE_FIXTURES = (
    "computed-marker.json",
    "oversized-topic.json",
    "provider-side-corpus-veto.json",
    "raw-error-leak.json",
    "schema-escaping-fix.json",
    "telemetry-attempt.json",
)

NAMED_SHAPES = (
    "config.schema.json",
    "entry.schema.json",
    "explanation.schema.json",
    "fix.schema.json",
    "index.schema.json",
    "manifest.schema.json",
    "topic.schema.json",
    "twin.schema.json",
    "undocumented.schema.json",
    "unvalidatable.schema.json",
)

SCENARIOS = (
    "did-you-mean",
    "disagreement",
    "docs-lookup",
    "forward-compat",
    "probe-transcript",
    "source-pass",
    "twin-round-trip",
)

SURFACES = ("comprehend", "docs", "error", "explain", "manifest", "probe", "validate")


def read_kit_text(kind: str, name: str) -> str:
    """The raw bytes of one kit file, as text, exactly as they sit on disk."""
    path = KIT_ROOT / kind / name
    if not path.is_file():
        raise FileNotFoundError(f"the conformance kit has no {kind}/{name} under {KIT_ROOT}")
    return path.read_text(encoding="utf-8")


def kit_json(kind: str, name: str) -> Any:
    """One kit file, parsed."""
    return json.loads(read_kit_text(kind, name))


def _read_dir(kind: str, suffix: str = ".json") -> dict[str, Any]:
    directory = KIT_ROOT / kind
    return {
        path.name: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(directory.glob(f"*{suffix}"))
    }


def read_all_fixtures() -> dict[str, Any]:
    """Every positive fixture on disk, file name to parsed JSON."""
    return _read_dir("fixtures")


def read_all_negative() -> dict[str, Any]:
    """Every negative fixture on disk, file name to parsed JSON."""
    return _read_dir("negative")


def read_all_shapes() -> dict[str, Any]:
    """Every shape schema on disk, file name to parsed JSON."""
    return _read_dir("shapes", ".schema.json")


def all_steps() -> list[dict[str, Any]]:
    """Every step of every positive fixture, tagged with the file it came from."""
    out: list[dict[str, Any]] = []
    for file, fixture in read_all_fixtures().items():
        for index, step in enumerate(fixture.get("steps", [])):
            out.append({"file": file, "index": index, "fixture": fixture, "step": step})
    return out


def steps_of_shape(shape_file: str) -> list[dict[str, Any]]:
    """Every step in the kit whose response is an instance of `shape_file`."""
    return [entry for entry in all_steps() if entry["step"].get("shape") == shape_file]
