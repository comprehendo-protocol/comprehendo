---
topic: scaling
status: ready
stub_fields: []
signatures:
  - "-vf scale=<w>:<h>"
  - "-vf scale=-2:<h>"
  - "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2"
see_also:
  - filters
  - codecs
vocabularies_served:
  own_terms:
    - scale
    - resize
    - "aspect ratio"
    - "chroma subsampling"
    - yuv420p
    - iw
    - ih
  translations:
    - known_tool: imagemagick
      terms:
        - resize
        - geometry
    - known_tool: ffmpeg-python
      terms:
        - "filter('scale')"
  task:
    - "resize a video"
    - "downscale to 720p"
    - "keep the aspect ratio"
---

`scale=w:h` resizes a video, and either axis may be given as `-1` to derive it
from the other while preserving the aspect ratio. That convenience produces
whatever the arithmetic yields, and roughly half of all sources yield an odd
number.

H.264 in yuv420p subsamples chroma by two in each direction, so an odd width or
height has no representation, and libx264 refuses the frame size rather than
rounding it. The refusal quotes the size it was handed, which is the fastest
way to see the number came from the derivation and not from the command.

`-2` removes the class rather than the case: it derives the value exactly as
`-1` does, then rounds to a multiple of two, so no source dimension and no
target size can produce an odd result. The requested axis stays exact, so
`scale=-2:720` is still 720 tall. With both axes explicit, the same guarantee
is written `scale=trunc(iw/2)*2:trunc(ih/2)*2`.

## Examples

### FFMPEG_ODD_DIMENSION, the derived width is whatever the arithmetic gives

```
ffmpeg -i clip-1442x1440.mp4 -vf scale=-1:720 -c:v libx264 out.mp4
# [libx264 @ 0x...] width not divisible by 2 (721x720)
# Error initializing output stream 0:0 -- Error while opening encoder for output stream #0:0
```

### The fence: -2 derives and rounds, so odd cannot be expressed

```
ffmpeg -i clip-1442x1440.mp4 -vf scale=-2:720 -c:v libx264 out.mp4
# 722x720: requested height exact, derived width even
ffmpeg -i clip.mp4 -vf scale=trunc(iw/2)*2:trunc(ih/2)*2 -c:v libx264 out.mp4
# both axes explicit, same guarantee
```
