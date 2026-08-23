---
topic: filters
status: ready
stub_fields: []
signatures:
  - "-vf <filtergraph>"
  - "-af <filtergraph>"
  - "-filter_complex <filtergraph>"
  - "-filters"
see_also:
  - scaling
  - codecs
vocabularies_served:
  own_terms:
    - filter
    - filtergraph
    - "filter chain"
    - label
    - "-vf"
    - "-filter_complex"
  translations:
    - known_tool: imagemagick
      terms:
        - "operator"
        - "image operation"
    - known_tool: gstreamer
      terms:
        - pipeline
        - "pad link"
  task:
    - "crop a video"
    - "chain video filters"
    - "combine two inputs"
---

A filtergraph is a comma-separated chain of filters, each written
`name=key=value:key=value`. `-vf` and `-af` take a simple chain for one output
stream; `-filter_complex` takes a graph with labels in square brackets, which
is how several inputs or outputs are wired together. A label is defined once
and consumed once, so a typo produces an unconnected graph, not a warning.

The two entries here differ in timing. An unknown filter name is found while
the graph is built, after the first frame is decoded, so the unknown name is
followed by a cascade: reinitializing failed, injecting a frame failed,
processing failed. The first line is the cause and the rest are its echo.
`ffmpeg -filters` lists what this build carries.

An undefined label is found earlier, while the graph is wired, and it names the
label. One sentence covers two mistakes: a label never defined, and a label
another output already consumed.

## Examples

### FFMPEG_UNKNOWN_FILTER, the first line is the cause and the rest is echo

```
ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -vf notafilter=1 out.mp4
# [AVFilterGraph @ 0x...] No such filter: 'notafilter'
# Error reinitializing filters!
# Failed to inject frame into filter network: Invalid argument
```

### FFMPEG_UNDEFINED_FILTER_LABEL, defined once and consumed once

```
ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -filter_complex "[0:v]scale=32:32[v]" -map "[vv]" out.mp4
# Output with label 'vv' does not exist in any defined filter graph, or was already used elsewhere.
ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -filter_complex "[0:v]scale=32:32[v]" -map "[v]" out.mp4
```
