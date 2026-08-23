// Registry Website [40]: the read-only audit, run over the site's own output.
//
// "This is not a submission portal" is the load-bearing constraint of the whole
// feature, and prose cannot hold it. This module is the structural form of the
// claim: the generator hands every file it is about to write to `auditReadOnly`
// and writes nothing at all if anything comes back. The submission channel is a
// pull request against the registry repository (Submission Gate [29]); a site
// that grew a form would be a second channel nobody gated.
//
// WHAT IS AUDITED, AND WHAT IS NOT. The markup rules judge the pages this site
// AUTHORS. A served document (`spec.md`, `priming.md`) is copied bytes, inert,
// and is not markup: applying markup rules to it would mean a specification
// that merely mentions a form in prose could not be published. What holds for
// the documents instead is stricter and is checked here too: the page that
// displays a document must carry it ESCAPED, so a `<pre>` block containing a
// raw `<` is itself a finding, and the escaped region is then masked out of the
// markup scan rather than being read as though the site had written it.
//
// An emitted file that is not a document or a page is refused outright. A
// static site that ships a script file has grown a surface whatever its pages
// say, and this is the rule that notices.

/** One file the generator is about to write. */
export interface EmittedFile {
  readonly path: string;
  readonly contents: string;
}

/** A write surface found in emitted output, named where it was found. */
export interface WriteSurfaceFinding {
  readonly path: string;
  readonly line: number;
  readonly rule: string;
  readonly excerpt: string;
}

/** The only two things this site emits. Everything else is a finding. */
const PAGE = /\.html$/;
const DOCUMENT = /\.md$/;

interface Rule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly why: string;
}

/**
 * Every shape a write surface, a script, or a visitor-side call-out can take in
 * hand-written markup. A floor, not a proof, in exactly the sense Submission
 * Gate [29]'s danger and injection tables are: what makes it worth having is
 * that the generator emits a fixed set of pages, so anything matching here is
 * a change somebody made on purpose.
 */
const RULES: readonly Rule[] = Object.freeze([
  Object.freeze({ name: 'form', pattern: /<\s*form\b/i, why: 'a form is a submission channel' }),
  Object.freeze({
    name: 'input-control',
    pattern: /<\s*(input|textarea|select|button)\b/i,
    why: 'an input control exists to send something somewhere',
  }),
  Object.freeze({
    name: 'write-method',
    pattern: /\bmethod\s*=\s*["']?\s*(post|put|patch|delete)\b/i,
    why: 'a write method names an endpoint that accepts writes',
  }),
  Object.freeze({
    name: 'form-action',
    pattern: /(\bformaction|\saction)\s*=/i,
    why: 'an action attribute names where a submission would go',
  }),
  Object.freeze({
    name: 'script',
    pattern: /<\s*\/?\s*script\b|javascript:/i,
    why: 'this site runs no script in a visitor browser',
  }),
  Object.freeze({
    name: 'inline-handler',
    pattern: /\son[a-z]+\s*=\s*(["'][^"']*["']|[^\s>]+)/i,
    why: 'an inline event handler is a script',
  }),
  Object.freeze({
    name: 'client-network',
    pattern: /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|document\.cookie/,
    why: 'nothing on this site talks to anything from a visitor browser',
  }),
  Object.freeze({
    name: 'remote-subresource',
    pattern:
      /\b(src|srcset|poster)\s*=\s*["']?(https?:)?\/\/|<\s*link\b[^>]*\bhref\s*=\s*["']?(https?:)?\/\/|url\(\s*["']?(https?:)?\/\//i,
    why: 'a remote subresource tells a third party who is reading',
  }),
  Object.freeze({
    name: 'embedded-frame',
    pattern: /<\s*(iframe|frame|object|embed|portal)\b/i,
    why: 'an embedded document is a surface this site does not control',
  }),
  Object.freeze({
    name: 'editable',
    pattern: /\bcontenteditable\b/i,
    why: 'an editable region is an input control with better manners',
  }),
]);

/**
 * Blank out every `<pre>` block, keeping the line count, so a served document
 * is never read as markup the site wrote. A raw `<` or `>` inside one means the
 * escaping failed, which is reported rather than masked.
 */
function maskDocuments(contents: string, path: string): { text: string; found: WriteSurfaceFinding[] } {
  const found: WriteSurfaceFinding[] = [];
  const text = contents.replace(/(<pre\b[^>]*>)([\s\S]*?)(<\/pre>)/gi, (whole, open: string, inner: string, close: string) => {
    if (/[<>]/.test(inner)) {
      const at = contents.slice(0, contents.indexOf(whole)).split('\n').length;
      found.push({
        path,
        line: at,
        rule: 'unescaped-document',
        excerpt: inner.slice(inner.search(/[<>]/), inner.search(/[<>]/) + 60).trim(),
      });
      return whole;
    }
    return `${open}${'\n'.repeat((inner.match(/\n/g) ?? []).length)}${close}`;
  });
  return { text, found };
}

/**
 * Every write surface in everything the site is about to write.
 *
 * Pure, and never throws: this runs inside the generator, and a refusal is data
 * so one run reports every surface at once, the way Corpus Format [28]'s
 * violations and [29]'s findings do.
 */
export function auditReadOnly(files: readonly EmittedFile[]): readonly WriteSurfaceFinding[] {
  const findings: WriteSurfaceFinding[] = [];

  for (const file of files) {
    if (DOCUMENT.test(file.path)) continue;
    if (!PAGE.test(file.path)) {
      findings.push({
        path: file.path,
        line: 1,
        rule: 'executable-asset',
        excerpt: file.path,
      });
      continue;
    }

    const masked = maskDocuments(file.contents, file.path);
    findings.push(...masked.found);
    const lines = masked.text.split('\n');
    lines.forEach((line, at) => {
      for (const rule of RULES) {
        const hit = rule.pattern.exec(line);
        if (hit === null) continue;
        findings.push({
          path: file.path,
          line: at + 1,
          rule: rule.name,
          excerpt: line.slice(Math.max(0, hit.index - 10), hit.index + 60).trim(),
        });
      }
    });
  }

  return Object.freeze(findings);
}

/** One finding as the line the generator prints before refusing to write. */
export const renderFinding = (found: WriteSurfaceFinding): string =>
  `${found.path}:${String(found.line)}: ${found.rule}: ${found.excerpt}`;
