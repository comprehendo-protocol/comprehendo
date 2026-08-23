---
topic: outputs
status: ready
stub_fields: []
signatures:
  - "<url>"
  - "-y <url>"
  - "-n <url>"
  - "-nostdin"
see_also:
  - inputs
  - codecs
vocabularies_served:
  own_terms:
    - output
    - muxer
    - overwrite
    - "-y"
    - "-n"
    - "-nostdin"
  translations:
    - known_tool: imagemagick
      terms:
        - "output image"
        - "write file"
    - known_tool: gstreamer
      terms:
        - filesink
        - sink element
  task:
    - "write a video file"
    - "overwrite an existing file"
    - "script ffmpeg without prompts"
---

The last non-option argument is the output, and its extension picks the muxer
unless `-f` overrides it. Two of this corpus's entries live here, and both are
about the arguments that are missing rather than the ones that are wrong.

An invocation with inputs and no output ends at the argument parser, before any
work, reporting that at least one output file is required. It is the usual
result of a filter or option that swallowed the path, or of a command assembled
in a loop that lost its last element.

An output path that already exists is the classic scripting trap. Interactively
ffmpeg prompts and a human answers; with no terminal on stdin the prompt cannot
be answered and the run stops, so the same command that worked by hand fails
under cron, CI, or a subprocess. Naming `-y` or `-n` is what makes the outcome
identical in both settings. They are not two ways to keep going: `-y`
overwrites whatever was at that path and continues, while `-n` reports the same
already-exists line and still stops at exit 1, on purpose. Which one is correct
depends on whether that file is expendable, which is a decision about data
rather than a convenience flag, and it is why this entry is a runbook and not a
silent correction. Adding `-nostdin` keeps the wording deterministic, which is
the form this corpus catalogs.

## Examples

### FFMPEG_NO_OUTPUT_FILE, the parser stops before any work happens

```
ffmpeg -i clip.mp4
# At least one output file must be specified
```

### FFMPEG_OUTPUT_EXISTS, the prompt nobody is there to answer

```
ffmpeg -nostdin -i clip.mp4 exists.mp4
# File 'exists.mp4' already exists. Exiting.
ffmpeg -nostdin -n -i clip.mp4 exists.mp4
# File 'exists.mp4' already exists. Exiting.   (same line, exit 1, on purpose)
ffmpeg -nostdin -y -i clip.mp4 exists.mp4
# overwrites exists.mp4 and continues
```
