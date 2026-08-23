// Registry Website [40] AC4: no form or endpoint on the site accepts a corpus
// submission, checked structurally rather than asserted in prose.
//
// The subject is the site's OWN OUTPUT, every file of it, and the audit runs
// inside the generator: a site carrying a write surface is never written at
// all. The mutation half is what makes that claim worth anything, so each
// pattern is fed a real page with the surface injected and must be caught by
// name.
//
// WHAT THE AUDIT READS, AND WHY. Markup rules are applied to the pages the
// site AUTHORS. A served document (`spec.md`, `priming.md`) is copied bytes,
// inert, and never interpreted: applying markup rules to it would mean a
// specification that merely mentions a form in prose could not be published.
// Its guarantee is a different and equally structural one, proven here and in
// `build-cli.test.ts`: it is byte-identical to its source, and the page that
// displays it escapes it, so a document can never become markup. What IS
// refused everywhere is an executable asset: a static site that emits a script
// file has grown a surface, whatever the pages say.
//
// The contrast cases belong here for a related reason: this site imports no
// third-party stylesheet, so the rendered colours ARE the ones in this
// repository's own source, and the ratio is computable from them. That is the
// honest write-time check for an artifact with no vendor CSS; it is not a
// substitute for a rendered gate on a page that mounts one.
//
// @see .mdd/docs/40-registry-website.md

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildSite } from '../src/pages.ts';
import type { SiteModel } from '../src/pages.ts';
import { auditReadOnly, renderFinding } from '../src/read-only.ts';
import type { EmittedFile } from '../src/read-only.ts';
import { listingOf } from '../src/registry.ts';
import { PALETTE, escapeHtml } from '../src/render.ts';
import { loadFfmpeg } from './support.ts';

async function model(over: Partial<SiteModel> = {}): Promise<SiteModel> {
  const { corpus, packed } = await loadFfmpeg();
  return {
    listings: [listingOf({ directory: 'ffmpeg', corpus, packed })],
    spec: { source: 'MDs/comprehendo-spec.md', text: '# Comprehendo Protocol Specification\n' },
    priming: { source: 'packages/spec/priming.md', text: 'The packages here speak Comprehendo.\n' },
    mostWanted: { kind: 'ok', repository: 'comprehendo-protocol/registry', requests: [] },
    ...over,
  };
}

describe('the generated site carries no write surface', () => {
  it('emits pages, and the audit finds nothing in any of them', async () => {
    const files = buildSite(await model());

    assert.ok(files.length >= 5, `expected a whole site, got ${String(files.length)} files`);
    assert.deepEqual(auditReadOnly(files), []);
  });

  it('audits every html page, not only the first', async () => {
    const pages = buildSite(await model()).filter((file) => file.path.endsWith('.html'));

    assert.ok(pages.length >= 4);
    for (const file of pages) assert.deepEqual(auditReadOnly([file]), []);
  });

  it('emits only static documents: no script file, no anything executable', async () => {
    const files = buildSite(await model());

    for (const file of files) {
      assert.match(file.path, /\.(html|md)$/, `${file.path} is not a static document`);
    }
  });
});

describe('the audit has teeth', () => {
  const caught = (contents: string): readonly string[] =>
    auditReadOnly([{ path: 'index.html', contents }]).map((found) => found.rule);

  it('catches a form', () => {
    assert.ok(caught('<main><form action="/submit"></form></main>').includes('form'));
  });

  it('catches a POST method declaration', () => {
    assert.ok(caught('<div method="POST"></div>').includes('write-method'));
  });

  it('catches an input, a textarea and a button', () => {
    assert.ok(caught('<input name="corpus">').includes('input-control'));
    assert.ok(caught('<textarea></textarea>').includes('input-control'));
    assert.ok(caught('<button>submit</button>').includes('input-control'));
  });

  it('catches script, whether a tag or an inline handler', () => {
    assert.ok(caught('<script>alert(1)</script>').includes('script'));
    assert.ok(caught('<a onclick="go()">x</a>').includes('inline-handler'));
  });

  it('catches anything a visitor browser would call out for', () => {
    assert.ok(caught('<img src="https://tracker.invalid/p.gif">').includes('remote-subresource'));
    assert.ok(caught('<iframe src="/x"></iframe>').includes('embedded-frame'));
    assert.ok(
      caught('<link rel="stylesheet" href="https://cdn.invalid/a.css">').includes(
        'remote-subresource',
      ),
    );
    assert.ok(
      caught('<style>@import url(https://cdn.invalid/a.css);</style>').includes(
        'remote-subresource',
      ),
    );
  });

  it('catches an executable asset whatever the pages say', () => {
    const found = auditReadOnly([{ path: 'analytics.js', contents: 'navigator.sendBeacon(1)' }]);

    assert.deepEqual(found.map((entry) => entry.rule), ['executable-asset']);
  });

  it('leaves a plain outbound link alone: an anchor is not a request', () => {
    assert.deepEqual(caught('<a href="https://github.com/comprehendo-protocol">registry</a>'), []);
  });

  it('catches an inline handler even when the value is unquoted', () => {
    // HTML permits an unquoted attribute value, so `onclick=alert(1)` is a
    // real event handler with no surrounding `"` or `'` for a naive pattern
    // to anchor on. Found by review: the prior pattern required a quote
    // character right after `=` and let this shape through undetected.
    assert.ok(caught('<a onclick=alert(1)>x</a>').includes('inline-handler'));
  });

  it('catches a remote subresource named through srcset or a CSS url(), not only src', () => {
    // `\bsrc` requires a word boundary, so it never matches `srcset` (the
    // "c" and "s" of "src" and "set" are not a boundary). Found by review:
    // an <img srcset> or a `style="background:url(...)"` pointed at a third
    // party told it who was reading, uncaught.
    assert.ok(
      caught('<img srcset="https://tracker.invalid/p.png 1x">').includes('remote-subresource'),
    );
    assert.ok(
      caught('<div style="background:url(https://tracker.invalid/p.png)">').includes(
        'remote-subresource',
      ),
    );
  });

  it('names where it found what it found', () => {
    const found = auditReadOnly([{ path: 'most-wanted.html', contents: 'ok\n<form></form>\n' }]);

    assert.equal(found[0]?.path, 'most-wanted.html');
    assert.equal(found[0]?.line, 2);
    assert.match(renderFinding(found[0] as (typeof found)[number]), /most-wanted\.html:2/);
  });
});

describe('a served document can never become markup', () => {
  it('escapes the five characters that would let it', () => {
    assert.equal(
      escapeHtml('<a href="x" & \'y\'>'),
      '&lt;a href=&quot;x&quot; &amp; &#39;y&#39;&gt;',
    );
  });

  it('serves a document containing a form without the site growing one', async () => {
    const hostile = '<form action="/steal"><input name="a"></form>\n';
    const files: readonly EmittedFile[] = buildSite(
      await model({ spec: { source: 'MDs/comprehendo-spec.md', text: hostile } }),
    );

    assert.deepEqual(auditReadOnly(files), []);
    const served = files.find((file) => file.path === 'spec.md');
    assert.equal(served?.contents, hostile);
    const rendered = files.find((file) => file.path === 'spec.html');
    assert.ok(rendered?.contents.includes('&lt;form action=&quot;/steal&quot;&gt;'));
  });
});

/** WCAG relative luminance, from the sRGB hex the stylesheet really carries. */
function luminance(hex: string): number {
  const channel = (at: number): number => {
    const raw = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return raw <= 0.03928 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function ratio(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b));
  const low = Math.min(luminance(a), luminance(b));
  return (high + 0.05) / (low + 0.05);
}

describe('the palette clears the contrast floor in both colour schemes', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: body text, muted text and links are all at least 4.5 to 1`, () => {
      const colours = PALETTE[scheme];
      for (const [name, colour] of [
        ['text', colours.text],
        ['muted', colours.muted],
        ['link', colours.link],
      ] as const) {
        for (const [surface, against] of [
          ['background', colours.background],
          ['surface', colours.surface],
        ] as const) {
          const measured = ratio(colour, against);
          assert.ok(
            measured >= 4.5,
            `${scheme} ${name} on ${surface} is ${measured.toFixed(2)}:1`,
          );
        }
      }
    });
  }
});
