# Judgment log: 35-comprehendo-md-generator

Unattended build, wave 7 batch 1. Every call decided and logged here; nothing
in this list met the blocking bar (contract violation, business-rule
narrowing, contradicting docs, destructive operation, gate over budget).

## 1. Where the generated file lives, and whose directory that is

The feature generates `COMPREHENDO.md` "at a package root". The only real
corpus package in this repository is `corpora/ffmpeg/`, whose directory is
ffmpeg Corpus [32]'s `source_files` (`corpora/ffmpeg/`, status complete,
wave 6, not building concurrently).

Decision: write the generated artifact as a NEW file,
`corpora/ffmpeg/COMPREHENDO.md`, and modify no existing file in that
directory. Rationale: the file must sit at a package root by definition of
the discovery channel, no sibling in this wave touches `corpora/` (36 owns
`packages/spec/priming.md`), so there is no serialization risk, and blocking
here would make acceptance criteria 1 and 2 unbuildable. Verified: `git
status` shows exactly one added path under `corpora/`.

## 2. A second source file, at the size gate

The doc's `source_files` named one file. Written as one, it came to 429
lines, over CLAUDE.md's 400-line ceiling and well over the build skill's
300-line gate.

Decision: split the way this project already splits at that gate
(`corpus-format.ts`/`corpus-source.ts`, `twin.ts`/`twin-validate.ts`):
`scripts/comprehendo-md.ts` is pure (bytes in, bytes out: the skeletons, the
renderer, the drift report), `scripts/generate-comprehendo-md.ts` is the
impure half (module loading, files, argv, exit code) and re-exports the pure
surface so a consumer still imports one module. The doc's `source_files` is
updated to both, and byte-identity of the rendered file was re-proven after
the split (`--check` exit 0). 217 and 240 lines.

## 3. "Every word DERIVED", read precisely

Taken literally, no file could be generated at all: a rendered document is
skeleton plus values. The reading applied, and the one the Business Rule is
about: every claim ABOUT THE PACKAGE comes from the corpus, and the only
other text is protocol skeleton quoted from the RFC (completeness contract,
RFC 5.5; priming pointer, RFC 4.1 and 5.5), identical for every corpus.

Held mechanically, not by assertion: a test renders a copy of the real
corpus with a different identity and asserts no word of the ffmpeg one
survives, and each topic row's answer must be a prefix of that topic's own
summary, shorter than it, ending on a sentence terminator. Nine mutations to
the renderer were each caught by a named test.

## 4. The identity sentence RFC 5.5 asks for does not exist in the corpus

RFC 5.5's skeleton opens "⟨name⟩ is ⟨one sentence: what the tool is and
does⟩". The packed artifact has no `identity` slot (it is a provider-supplied
string on the SDK entry, not corpus data), so there is nothing to derive that
sentence from.

Decision: state what the corpus documents (package, spec version, provider,
authored-against version, topic/fix/failure counts, declared call surface)
and never invent a description of the tool, then carry the completeness
contract verbatim. Writing a sentence about ffmpeg here would be precisely
the hand-authored prose the Business Rule forbids. Recorded as a `[gap]` in
the feature doc: adding an `identity` field is Corpus Format [28]'s call.

## 5. Importing `dist/` rather than `src/`

Node's type stripping does not remap a `./foo.js` specifier onto `foo.ts`
(verified empirically, ERR_MODULE_NOT_FOUND), so a standalone script cannot
load either package's source tree at all. The generator therefore imports
the BUILT modules, which is also what 28's own acceptance evidence used
("proven live through the built dist/ artifacts").

The risk this creates, a stale `dist/` passing the gate quietly, is closed
rather than accepted: the suite compares newest `src/**.ts` mtime against
newest `dist/**.js` mtime and fails loudly naming the build command (same
"fail, never skip" call `requireFfmpeg` makes). Verified by touching
`packages/core/src/docs.ts`: the suite refused to run, and passed again
after the rebuild.

## 6. The CI gate's shape, and a new workflow file

This repository's convention for a CI-runnable check is a vitest suite in
`packages/registry-tools` plus a workflow that runs it (34-upstream-watch).
Followed exactly: `packages/registry-tools/test/comprehendo-md.test.ts` plus
a new `.github/workflows/comprehendo-md.yml`. New file, no existing workflow
edited, no overlap with the concurrent sibling.

The workflow loops over every `corpora/*/` carrying a `manifest.json` rather
than naming ffmpeg: a corpus added later with no generated file then reports
"there is no COMPREHENDO.md, and the corpus generates one" instead of
passing because nobody remembered to edit the workflow. Loop run locally.

## 7. `scripts/package.json` and `scripts/tsconfig.json`

Two build-config files the doc did not name. `package.json` (`"type":
"module"`, private, never published) is how node is told to read `scripts/*.ts`
as ES modules instead of sniffing each one; `tsconfig.json` is how the script
is type-checked at all, since no config in the repository covered `scripts/`.
Both are new files under a directory nothing else owns yet. `typeRoots`
points at registry-tools' installed `@types` because the packages install
independently and the repository root has no `node_modules`.

## 8. A corpus that no longer validates exits 2, not 70

Found while building: deleting a topic file made the CLI exit 70 (a bug in
this tool), because Corpus Format [28]'s `CorpusFormatError` fell through to
the crash handler. A corpus the author can fix is a precondition, so it is
now caught and reported with 28's own violations at exit 2, matching Corpus
Generator [17]'s established exit-code contract. Matched by error NAME, not
`instanceof`: the script loads 28 from `dist/` and a suite loads it from
`src/`, and two module instances share no class identity.

## 9. No fenced code blocks in the rendered file

Docs As Tests [37] (batch 2, depends on this feature) executes every code
block in the generated documentation. Emitting worked examples now would
commit 37 to a runner shape before 37 exists, and the topic examples are
ffmpeg command lines whose execution needs real media fixtures. Decision:
inline code spans only, no fenced blocks, recorded as a `[deferred]` so 37
decides what it can execute and asks for blocks if it wants them.

## 10. Doc edits made, and not made

Edited (the doc is this feature's own): `source_files` (the split),
`test_files` (ground truth), Architecture and Implementation Notes,
acceptance criteria checked with their evidence, Known Issues.

NOT touched: `status`, `phase`, `.mdd/.state.json`, the wave manifest, any
other doc. Phase 7 bookkeeping and the merge belong to the orchestrator.

## 11. node_modules in the worktree

The fresh worktree had no `node_modules`, and the suites need vitest.
Hardlinked (`cp -al`) from the main checkout after verifying both packages'
`package.json` are byte-identical to the committed ones. No lockfile, no
manifest, and nothing tracked was modified; `node_modules/` is gitignored.
