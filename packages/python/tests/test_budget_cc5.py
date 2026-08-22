"""CC5 [02]: a Python payload measured by the kit's own budget harness.

This is the port's PROCESS BOUNDARY, and it is tested as one: the payloads
this engine produces are written to a temp file and pushed through the SAME
harness the TypeScript side uses, over its documented seam
(`node kit/budget/run.js --scope <scope> --file <path>`). The parent asserts
what the CHILD measured, its record and its exit code, never what the parent
hoped, because two sides tested independently is exactly how a payload nobody
actually measured passes as measured.

There is no zero-dependency Python tokenizer, and the harness's own README
rules out a character or word proxy ("a '150 tokens' claim has to mean what an
agent's own context accounting means"), so borrowing the real harness is the
only honest option. The fixture files are not forked and the budgets are not
restated here: the numbers come back from the child.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest

from comprehendo import canonical, make_provider

from .helpers.kit import KIT_ROOT
from .helpers.toy import PRIMING_REFERENCE, TOY_PRIMING, ToyRuntime, toy_corpus, toy_hooks

RUNNER = KIT_ROOT / "budget" / "run.js"
HARNESS_DEPS = KIT_ROOT.parent / "node_modules" / "js-tiktoken"


def harness_available() -> bool:
    return shutil.which("node") is not None and RUNNER.is_file() and HARNESS_DEPS.exists()


requires_harness = pytest.mark.skipif(
    not harness_available(),
    reason=(
        "the CC5 budget harness needs node plus `npm ci` in packages/spec; "
        "install it to run the cross-language budget gate"
    ),
)


def measure(scope: str, payload: Any, tmp_path: Path) -> dict[str, Any]:
    """Push one Python-produced payload through the real harness, as CI would."""
    suffix = ".md" if isinstance(payload, str) else ".json"
    artifact = tmp_path / f"{scope}{suffix}"
    artifact.write_text(payload if isinstance(payload, str) else canonical(payload), "utf-8")

    finished = subprocess.run(
        ["node", str(RUNNER), "--json", "--scope", scope, "--file", str(artifact)],
        capture_output=True,
        text=True,
        check=False,
    )

    assert finished.returncode == 0, (
        f"the budget harness rejected the Python {scope} payload "
        f"(exit {finished.returncode}): {finished.stderr.strip()}"
    )
    records = json.loads(finished.stdout)
    assert len(records) == 1
    return dict(records[0])


@pytest.fixture()
def provider() -> Any:
    return make_provider(toy_corpus(), toy_hooks("both", ToyRuntime()))


@requires_harness
class TestThePythonPayloadsMeasureUnderBudget:
    def test_the_index_this_engine_returns(self, provider: Any, tmp_path: Path) -> None:
        record = measure("index", provider.docs(), tmp_path)

        assert record["scope"] == "index"
        assert record["pass"] is True
        assert record["measured"] <= record["limit"]

    def test_one_topic_this_engine_returns(self, provider: Any, tmp_path: Path) -> None:
        record = measure("topic", provider.docs("aggregation stages"), tmp_path)

        assert record["pass"] is True
        assert record["measured"] <= record["limit"]

    def test_every_topic_in_the_corpus_not_only_the_worked_one(
        self, provider: Any, tmp_path: Path
    ) -> None:
        for name in toy_corpus()["index"]:
            record = measure("topic", provider.docs(name), tmp_path)

            assert record["pass"] is True, f"{name} measured {record['measured']}"

    def test_the_priming_snippet_this_provider_ships(
        self, provider: Any, tmp_path: Path
    ) -> None:
        record = measure("priming", provider.entry["priming"], tmp_path)

        assert record["pass"] is True
        assert record["limit"] == 150

    def test_the_rfc_reference_snippet_the_harness_was_calibrated_on(
        self, tmp_path: Path
    ) -> None:
        record = measure("priming", PRIMING_REFERENCE, tmp_path)

        assert record["measured"] == 127
        assert record["pass"] is True


@requires_harness
class TestTheBoundaryItself:
    def test_the_parent_observes_what_the_child_recorded_not_its_own_guess(
        self, provider: Any, tmp_path: Path
    ) -> None:
        record = measure("topic", provider.docs("$group"), tmp_path)

        assert set(record) == {"scope", "limit", "measured", "pass", "encoding"}
        assert record["encoding"] in ("o200k_base", "cl100k_base")
        assert isinstance(record["measured"], int)

    def test_an_over_budget_payload_really_does_come_back_red(self, tmp_path: Path) -> None:
        # The negative kit's oversized topic, measured by the same child. If
        # this passed, every green above would be meaningless.
        oversized = json.loads(
            (KIT_ROOT / "negative" / "oversized-topic.json").read_text(encoding="utf-8")
        )["steps"][0]["response"]
        artifact = tmp_path / "oversized.json"
        artifact.write_text(canonical(oversized), "utf-8")

        finished = subprocess.run(
            ["node", str(RUNNER), "--json", "--scope", "topic", "--file", str(artifact)],
            capture_output=True,
            text=True,
            check=False,
        )

        assert finished.returncode == 1
        assert json.loads(finished.stdout)[0]["pass"] is False
        assert "OVER BUDGET" in finished.stderr

    def test_the_priming_this_port_ships_is_the_kits_own_measured_text(self) -> None:
        assert TOY_PRIMING.strip() != ""
        assert "Comprehendo" in TOY_PRIMING
