// Registry Website [40]: the markup layer, and the one stylesheet.
//
// EVERY COLOUR THIS SITE RENDERS IS IN THIS FILE. It imports no third-party
// stylesheet, no font service, no icon set and no script, which is what makes
// the contrast question answerable in a unit test at all: the rendered colours
// are the ones written here rather than ones a vendor sets on a hashed class
// somewhere inside node_modules. The stylesheet is generated FROM `PALETTE`,
// so the values the contrast test measures are the values the browser gets.
//
// The markup is plain semantic HTML: one `h1` per page, real landmarks, a skip
// link, a table with real headers. There is no interactive control anywhere,
// on purpose, and `read-only.ts` is what keeps it that way.

/** One colour scheme's rendered colours. */
export interface Scheme {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly muted: string;
  readonly link: string;
  readonly border: string;
}

export const PALETTE: Readonly<Record<'light' | 'dark', Scheme>> = Object.freeze({
  light: Object.freeze({
    background: '#ffffff',
    surface: '#f4f4f5',
    text: '#111827',
    muted: '#44474f',
    link: '#0b4fa8',
    border: '#c9ccd4',
  }),
  dark: Object.freeze({
    background: '#0d1117',
    surface: '#161b22',
    text: '#e6edf3',
    muted: '#b3bfcc',
    link: '#8ab4f8',
    border: '#39414d',
  }),
});

const ESCAPES: Readonly<Record<string, string>> = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/**
 * The one door text takes to reach a page.
 *
 * Everything rendered goes through here, including the served documents, which
 * is what lets `read-only.ts` claim that no document can grow a form: a
 * document is text on this site, never markup, and the audit verifies the
 * claim rather than trusting this function.
 */
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);

const variables = (scheme: Scheme): string =>
  [
    `--background: ${scheme.background}`,
    `--surface: ${scheme.surface}`,
    `--text: ${scheme.text}`,
    `--muted: ${scheme.muted}`,
    `--link: ${scheme.link}`,
    `--border: ${scheme.border}`,
  ].join(';\n    ');

/** The whole stylesheet, inline, so the page loads nothing from anywhere. */
const stylesheet = (): string => `
  :root {
    ${variables(PALETTE.light)};
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root { ${variables(PALETTE.dark)}; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--background);
    color: var(--text);
    font: 16px/1.6 ui-sans-serif, system-ui, sans-serif;
  }
  .skip {
    position: absolute;
    left: -9999px;
  }
  .skip:focus-visible { left: 1rem; top: 1rem; padding: .5rem; background: var(--surface); }
  header, main, footer { max-width: 60rem; margin: 0 auto; padding: 1rem; }
  header { border-bottom: 1px solid var(--border); }
  nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 1rem; margin: 0; padding: 0; }
  a { color: var(--link); }
  a:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
  [aria-current="page"] { font-weight: 700; text-decoration: none; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.25rem; margin-top: 2rem; }
  p.lede { color: var(--muted); }
  table { border-collapse: collapse; width: 100%; }
  caption { text-align: left; color: var(--muted); padding-bottom: .5rem; }
  th, td { border: 1px solid var(--border); padding: .5rem .75rem; text-align: left; vertical-align: top; }
  th { background: var(--surface); }
  td.numeric { text-align: right; font-variant-numeric: tabular-nums; }
  ul.reasons { color: var(--muted); margin: .25rem 0 0; padding-left: 1.25rem; }
  pre.document {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 1rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font: 13px/1.5 ui-monospace, SFMono-Regular, monospace;
  }
  footer { color: var(--muted); border-top: 1px solid var(--border); }
`;

/** One entry in the site's own navigation. Same-document links only. */
interface NavEntry {
  readonly href: string;
  readonly label: string;
}

export const NAVIGATION: readonly NavEntry[] = Object.freeze([
  Object.freeze({ href: 'index.html', label: 'Registry' }),
  Object.freeze({ href: 'spec.html', label: 'Specification' }),
  Object.freeze({ href: 'priming.html', label: 'Priming snippet' }),
  Object.freeze({ href: 'most-wanted.html', label: 'Most wanted' }),
]);

const navigation = (current: string): string =>
  NAVIGATION.map((entry) => {
    const here = entry.href === current;
    const marker = here ? ' aria-current="page"' : '';
    return `<li><a href="${entry.href}"${marker}>${escapeHtml(entry.label)}</a></li>`;
  }).join('\n        ');

export interface PageOptions {
  readonly title: string;
  readonly heading: string;
  /** The nav entry this page IS, so it can mark itself current. */
  readonly current: string;
  readonly body: string;
}

/** The page shell every page on this site shares. */
export const page = (options: PageOptions): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title)}</title>
    <style>${stylesheet()}    </style>
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header>
      <nav aria-label="Primary">
        <ul>
        ${navigation(options.current)}
        </ul>
      </nav>
    </header>
    <main id="main">
      <h1>${escapeHtml(options.heading)}</h1>
${options.body}
    </main>
    <footer>
      <p>comprehendo.dev is a read-only browser over the registry. It accepts no
      submission and collects nothing from anyone who reads it: no analytics, no
      cookies, no script of any kind.</p>
    </footer>
  </body>
</html>
`;
