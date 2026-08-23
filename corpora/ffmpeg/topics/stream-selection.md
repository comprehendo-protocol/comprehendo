---
topic: stream-selection
status: ready
stub_fields: []
signatures:
  - "-map <input>:<kind>[:<index>]"
  - "-map 0:a?"
  - "-map [label]"
see_also:
  - inputs
  - codecs
vocabularies_served:
  own_terms:
    - map
    - stream
    - "stream specifier"
    - "-map"
    - "optional stream"
  translations:
    - known_tool: gstreamer
      terms:
        - pad
        - "select-stream"
    - known_tool: mkvmerge
      terms:
        - "track selection"
  task:
    - "keep only the video track"
    - "copy the audio track"
    - "handle files that may have no audio"
---

Without `-map`, ffmpeg picks one stream of each kind by its own default rules.
With `-map`, the selection becomes explicit and the defaults switch off
entirely, so every stream that should reach the output needs its own `-map`.
A specifier is an input index, a kind, and an optional stream index, so `0:v`
is the video of the first input and `0:a:1` is its second audio stream.

An explicit selection is a claim about what the input contains, and a claim
that turns out false is an error rather than an empty result. Batch work is
where this bites: a folder of clips where one has no audio fails on that one,
after the others already succeeded.

A trailing `?` makes a specifier optional. It selects the stream when it is
there and contributes nothing when it is not, so the output carries the audio
in exactly the cases the unmarked form did. That is why this entry is a heal
rather than a runbook: the correction changes nothing about a command that
already worked, and the only behavior it removes is the abort. It is the wrong
answer when a missing track means the input is broken, in which case the abort
was the useful signal.

## Examples

### FFMPEG_MAP_MATCHES_NO_STREAM, an explicit selection is a claim about the input

```
ffmpeg -i video-only.mp4 -map 0:v -map 0:a -c copy out.mp4
# Stream map '0:a' matches no streams.
# To ignore this, add a trailing '?' to the map.
```

### The heal: an optional specifier, same result when the stream is there

```
ffmpeg -i video-only.mp4 -map 0:v -map 0:a? -c copy out.mp4
# succeeds, output carries video only
ffmpeg -i with-audio.mp4 -map 0:v -map 0:a? -c copy out.mp4
# succeeds, output carries video and audio, exactly as the unmarked form did
```
