---
id: comprehendo-wave-6
title: 'The Flagship: ffmpeg'
initiative: comprehendo
initiative_version: 1
status: planned
depends_on: [comprehendo-wave-5]
demo_state: The headline demo runs end-to-end on camera -- an agent given only the priming snippet is asked to crop and transcode a video; its first wrong flag comes back through comprehend(stderr) as a twin whose fixes[0] works; its vocabulary questions answer through docs; the measured session lands within the token budget; first-correction rate on the scripted failure suite is published.
content_hash: f579ebc5801f70e6
---

# Wave 6: The Flagship: ffmpeg

Estimate: 5-7 days (corpus authoring from the ffmpeg pitfall mine is the
bulk). Deliberately staged after the registry so the headline demo
exercises the whole pipeline, not a hand-wired special case.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 32 | ffmpeg Corpus | COMPONENT | 26, 28 |
| 33 | ffmpeg Fingerprints | COMPONENT | 21, 32 |
| 34 | Upstream Watch | COMPONENT | 32 |
