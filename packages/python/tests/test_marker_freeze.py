"""CC9 (10-cc9-marker-freeze), enforced against the Python port's marker.

`__comprehendo__` is a frozen literal with exactly one definition site in this
package; every other module imports `MARKER_ATTR`. The negative kit's
computed-marker fixture is this contract's must-fail proof, it names the
Python form explicitly (the kit's one stated language exemption), and it is
driven here against the same scan the definition site passes. At run time an
assembled attribute name and a literal one are the same attribute, which is
precisely why the gate is a source scan.
"""

from __future__ import annotations

import comprehendo
from comprehendo import MARKER_ATTR

from .helpers.kit import kit_json
from .helpers.source_scan import find_marker_sites, marker_sites_in_package

FIXTURE = kit_json("negative", "computed-marker.json")
FROZEN_FORM = FIXTURE["marker"]["frozen"]["python"]
COMPUTED_FORM = FIXTURE["marker"]["computed"]["python"]


class TestOneDefinitionSite:
    def test_the_package_names_the_marker_exactly_once(self) -> None:
        sites = marker_sites_in_package()

        assert [f"{path}: {site.raw}" for path, site in sites] == [
            f'marker.py: "{FROZEN_FORM}"'
        ]

    def test_that_one_site_lives_in_marker_py_where_the_doc_says(self) -> None:
        assert marker_sites_in_package()[0][0] == "marker.py"

    def test_it_is_written_as_a_frozen_literal_never_assembled(self) -> None:
        _, site = marker_sites_in_package()[0]

        assert site.frozen_literal is True
        assert site.computed is False

    def test_the_module_binds_it_to_one_name_carrying_no_alias(self) -> None:
        exported = {
            name: value
            for name, value in vars(comprehendo).items()
            if isinstance(value, str) and value == MARKER_ATTR
        }

        assert list(exported) == ["MARKER_ATTR"]

    def test_the_scan_reads_real_source_not_an_empty_set(self) -> None:
        from .helpers.source_scan import read_package_sources

        marker = next(s for s in read_package_sources() if s.path == "marker.py")

        assert len(marker.text) > 0
        assert len(read_package_sources()) > 5


class TestTheNegativeKitIsTheMustFailProof:
    def test_names_this_component_as_the_violation_it_exists_to_catch(self) -> None:
        assert FIXTURE["violation"]["rule"] == "CC9"
        assert FIXTURE["violation"]["contract"] == "10-cc9-marker-freeze"
        assert FIXTURE["violation"]["reason"] == "computed-marker"

    def test_rejects_the_fixtures_computed_python_form(self) -> None:
        sites = find_marker_sites(COMPUTED_FORM)

        assert len(sites) == 1
        assert sites[0].frozen_literal is False
        assert sites[0].computed is True

    def test_accepts_the_fixtures_frozen_python_form(self) -> None:
        sites = find_marker_sites(FROZEN_FORM)

        assert len(sites) == 1
        assert sites[0].frozen_literal is True
        assert sites[0].computed is False

    def test_this_package_writes_the_marker_exactly_as_the_kit_writes_it(self) -> None:
        assert MARKER_ATTR == FROZEN_FORM

    def test_cannot_be_caught_at_run_time_which_is_why_the_gate_is_a_scan(self) -> None:
        # Demonstrated on a neutral name on purpose: computing the real marker
        # here would put a second, aliased definition site in the repository.
        neutral = "__not_the_comprehendo_marker__"
        assembled = "__" + "not_the_comprehendo_marker" + "__"

        class Value:
            pass

        value = Value()
        setattr(value, assembled, "attached through the assembled name")

        assert getattr(value, neutral) == "attached through the assembled name"


class TestWhatTheFrozenMarkerGuaranteesAtRunTime:
    def test_is_the_same_string_on_every_import_of_the_module(self) -> None:
        import importlib

        reimported = importlib.import_module("comprehendo.marker")

        assert reimported.MARKER_ATTR == MARKER_ATTR

    def test_is_a_dunder_so_it_cannot_collide_with_an_ordinary_field(self) -> None:
        assert MARKER_ATTR.startswith("__")
        assert MARKER_ATTR.endswith("__")
