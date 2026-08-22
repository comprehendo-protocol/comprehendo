# Judgment log, 04-conformance-fixtures

Small decisions taken and logged (nothing blocking). Each is reversible and
local to this feature's own files.

1. **Fixture envelope.** The doc says "no fixture format is invented here
   beyond what the schemas already define". A transcript still needs a
   carrier, so every fixture file is a thin, uniform envelope
   (`fixture`, `title`, `scenario`, `rfc`, `steps`) whose every `response`
   is an unmodified instance of a 03 shape, named by `shape`. The envelope
   carries no protocol shape of its own; it is the kit's scenario record.
   Documented in `packages/spec/kit/fixtures/README.md` so a port can read
   the kit without reading the JS tests.

2. **Three vocabularies in one file, not three.** `docs-three-vocabularies.json`
   holds all three queries as three steps. The load-bearing assertion is that
   the three vocabularies resolve to the SAME topic, which only exists when
   they sit in one fixture.

3. **Language neutrality is enforced as text.** `fixture-kit.test.mjs` fails
   any fixture whose text carries a single-ecosystem idiom (`Symbol.for`,
   `__comprehendo__`, the words javascript/typescript/python/node). Cost: the
   entry's `priming` string is the RFC section 5.5 reference form with the
   two marker idioms generalized to "the Comprehendo marker". The RFC states
   the reference form is adapted per provider; the per-ecosystem snippet is
   Priming Snippet [36]'s artifact, not a language-neutral kit fixture's.

4. **Deliberate duplication, checked instead of factored out.** The same entry
   and the same topic appear in several transcripts, because a conformance
   fixture must be self-contained for a port that reads one file. The
   duplication is held by cross-fixture consistency tests (entries with the
   same provider `name` agree on every field this spec version defines;
   topics with the same `topic` name are deep-equal), so a drifting copy is
   red, not silent.

5. **The kit is NOT wired into `packages/spec/test/helpers/rfc-examples.mjs`.**
   That helper belongs to 03 and this feature does not own it, so the fixture
   values live in the fixture files and the two artifacts stay independent
   (03 proves the schemas accept the RFC's own examples; 04 proves the kit's
   scenarios). No shared file was edited.

6. **`packages/spec/package.json` left untouched.** An `./kit/fixtures/*`
   entry in `exports` would be a nicety; the file is owned by 03/06 and the
   fixtures already ship (`files: ["kit"]`) and are read from disk by both
   ports, so nothing needed it. Not a blocker, just not taken.

7. **Budget cross-check, borrowed read-only from 06.** `fixtures-docs.test.mjs`
   measures every topic, index, and priming payload in the kit through
   `kit/budget/measure.js` (import only, no edit). The kit doubles as the
   golden example set, so a golden example over the CC5 budget would be the
   spec teaching the thing CC5 forbids.

8. **`config.schema.json` is not exercised by this positive kit.** The doc's
   scenario list does not name consumer configuration, and the consumer knobs
   belong to Router & Precedence [22] / Config Loader [23]. The gap is
   explicit, not silent: the shape-coverage test in `fixture-kit.test.mjs`
   asserts the exact exercised set and names `config.schema.json` (and
   `fix.schema.json`, covered transitively through `twin.fixes`) as the two
   deliberate absences, so adding a fixture later has to update the list.

9. **Disagreement fixture uses a second provider name.** `mongodb-migrator`,
   not the kit's `mongodb-operator`, because its entry deliberately reports a
   different level than the rest of the kit; sharing the name would have made
   the cross-fixture consistency invariant contradict the scenario.
