---
topic: codecs
status: ready
stub_fields: []
signatures:
  - "-c:v <encoder>"
  - "-c:a <encoder>"
  - "-c copy"
  - "-encoders"
see_also:
  - filters
  - outputs
vocabularies_served:
  own_terms:
    - codec
    - encoder
    - decoder
    - "stream copy"
    - remux
    - transcode
    - libx264
  translations:
    - known_tool: gstreamer
      terms:
        - encoder element
        - "capsfilter"
    - known_tool: handbrake
      terms:
        - "video encoder"
        - preset
  task:
    - "convert a video"
    - "remux without re-encoding"
    - "choose an encoder"
---

`-c:v` and `-c:a` name the encoder for a stream, and `copy` is the special
value that names no encoder at all: the packets are moved into the new
container untouched. Stream copy is the fastest and most lossless thing ffmpeg
does, and it is also the mode that quietly forbids everything else, because
untouched packets cannot be modified.

Two entries live here. An unknown encoder is a name this build does not carry.
ffmpeg is built with a configure-time set of external libraries, so encoder
availability is a property of the binary rather than of the version number, and
`ffmpeg -encoders` is what settles it for the binary actually on the machine.

The other is the conflict between filtering and stream copy. A filtergraph
rewrites frames, which requires decoding and re-encoding, so declaring both
`-vf` and `-c:v copy` is a contradiction and ffmpeg says so instead of silently
dropping one. Naming a real encoder resolves it, at the cost of a re-encode
that stream copy was avoiding. When the goal was only to change container, the
answer is the opposite one: drop the filter and keep the copy.

## Examples

### FFMPEG_UNKNOWN_ENCODER, encoder availability is a property of the build

```
ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx266 out.mp4
# Unknown encoder 'libx266'
ffmpeg -encoders
```

### FFMPEG_FILTER_WITH_STREAMCOPY, filtering and copying are exclusive

```
ffmpeg -i clip.mp4 -vf scale=160:120 -c:v copy out.mp4
# Filtergraph 'scale=160:120' was defined for video output stream 0:0 but codec copy was selected.
# Filtering and streamcopy cannot be used together.
ffmpeg -i clip.mp4 -vf scale=160:120 -c:v libx264 out.mp4
```
