---
topic: inputs
status: ready
stub_fields: []
signatures:
  - "-i <url>"
  - "-f <demuxer> -i <url>"
  - "-f lavfi -i testsrc=size=<WxH>:rate=<n>:duration=<s>"
see_also:
  - outputs
  - stream-selection
vocabularies_served:
  own_terms:
    - input
    - demuxer
    - "-i"
    - lavfi
    - testsrc
    - anullsrc
  translations:
    - known_tool: imagemagick
      terms:
        - "input image"
        - "read file"
    - known_tool: gstreamer
      terms:
        - filesrc
        - source element
  task:
    - "open a video file"
    - "read a media file"
    - "generate a test clip"
---

Every `-i` introduces one input, and ffmpeg resolves and probes each one
before any encoding starts, so an input problem surfaces first and stops the
run at exit 1. Two failures dominate here and they are different failures
wearing similar words. A path ffmpeg cannot open reports the path plus the
operating system's own reason, and is a path or permission problem. A path
ffmpeg opens and cannot understand reports invalid data, and is a format
problem: the bytes are there, and no demuxer claims them.

The "cannot open" message is not input-specific despite living in this
topic: a missing OUTPUT directory prints the identical
`<path>: No such file or directory`. Check every `-i` first, the more
common mistake, then the output path.

The second one is where a wrong assumption hides longest, because the file
exists and looks fine to a shell. A text file, an HTML error page saved with a
media extension, and a zero-byte download all reach that message. `ffprobe` on
the same path names what ffmpeg thinks it is holding, which settles the
question in one command.

Inputs need not be files. `-f lavfi` synthesizes one, so `testsrc` and
`anullsrc` give a deterministic clip with no external media, which is how every
failure in this corpus is reproduced.

## Examples

### FFMPEG_INPUT_NOT_FOUND, the path is resolved before anything is decoded

```
ffmpeg -i does-not-exist.mp4 out.mp4
# does-not-exist.mp4: No such file or directory
```

### FFMPEG_INVALID_INPUT_DATA, the file opens and no demuxer claims it

```
ffmpeg -i notes.txt out.mp4
# notes.txt: Invalid data found when processing input
ffprobe notes.txt
```

### A synthetic input, so a reproduction needs no media file

```
ffmpeg -f lavfi -i testsrc=size=320x240:rate=10:duration=1 -c:v libx264 clip.mp4
```
