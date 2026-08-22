"""Docs Engine [13], the local miss log, and CC6 [27]: nothing is transmitted.

Two halves. Behavioral: every lookup, hit or miss, is appended to a local file
as one JSON object per line, and a log that cannot be written never breaks
`docs()`, it is counted. Structural: nothing in this engine, or in anything it
imports, can reach a network, because a transitive import is exactly what
would defeat the guarantee.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from comprehendo import DEFAULT_LOG_PATH, LookupRecord, create_docs

from .helpers.source_scan import IO_MODULES, external_imports, transitive_import_closure
from .helpers.toy import toy_corpus

NETWORK_MODULES = frozenset(
    {"asyncio", "ftplib", "http", "smtplib", "socket", "ssl", "urllib", "webbrowser"}
)


def at(moment: str) -> Any:
    return lambda: datetime.fromisoformat(moment).replace(tzinfo=timezone.utc)


class TestEveryLookupIsRecorded:
    def test_a_browse_records_an_index_lookup_with_no_query_and_no_topic(self) -> None:
        records: list[LookupRecord] = []
        docs = create_docs(toy_corpus(), {"sink": records.append})

        docs()

        assert records[0]["query"] is None
        assert records[0]["result"] == "index"
        assert "topic" not in dict(records[0])

    def test_a_hit_records_the_topic_that_earned_its_keep(self) -> None:
        records: list[LookupRecord] = []
        docs = create_docs(toy_corpus(), {"sink": records.append})

        docs("$group")

        assert records[0]["result"] == "hit"
        assert records[0]["topic"] == "$group"
        assert records[0]["query"] == "$group"

    def test_a_miss_records_the_query_that_is_the_next_releases_raw_material(self) -> None:
        records: list[LookupRecord] = []
        docs = create_docs(toy_corpus(), {"sink": records.append})

        docs("how do I shard a capped collection")

        assert records[0]["result"] == "miss"
        assert records[0]["query"] == "how do I shard a capped collection"
        assert "topic" not in dict(records[0])

    def test_stamps_each_record_with_an_iso_timestamp(self) -> None:
        records: list[LookupRecord] = []
        docs = create_docs(
            toy_corpus(), {"sink": records.append, "now": at("2026-08-22T10:00:00")}
        )

        docs("$group")

        assert records[0]["timestamp"] == "2026-08-22T10:00:00+00:00"


class TestTheLogIsALocalFile:
    def test_appends_one_json_object_per_line(self, tmp_path: Path) -> None:
        log = tmp_path / "nested" / "docs-usage.log"
        docs = create_docs(toy_corpus(), {"log_path": str(log)})

        docs()
        docs("$group")
        docs("nothing like this")

        lines = log.read_text(encoding="utf-8").splitlines()
        assert [json.loads(line)["result"] for line in lines] == ["index", "hit", "miss"]

    def test_creates_the_directory_it_was_pointed_at(self, tmp_path: Path) -> None:
        log = tmp_path / "a" / "b" / "docs-usage.log"
        create_docs(toy_corpus(), {"log_path": str(log)})("$group")

        assert log.is_file()

    def test_defaults_to_a_relative_path_under_the_projects_own_tree(self) -> None:
        assert DEFAULT_LOG_PATH == ".comprehendo/docs-usage.log"
        assert not DEFAULT_LOG_PATH.startswith("/")


class TestALogThatCannotBeWritten:
    def test_never_breaks_the_answer(self, tmp_path: Path) -> None:
        blocked = tmp_path / "blocked"
        blocked.write_text("this is a file, not a directory", encoding="utf-8")
        docs = create_docs(toy_corpus(), {"log_path": str(blocked / "docs-usage.log")})

        assert dict(docs("$group"))["topic"] == "$group"

    def test_is_counted_rather_than_swallowed(self, tmp_path: Path) -> None:
        blocked = tmp_path / "blocked"
        blocked.write_text("this is a file, not a directory", encoding="utf-8")
        docs = create_docs(toy_corpus(), {"log_path": str(blocked / "docs-usage.log")})

        docs("$group")
        docs("$match")

        assert docs.log_stats() == {"written": 0, "failed": 2}

    def test_counts_what_it_did_write(self, tmp_path: Path) -> None:
        docs = create_docs(toy_corpus(), {"log_path": str(tmp_path / "docs-usage.log")})

        docs()
        docs("$group")

        assert docs.log_stats() == {"written": 2, "failed": 0}


class TestNothingCrossesTheWire:
    def test_the_engine_imports_nothing_that_can_reach_a_network(self) -> None:
        imported = external_imports(transitive_import_closure("docs.py"))

        assert imported & NETWORK_MODULES == set()

    def test_the_only_io_it_reaches_for_is_the_local_file_it_documents(self) -> None:
        imported = external_imports(transitive_import_closure("docs.py"))

        assert imported & IO_MODULES <= {"os", "pathlib"}

    def test_the_scan_covers_the_engine_and_everything_it_imports(self) -> None:
        closure = {source.path for source in transitive_import_closure("docs.py")}

        assert "docs.py" in closure
        assert "docs_vocabulary.py" in closure
