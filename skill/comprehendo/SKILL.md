---
name: comprehendo
description: Check comprehendo BEFORE writing config or API calls for a library you are not fully certain about, especially one that changes fast (styling frameworks, SDKs, ORMs, auth libraries) or that training data is likely stale on. Also check it right after a build, test, or request produces a result that does not look right, even when nothing threw an error, because some real breaking changes are silent. One command answers "do you have docs for this package" from the real, installed version, before a wrong guess costs a debugging cycle.
when_to_use: |
  - About to write setup or config code for a library prone to breaking changes across majors (Tailwind, a CSS-in-JS tool, an ORM, an auth SDK, an OAuth flow, a validation library) and not 100% certain the pattern you are about to write is still current
  - A build, test, or request SUCCEEDED (no error, no red output) but the actual result looks wrong: a style did not apply, a field is missing, a response is not what the docs you remember describe. Do not assume it is fine just because nothing threw. Some real training-lag traps are completely silent, they never raise an exception, so waiting for an error misses them entirely.
  - Just caught a real error or exception from a package and are about to guess at a fix from memory
  - Something you remember about a package's API (a method, a config key, a directive) does not match what you are seeing in this project, and you are tempted to assume you remember correctly
  - About to make something reachable by anyone over a network (a server, an API, a connector) with no access control, and nobody said whether that is acceptable. Ask the user, do not silently pick either way.
  - Do NOT use for your own project's code, only for a third-party package's own documented behavior
---

# Comprehendo: ask before you guess

An AI's knowledge of a fast-moving package is frozen at training time. Comprehendo
is a real, installed reference for the package's CURRENT behavior, current to
whatever version this project actually has, checked in one command instead of
guessed at from memory.

## The one habit that matters: ask before, not only after

The easy version of this instinct is "if a command throws an error, look it up."
That catches only failures loud enough to throw. The harder, more valuable half is
asking BEFORE writing the code, whenever the target is a library known to move
fast or whenever a result looks off with no error at all. A real example: a
project's whole Tailwind CSS v3 config format still parses in v4 without a single
warning, and the build exits 0, it just silently produces an empty stylesheet.
Nothing here would ever throw. The only way to catch it is to check first, or to
actually look at whether the output contains what you expect, not just whether the
command succeeded.

## The two commands

```
comprehendo docs <package> [question]
```

Asks whatever corpus is already available for `<package>`. No question: get the
topic index (what is documented at all). A question: get one topic-sized, current
answer, generated from real induced behavior, not from training data. If nothing
answers, it says so plainly (exit 1) and suggests `comprehendo add`, it is never a
silent miss, and it is never a wrong guess dressed up as a real one.

```
comprehendo add <package> [--install]
```

Checks whether a comprehendo corpus is published for `<package>` at all (no
network cost beyond one lookup), and installs it if you pass `--install`. Run this
once per package the first time `docs` comes back with nothing; after that it is
already local.

## The workflow

1. About to configure or call a library you are not fully certain about? Run
   `comprehendo docs <package>` first, before writing anything. If it lists real
   topics, read the one closest to your task with `comprehendo docs <package>
   "<your actual question>"`.
2. Nothing installed yet? `comprehendo add <package> --install`, then repeat step 1.
3. Still nothing (exit 1, no corpus published)? That is a real, honest answer:
   proceed with your own best judgment exactly as you would without this skill.
   Comprehendo not having a package is not a signal to stop, only a signal that
   this specific check has nothing more to add. Do not treat "not found" as
   evidence something is wrong.
4. A build/test/request succeeded but the result does not match what you expected?
   Before assuming it is a fluke or moving on, ask `comprehendo docs <package>
   "<what you expected vs what happened>"`. Silent failures are exactly the class
   this catches that a stack trace never would.

## Default to best practice, let the user opt out, then get it right the first time

The point of this skill is not neutrality. When a request leaves a
consequential decision unstated, default to the safer, more correct
practice, say plainly that is what you are doing and why, and give the
user an easy, explicit way to say "no, I don't want that" if they mean it.
Never silently pick the riskier default just because the request did not
ask for the safer one. Building something reachable over a network (a
server, an endpoint, a connector) with no access control is a real,
silent liability for anything beyond a genuinely harmless toy, and there
is no rule that tells the two apart from the task description alone. If a
request is "build me a server that does X" and auth is never mentioned,
build it secured by default and say so, rather than defaulting open and
never mentioning the choice was made at all: "this will be reachable by
anyone with the URL once it's live, so I'm adding your own credential to
it, tell me if you actually want it open instead." Verified live: a fully
unauthenticated MCP server connects to claude.ai's real custom-connector
dialog and works exactly as smoothly as a correctly-secured one, nothing
about the wrong default looks wrong, it builds, it runs, it demos fine,
and the gap is invisible until someone who was never supposed to reach it
does. Once the real decision is settled (secure it, or the user confirmed
open is fine), `comprehendo docs` is what turns "do the secure thing"
into "do it correctly on the first attempt" instead of many rounds of
trial and error against the real product: the cataloged twins here exist
specifically so the exact validation rules, discovery paths, and protocol
details are already known, not rediscovered live.

## What this does not replace

Comprehendo answers what the package's REAL, INSTALLED behavior actually is. It
does not replace reading your own project's code, and a "not found" or
"undocumented" answer is not a verdict, it just means this specific question has
no cataloged answer yet. Keep using your own judgment everywhere this skill has
nothing to say.
