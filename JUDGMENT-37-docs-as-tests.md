# JUDGMENT, 37-docs-as-tests

Every call made while building Docs As Tests [37], with the evidence that
settled it. Written as the calls were made, not reconstructed after.

Environment: ffmpeg version 4.4.2-0ubuntu0.22.04.1 on PATH, which is the
version `corpora/ffmpeg/manifest.json` declares it was authored against.

---

## J1. Path 1 (render real blocks into COMPREHENDO.md) over path 2 (a fixture)

**Decision: path 1.** Taken after trying it, not guessed in advance.

The feature's Acceptance Criteria are vacuous against 35's output as merged:
`corpora/ffmpeg/COMPREHENDO.md` is 39 lines and carries zero fenced blocks,
so "every code block executes successfully in CI" is true of the empty set.
35's own known_issues hands the decision here: "37 decides what it can
execute and asks for blocks if it wants them."

What I checked before deciding:

1. **The material exists and is real.** `corpora/ffmpeg/topics/*.md` carry 15
   worked examples across 7 topics, parsed by Corpus Format [28]'s own
   `readBody` into `CorpusExample {title, code}` and already carried through
   `pack()` into `PackedCorpus.docs.topics[name].examples`. So the renderer
   can quote them with every word still derived from the corpus (35's
   Business Rule), no hand-authored example content at all.

2. **They really run.** I executed all 15 blocks (37 command lines) against
   the real binary before writing a line of the runner
   (scratchpad probe, results in J3 below). Every command is a real,
   well-formed ffmpeg or ffprobe invocation. Nothing is pseudo-code.

3. **The gap path 1 closes is real and currently open.** `ffmpeg-witnesses.ts`
   runs a hand-maintained argv table that PARALLELS the topic examples; it
   does not run the example text itself. So today the worked examples in
   `topics/*.md` are exactly the "probably still accurate" prose Principle 10
   exists to prevent: nothing in CI executes them. Path 2 would prove my
   runner and leave that hole open. Path 1 closes it.

**Cost accepted:** COMPREHENDO.md grows from 39 to 167 lines. That is in
tension with "the index is a menu, never the meal". I weighed it and took the
growth, because (a) that principle governs `docs()` ANSWERS, which stay
topic-sized and are untouched here, (b) COMPREHENDO.md is the file-browsing
channel, where a browsing agent has no `docs()` to call, and (c) truncating
to "one example per topic" would be an arbitrary rule with no source in the
corpus. Recorded as a known_issue on 37 rather than hidden.

**Contract change accepted:** 35's Data Model named four sections and this
adds a fifth. 35's doc is updated (source_files unchanged, known_issues
re-tagged) because 35 explicitly deferred this decision to 37.

## J2. What "a block passes" MEANS, given that half the blocks are pitfalls

The doc's AC says "executes successfully". Run literally that is WRONG for
this corpus: 8 of the 15 blocks are cataloged-failure demonstrations whose
first command must fail, and a runner that demanded exit 0 everywhere would
report the flagship corpus as broken.

Rejected: inferring intent from the `#` annotation lines. Empirically they
are two different things with no mechanical separator, quoted stderr
(`# Unknown encoder 'libx266'`) and prose commentary
(`# succeeds, output carries video only`,
`# overwrites exists.mp4 and continues`). Any rule that guesses which is
which is a heuristic, and a heuristic that guesses wrong fails a correct
corpus.

**Adopted, and it needs no heuristic at all:** the disposition comes from the
example's own TITLE, and the verdict for a failing command comes from the
corpus's own machine-readable fingerprint index (Fingerprint Index & Matcher
[21], built from this corpus's `twins.json`).

- A command that exits 0 passes.
- A command that exits non-zero must route, through the REAL fingerprint
  matcher on its REAL stderr, to a cataloged twin, AND that twin must be the
  code the example's title names.
- An example whose title names no cataloged code has no licensed failure:
  every command in it must exit 0.

This is the precise definition of "a wrong result" the doc's Business Rule
asks for. It has real teeth: a renamed option, a removed filter, a dropped
encoder, or an error text ffmpeg reworded all stop matching and fail naming
the file and block index. It also cannot pass vacuously, an example the
corpus adds without a witness fails rather than skips (the CC4 [26] shape).

**Not claimed:** the runner does not assert that each `#` line appears in the
real stderr. It cannot separate quoted output from commentary without a
heuristic, and a check that reports green while asserting nothing about its
failure mode is worse than no check. Recorded in 37's known_issues, out loud.

## J3. Each command gets a fresh workspace, not one workspace per block

Found by running them. Three blocks break if the block is treated as a
sequential script, all for the same reason: the corpus's examples deliberately
omit `-y`, so a second command writing `out.mp4` hits
`File 'out.mp4' already exists. Overwrite? [y/N] Not overwriting - exiting`
and exits 1 for a reason that has nothing to do with what the block claims.

Observed (scaling example 1, second line;
stream-selection example 1, second line; and inputs example 2 when `clip.mp4`
was pre-seeded).

Reading the blocks, each line IS an independent illustration, not a step:
`outputs`'s three lines are three alternative invocations of the same
situation; `scaling`'s fence block is two alternative spellings of the same
guarantee; `stream-selection`'s heal block is the same corrected map over two
different inputs. So a fresh workspace per command is the FAITHFUL reading,
not a workaround. Adopted.

Omitting `-y` is also deliberate on the corpus's side: `FFMPEG_OUTPUT_EXISTS`
is a cataloged twin, so sprinkling `-y` through the examples would muddy the
topic that documents it. Adding it would have meant editing
`corpora/ffmpeg/topics/*.md`, which is ffmpeg Corpus [32]'s lane, not mine.

## J4. The workspace is a DECLARED table, and an undeclared input is a failure

A transcript names files (`clip.mp4`, `notes.txt`, `video-only.mp4`,
`with-audio.mp4`, `exists.mp4`, `clip-1442x1440.mp4`, `does-not-exist.mp4`).
Nothing in the corpus format carries "here is the media this example needs";
`ffmpeg-witnesses.ts` already records the same format gap and answers it the
same way, with a declared per-witness `setup`. This runner declares a
workspace table with the same reasoning and the same source (every fixture is
built by ffmpeg itself from `lavfi`, no external media ever).

Two roles are needed and both are read off the corpus, not guessed:
- `input`, materialized when the command READS it (the operand after `-i`);
- `present-output`, materialized when the command WRITES it, which exists for
  exactly one file, `exists.mp4`, because `FFMPEG_OUTPUT_EXISTS` is a twin
  ABOUT an output that is already there. `ffmpeg-witnesses.ts` seeds the same
  file for the same twin.
- `absent`, declared and never materialized (`does-not-exist.mp4`), because
  `FFMPEG_INPUT_NOT_FOUND` is a twin about a file that is not there.

**A `-i` operand the table does not declare fails the run**, naming the file
and the block. Not a skip: a new example arriving with media nobody prepared
must go red, exactly as CC4 [26] refuses a cataloged entry no witness
provokes.

## J5. No shell, ever, and an allowlisted program

A transcript is corpus text, and "corpus text is data, never instructions" is
a core project rule. The runner therefore:
- tokenizes the command line itself (quote-aware) and spawns with an argv
  array, never through a shell, so an operand can never become a command;
- REFUSES a line carrying shell metacharacters (`|`, `;`, `&`, `` ` ``,
  `$(`, `>`, `<`, newline continuations), naming the block;
- REFUSES any program that is not on an allowlist derived from the corpus's
  own `declared_schema.surface` (`ffmpeg`), plus one declared companion,
  `ffprobe`, which the corpus's `inputs` topic uses as the diagnostic next
  step. The companion is declared in the runner with that reason, never
  inferred from the text.

This is the same argument `ffmpeg-cli.ts` already makes about why a CLI
`apply` is safe.

## J6. An unsupported fence language FAILS, it never skips

The extractor reads the info-string. `sh` (and the bare/`shell`/`bash`
spellings) is a CLI transcript. Any other language in a GENERATED doc surface
is an executor this feature does not have, and the run fails naming the file,
block index and language. A gate that silently skips what it cannot run is
the vacuous-green failure this whole feature exists to prevent.

## J7. The renderer emits `sh` as the info-string, which the corpus does not carry

The corpus's own topic files use bare ``` fences. `sh` is added by the
renderer. I judged this a RENDERING convention, in the same class as the
table pipes and the escaping `comprehendo-md.ts` already does, not authored
content: it makes no claim about the package. It is what gives the Data
Model's `language` field a real source instead of an assumption, and it is
the one thing the doc's own instruction ("use whatever language-detection the
fence's info-string gives you") requires to exist.

## J8. Three files, split at the size gate

`source_files` in the doc named one file. Written as one it came to 587
lines, past this project's 400-line cap, so it split the way
`comprehendo-md.ts`/`generate-comprehendo-md.ts` and
`corpus-format.ts`/`corpus-source.ts` split before it:

- `docs-code-blocks.ts` (242), pure: extraction, transcript parsing and
  tokenizing, the record shape, the report;
- `docs-transcript-workspace.ts` (248): the declared workspace, the program
  allowlist, the one real spawn;
- `run-docs-code-blocks.ts` (358): the verdict, corpus loading, argv, exit
  code.

358 is over the build skill's 300 default and inside this project's own
stated cap of 400; the largest existing source file in the repo is
`packages/core/src/config.ts` at 442, so 400 is the number this project
actually runs on. All three `source_files` recorded in 37's doc.

## J9. Exit codes follow the established contract

0 every block passed, 1 a block failed, 2 a precondition the caller can fix
(no such file, no built packages, no ffmpeg), 70 a bug in this tool. Same
vocabulary Corpus Generator [17] and COMPREHENDO.md Generator [35] use, so CI
reads one contract across all three.

## J10. Files touched outside 37's declared `source_files`

- `scripts/comprehendo-md.ts` and `corpora/ffmpeg/COMPREHENDO.md`: 35's, and
  35's doc explicitly invited this handoff. 35's suite
  (`packages/registry-tools/test/comprehendo-md.test.ts`) re-run unchanged and
  green after the change, evidence in the build report.
- `.mdd/docs/35-comprehendo-md-generator.md`: known_issues re-tagged, the
  deferral it recorded is now resolved.
- `.github/workflows/docs-as-tests.yml`: new, owned by this feature, follows
  `comprehendo-md.yml`'s shape.

No sibling feature in this wave touches any of them.

## J11. The doc is left at `active`/`verify`, not flipped to `complete`

The lane brief reserves Phase 7 and all bookkeeping to the orchestrator, so
37's doc records everything the build learned (source_files, test_files,
evidence in the Acceptance Criteria, tagged known_issues) but its `status`
stays `active` and `phase` `verify`. The status flip is the orchestrator's.

## J12. The frontmatter-validate hook reports phantom files, and it is wrong here

Writing 37's doc tripped `frontmatter-validate.sh` with "source_files ...
does not exist on disk". It resolves paths against `$CLAUDE_PROJECT_DIR`,
which is the MAIN checkout, while the files live on this feature branch in
the worktree. Verified: all four paths exist under
`.worktrees/37-docs-as-tests/`, and `ls` on the main checkout's `scripts/`
shows only 35's two files, which is exactly what an unmerged branch looks
like. A worktree artifact, not a doc defect, and not treated as a blocker.
Leaving `status: active` (J11) also puts the doc outside the rule the hook
enforces, which only binds `complete` and `in_progress`.

## J13. The Python port's suite was not runnable, and that is reported as such

`packages/python` needs 3.11+ (`tomllib`, `typing.NotRequired`) and the
environment has 3.10; 17 collection errors, zero of them reachable from
anything this feature touches (it adds no Python). Reported as not-runnable
rather than folded into a green claim. Node suites in this worktree:
registry-tools 373/373, core 548/548, spec 436/436 (spec runs under
`node --test`, not vitest).
