// Corpus Format [28], the topic-file half: reading a topic's YAML header.
//
// A corpus topic is one markdown file with a small YAML header, and this
// package carries zero runtime dependencies, so the dialect is deliberately
// small enough to read here: strings, lists, and nested maps, two-space
// indentation, nothing else. No numbers, no booleans, no anchors, no
// multi-line scalars. This is the READER only; registry tooling never writes
// an authoring file, Corpus Generator [17] owns that side.
//
// The dialect is the one 17's `front-matter.ts` emits, and it is duplicated
// here rather than imported because registry-tools takes no runtime import
// from core (the packages install independently). Per the duplication rule the
// copy owes a test: `corpus-format-drift.test.ts` parses a topic file 17
// really wrote with BOTH parsers and asserts they agree, which is a stronger
// claim than two literals matching.
//
// `declaredTopics` is the other half of this file's job and the reason the
// fence scanner is here rather than in the parser: "one topic per file" is a
// business rule about the file's own front matter, and the only honest way to
// check it is to find every front-matter fence in the file, not just the first.

/** One topic file, split into its header mapping and its markdown body. */
export interface FrontMatter {
  readonly header: Readonly<Record<string, unknown>>;
  readonly body: string;
  /** Every `topic` a front-matter fence in this file declares. One is the rule. */
  readonly declaredTopics: readonly string[];
}

interface Line {
  readonly indent: number;
  readonly text: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Raised when a topic file carries no header at all. */
export class FrontMatterError extends SyntaxError {}

function readLines(source: string): Line[] {
  const lines: Line[] = [];
  for (const raw of source.split('\n')) {
    const text = raw.replace(/\s+$/, '');
    if (text.trim() === '' || text.trim().startsWith('#')) continue;
    lines.push({ indent: text.length - text.trimStart().length, text: text.trimStart() });
  }
  return lines;
}

function parseScalar(raw: string): string {
  const text = raw.trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

/** Where the block that starts at `from` ends: the first line indented less. */
function blockEnd(lines: readonly Line[], from: number, indent: number): number {
  let end = from;
  while (end < lines.length && (lines[end]?.indent ?? 0) >= indent) end += 1;
  return end;
}

function parseValueAfterKey(
  lines: readonly Line[],
  from: number,
  parentIndent: number,
): { value: unknown; next: number } {
  const child = lines[from];
  if (child === undefined || child.indent <= parentIndent) {
    // A sequence written at the parent's own indentation, which is legal YAML
    // and what an editor left alone usually produces.
    if (child !== undefined && child.indent === parentIndent && child.text.startsWith('- ')) {
      const end = blockEnd(lines, from, child.indent);
      return { value: parseSequence(lines.slice(from, end), child.indent), next: end };
    }
    // `key:` with nothing under it is an empty map, the same as `key: {}`.
    return { value: {}, next: from };
  }
  const end = blockEnd(lines, from, child.indent);
  const block = lines.slice(from, end);
  return {
    value: child.text.startsWith('- ')
      ? parseSequence(block, child.indent)
      : parseMapping(block, child.indent),
    next: end,
  };
}

function parseSequence(lines: readonly Line[], indent: number): unknown[] {
  const items: unknown[] = [];
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined || line.indent !== indent || !line.text.startsWith('- ')) {
      cursor += 1;
      continue;
    }
    const head = line.text.slice(2).trim();
    const end = blockEnd(lines, cursor + 1, indent + 1);
    if (head.endsWith(':') || /^[\w.$-]+:\s/.test(head)) {
      // A map item: its first key sits on the dash line, the rest below it.
      const inner: Line[] = [{ indent: indent + 2, text: head }, ...lines.slice(cursor + 1, end)];
      items.push(parseMapping(inner, indent + 2));
    } else {
      items.push(parseScalar(head));
    }
    cursor = end;
  }
  return items;
}

function parseMapping(lines: readonly Line[], indent: number): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined || line.indent !== indent) {
      cursor += 1;
      continue;
    }
    const separator = line.text.indexOf(':');
    if (separator === -1) {
      throw new FrontMatterError(`front matter line is not a key: ${line.text}`);
    }
    const key = line.text.slice(0, separator).trim();
    const rest = line.text.slice(separator + 1).trim();
    if (rest === '') {
      const parsed = parseValueAfterKey(lines, cursor + 1, indent);
      map[key] = parsed.value;
      cursor = parsed.next;
      continue;
    }
    map[key] = rest === '[]' ? [] : rest === '{}' ? {} : parseScalar(rest);
    cursor += 1;
  }
  return map;
}

/** The header dialect, as a plain mapping. Throws on anything outside it. */
export function parseYamlHeader(source: string): Record<string, unknown> {
  const lines = readLines(source);
  if (lines.length === 0) return {};
  const indent = lines[0]?.indent ?? 0;
  if (lines[0]?.text.startsWith('- ') === true) {
    throw new FrontMatterError('a topic header is a mapping, not a list');
  }
  return parseMapping(lines, indent);
}

/**
 * Every `topic` declared by a front-matter fence anywhere in the file.
 *
 * A `---` line inside a fenced code block is content, not a fence: a topic
 * whose worked example SHOWS a front-matter header is ordinary corpus writing,
 * and reading it as a second topic would fail the honest corpus and pass the
 * dishonest one. Code fences are tracked for exactly that reason.
 */
function declaredTopicsIn(markdown: string): string[] {
  const declared: string[] = [];
  let inCode = false;
  let inFence = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*(```|~~~)/.test(line)) {
      if (!inFence) inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (line === '---') {
      inFence = !inFence;
      continue;
    }
    if (!inFence) continue;
    const named = /^topic:\s*(\S.*)$/.exec(line.trimStart());
    if (named !== null) declared.push(parseScalar(named[1] ?? ''));
  }
  return declared;
}

/**
 * Split `---\nheader\n---\nbody`, parse the header, and record every topic the
 * whole file declares. The FIRST fence is the topic's own header; any further
 * one is what makes `one-topic-per-file` a checkable rule rather than a hope.
 */
export function parseFrontMatter(markdown: string): FrontMatter {
  const match = FENCE.exec(markdown);
  if (match === null) {
    throw new FrontMatterError('topic file has no YAML front matter');
  }
  return Object.freeze({
    header: Object.freeze(parseYamlHeader(match[1] ?? '')),
    body: markdown.slice(match[0].length),
    declaredTopics: Object.freeze(declaredTopicsIn(markdown)),
  });
}
