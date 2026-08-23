---
topic: options
status: ready
stub_fields: []
signatures:
  - "ffmpeg [global] {[input opts] -i url} {[output opts] url}"
  - "-r <fps>"
  - "-t <duration>"
see_also:
  - inputs
  - outputs
vocabularies_served:
  own_terms:
    - option
    - flag
    - "-r"
    - "-t"
    - "option parsing"
  translations:
    - known_tool: imagemagick
      terms:
        - "command line option"
        - setting
  task:
    - "set the frame rate"
    - "trim a clip"
    - "fix a command line ffmpeg rejects"
---

ffmpeg's command line is positional: options apply to the next file argument,
so the same option means different things before `-i` and before the output.
Two entries in this corpus come from the parser rather than from the media, and
both stop the run before a single frame is read, which is the useful signal:
nothing was written, and nothing was half written.

An unrecognized option is a name the parser does not know. The message quotes
the name with its leading dash stripped, and the second line explains that the
argument list itself could not be split. Typos, an option that belongs to a
different ffmpeg version, and an operand that lost its option are all the same
class here.

An invalid option value is a name the parser knows carrying an operand it
cannot read. Frame rate accepts a number or a ratio such as `30000/1001`, and
duration accepts seconds or `HH:MM:SS.mmm`, so a shell variable that expanded
to nothing or to a word lands here. The distinction is worth keeping: an
unrecognized option is a spelling problem, an invalid value is a data problem,
and only the second one usually means an upstream variable is empty.

## Examples

### FFMPEG_UNRECOGNIZED_OPTION, the parser stops on a name it does not know

```
ffmpeg -i clip.mp4 -vcodex libx264 out.mp4
# Unrecognized option 'vcodex'.
# Error splitting the argument list: Option not found
```

### FFMPEG_INVALID_FRAMERATE, a known option carrying an unreadable operand

```
ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -r not-a-number out.mp4
# Invalid framerate value: not-a-number
ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -r 30000/1001 out.mp4
```
