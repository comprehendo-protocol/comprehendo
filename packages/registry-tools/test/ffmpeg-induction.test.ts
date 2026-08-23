// ffmpeg Corpus [32] against CC4 Folklore Gate [26]: every cataloged twin code
// and every cataloged fix, provoked out of the REAL ffmpeg.
//
// Nothing in this suite asserts that a shape looks plausible. Each test spawns
// the really-installed binary, reads the stderr it really wrote, and routes
// that text through Fingerprint Index & Matcher [21]'s REAL index built from
// this corpus's own twins. A fix carrying an `apply` is proved the only way 26
// accepts: apply it to the same failing argument vector, run it again, and
// watch the retry really succeed.
//
// The two dispositions the doc's Acceptance Criteria demand are proved as
// claims, not as labels:
//   - a FENCE claims the mistake cannot be expressed, which is a claim about a
//     CLASS, so `scale=-2` is run over three different sources rather than
//     over the one that provoked it;
//   - a HEAL claims a silent, SAFE correction, so each heal is also run on the
//     case that was already working, and must leave it unchanged.
//
// A missing binary fails this suite loudly (see ffmpeg-cli.ts): a green run
// that induced nothing is exactly the folklore the rule exists to catch.

import { beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import type { FingerprintIndex } from '../src/fingerprint.js';
import { fixKey } from '../src/gate-upstream.js';
import {
  INDUCE_PREFIX,
  applyToArgv,
  dimensions,
  makeVideo,
  requireFfmpeg,
  run,
  streamKinds,
  workspace,
} from './helpers/ffmpeg-cli.js';
import { indexOf, induceOne, loadFfmpegCorpus } from './helpers/ffmpeg-corpus.js';
import { FENCE_SOURCES, WITNESSES, scaleArgv, withAudioFixture } from './helpers/ffmpeg-witnesses.js';

let corpus: CorpusSource;
let index: FingerprintIndex;
let version: string;

beforeAll(() => {
  version = requireFfmpeg();
  corpus = loadFfmpegCorpus();
  index = indexOf(corpus);
});

describe('the induction runs against a real ffmpeg', () => {
  it('is the real binary, and says which build it induced against', () => {
    expect(version).toMatch(/^ffmpeg version /);
  });

  it('catalogs nothing no witness provokes, and provokes nothing it does not catalog', () => {
    const cataloged = corpus.twins.map((twin) => twin.code).sort();
    const witnessed = WITNESSES.map((witness) => witness.code).sort();

    expect(witnessed).toEqual(cataloged);
  });
});

describe.each(WITNESSES.map((witness) => [witness.code, witness] as const))(
  'the cataloged failure %s',
  (code, witness) => {
    it('really fails, really writes the cataloged text, and really routes to itself', () => {
      const induced = induceOne(code, index);

      expect(induced.status).not.toBe(0);
      expect(induced.stderr).toContain(witness.stderr);
      expect(induced.outcome).toBe('matched');
      expect(induced.matched).toBe(code);
    });
  },
);

describe('every fix carrying an apply resolves its induced failure on retry', () => {
  const applied = (): readonly {
    readonly code: string;
    readonly title: string;
    readonly apply: unknown;
    readonly argv: readonly string[];
  }[] =>
    corpus.twins.flatMap((twin) => {
      const witness = WITNESSES.find((entry) => entry.code === twin.code);
      if (witness === undefined) return [];
      return (corpus.fixes[twin.id] ?? [])
        .filter((fix) => fix.apply !== undefined)
        .map((fix) => ({
          code: twin.code,
          title: fix.title,
          apply: fix.apply,
          argv: witness.argv,
        }));
    });

  it('carries at least one executable fix, so this suite is not vacuous', () => {
    expect(applied().length).toBeGreaterThan(0);
  });

  it('proves each one by applying it and rerunning the same invocation', () => {
    const declared = corpus.declaredSchema?.operations ?? [];
    const proved: string[] = [];

    for (const fix of applied()) {
      const witness = WITNESSES.find((entry) => entry.code === fix.code);
      const site = workspace();
      try {
        witness?.setup?.(site.path);
        const failed = run(fix.argv, site.path);
        expect(failed.status).not.toBe(0);

        const corrected = applyToArgv(fix.argv, fix.apply, declared);
        expect(corrected).not.toEqual(fix.argv);
        const retried = run(corrected, site.path);

        expect(
          retried.status,
          `${fix.code} :: ${fix.title} did not resolve on retry:\n${retried.stderr}`,
        ).toBe(0);
        proved.push(fixKey(fix.code, fix.title));
      } finally {
        site.cleanup();
      }
    }

    expect(proved).toEqual(applied().map((fix) => fixKey(fix.code, fix.title)));
  });

  it('refuses an apply naming an option the declared schema does not carry', () => {
    expect(() =>
      applyToArgv(['-i', 'in.mp4', 'out.mp4'], { '-vsync': '0' }, ['-i', '-vf']),
    ).toThrow(/does not declare/);
  });
});

describe('the fence: an odd derived dimension cannot be expressed with scale=-2', () => {
  it('fails with -1 on two of three sources and succeeds with -2 on all three', () => {
    const site = workspace();
    try {
      const observed = FENCE_SOURCES.map((source) => {
        const derived = run(scaleArgv(source.size, 'scale=-1:50'), site.path);
        const fenced = run(scaleArgv(source.size, 'scale=-2:50'), site.path);
        return {
          size: source.size,
          derivedStatus: derived.status,
          derivedText: derived.stderr,
          fencedStatus: fenced.status,
          fencedSize: fenced.status === 0 ? dimensions(site.path, 'out.mp4') : '',
        };
      });

      // The two sources whose derived width comes out odd.
      expect(observed[0]?.derivedStatus).not.toBe(0);
      expect(observed[0]?.derivedText).toContain('width not divisible by 2 (101x50)');
      expect(observed[1]?.derivedStatus).not.toBe(0);
      expect(observed[1]?.derivedText).toContain('width not divisible by 2 (151x50)');

      // The fenced form on every one of them, including the source the
      // unfenced form already handled: a fence that changes a working case is
      // not safe, and a fence proved on one input is not a fence.
      expect(observed.map((seen) => seen.fencedStatus)).toEqual([0, 0, 0]);
      expect(observed.map((seen) => seen.fencedSize)).toEqual(['102,50', '152,50', '76,50']);

      // The already-working source: derived and fenced agree exactly.
      expect(observed[2]?.derivedStatus).toBe(0);
    } finally {
      site.cleanup();
    }
  });

  it('keeps the requested height exactly, so the fence preserves the intent', () => {
    const site = workspace();
    try {
      const fenced = run(scaleArgv('1442x1440', 'scale=-2:720'), site.path);

      expect(fenced.status).toBe(0);
      expect(dimensions(site.path, 'out.mp4')).toBe('722,720');
    } finally {
      site.cleanup();
    }
  });
});

describe('FFMPEG_ODD_DIMENSION covers both axes, not only width', () => {
  // Found by review: the pattern originally read `*width not divisible by 2
  // (*)*`, so a real, equally common mirror failure (an odd HEIGHT) never
  // matched at all, despite the scaling topic's own prose already claiming
  // to cover "an odd width or height". Widened to `* not divisible by 2
  // (*)*`. Proved here against a real, independently chosen source (not
  // copied from FENCE_SOURCES), on the height axis specifically.
  it('really fails on an odd height, and really routes to the same twin as an odd width', () => {
    const site = workspace();
    try {
      const heightOdd = run(scaleArgv('100x301', 'scale=50:-1'), site.path);

      expect(heightOdd.status).not.toBe(0);
      expect(heightOdd.stderr).toContain('height not divisible by 2 (50x151)');
      const match = index.match(heightOdd.stderr);
      expect(match.outcome).toBe('matched');
      expect(match.outcome === 'matched' ? match.entry.corpusEntryId : undefined).toBe(
        'FFMPEG_ODD_DIMENSION',
      );

      const fenced = run(scaleArgv('100x301', 'scale=50:-2'), site.path);
      expect(fenced.status).toBe(0);
      expect(dimensions(site.path, 'out.mp4')).toBe('50,150');
    } finally {
      site.cleanup();
    }
  });
});

describe('FFMPEG_INPUT_NOT_FOUND: a disclosed, not a hidden, ambiguity', () => {
  // Found by review: the same "<path>: No such file or directory" text is
  // what ffmpeg prints for a missing OUTPUT directory too, and the format's
  // literal-plus-wildcard pattern language cannot distinguish the two
  // (ffmpeg's own message never names which argument the path came from).
  // Rather than a false-precision pattern trick, the twin's reason, its fix
  // title, and the inputs topic were all corrected to say so honestly: this
  // test is what keeps that claim from silently going stale. If this ever
  // starts failing, the corpus's own honesty claim (not a bug fix) needs to
  // be revisited alongside it.
  it('an output directory that does not exist really produces the identical stderr shape, and still routes to FFMPEG_INPUT_NOT_FOUND', () => {
    const site = workspace();
    try {
      makeVideo(site.path, 'clip.mp4', '64x64');
      const missingOutputDir = run(
        [...INDUCE_PREFIX, '-i', 'clip.mp4', '-y', 'nonexistentdir/out.mp4'],
        site.path,
      );

      expect(missingOutputDir.status).not.toBe(0);
      expect(missingOutputDir.stderr).toContain('nonexistentdir/out.mp4: No such file or directory');
      const match = index.match(missingOutputDir.stderr);
      expect(match.outcome).toBe('matched');
      expect(match.outcome === 'matched' ? match.entry.corpusEntryId : undefined).toBe(
        'FFMPEG_INPUT_NOT_FOUND',
      );
    } finally {
      site.cleanup();
    }
  });
});

describe('the heals: silent, and safe on the case that was already correct', () => {
  it('the optional stream map leaves a present audio stream exactly where it was', () => {
    const site = workspace();
    try {
      withAudioFixture(site.path);
      const argv = [
        '-hide_banner',
        '-nostdin',
        '-i',
        'av.mp4',
        '-map',
        '0:v',
        '-map',
        '0:a',
        '-c',
        'copy',
        '-y',
        'out.mp4',
      ];

      const before = run(argv, site.path);
      expect(before.status).toBe(0);
      const kindsBefore = streamKinds(site.path, 'out.mp4');

      const healed = run(
        applyToArgv(argv, { '-map': ['0:v', '0:a?'] }, corpus.declaredSchema?.operations ?? []),
        site.path,
      );
      expect(healed.status).toBe(0);

      expect(streamKinds(site.path, 'out.mp4')).toEqual(kindsBefore);
      expect(kindsBefore).toEqual(['video', 'audio']);
    } finally {
      site.cleanup();
    }
  });

  it('naming a video encoder is harmless when no filtergraph is present', () => {
    const site = workspace();
    try {
      const source = run(
        [
          '-hide_banner',
          '-nostdin',
          '-f',
          'lavfi',
          '-i',
          'testsrc=size=320x240:rate=10:duration=1',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-y',
          'clip.mp4',
        ],
        site.path,
      );
      expect(source.status).toBe(0);

      const healed = run(
        applyToArgv(
          ['-hide_banner', '-nostdin', '-i', 'clip.mp4', '-y', 'out.mp4'],
          { '-c:v': 'libx264' },
          corpus.declaredSchema?.operations ?? [],
        ),
        site.path,
      );

      expect(healed.status).toBe(0);
      expect(streamKinds(site.path, 'out.mp4')).toEqual(['video']);
    } finally {
      site.cleanup();
    }
  });
});
