// Corpus Generator [17]: the YAML front-matter subset the topic files use.
//
// A corpus topic is markdown with a YAML header, and this package carries zero
// runtime dependencies, so the header dialect is deliberately small enough to
// read and emit here: strings, lists, and nested maps, two-space indentation,
// nothing else. No numbers, no booleans, no anchors, no multi-line scalars.
// Typed conversion happens one layer up, in format.ts, where the record shapes
// live; keeping this layer untyped is what keeps it total.
//
// The emitter and the parser are a matched pair and are tested as a round trip:
// a header this module writes is a header this module reads back unchanged.

export type YamlValue = string | YamlValue[] | { readonly [key: string]: YamlValue };

interface Line {
  readonly indent: number;
  readonly text: string;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Splits `---\nheader\n---\nbody` into its two halves. */
export function splitFrontMatter(markdown: string): { header: string; body: string } {
  const match = FRONT_MATTER.exec(markdown);
  if (match === null) {
    throw new SyntaxError('topic file has no YAML front matter');
  }
  return { header: match[1] ?? '', body: markdown.slice(match[0].length) };
}

/** The inverse of `splitFrontMatter`, and the only place the fence is written. */
export function joinFrontMatter(header: YamlValue, body: string): string {
  return `---\n${emitYaml(header)}---\n\n${body.replace(/^\n+/, '')}`;
}

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

function parseValueAfterKey(lines: readonly Line[], from: number, parentIndent: number): {
  value: YamlValue;
  next: number;
} {
  const child = lines[from];
  if (child === undefined || child.indent <= parentIndent) {
    // `key:` with nothing under it is an empty map, the same as `key: {}`.
    if (child !== undefined && child.indent === parentIndent && child.text.startsWith('- ')) {
      const end = blockEnd(lines, from, child.indent);
      return { value: parseSequence(lines.slice(from, end), child.indent), next: end };
    }
    return { value: {}, next: from };
  }
  const end = blockEnd(lines, from, child.indent);
  const block = lines.slice(from, end);
  const value = child.text.startsWith('- ')
    ? parseSequence(block, child.indent)
    : parseMapping(block, child.indent);
  return { value, next: end };
}

function parseSequence(lines: readonly Line[], indent: number): YamlValue[] {
  const items: YamlValue[] = [];
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

function parseMapping(lines: readonly Line[], indent: number): Record<string, YamlValue> {
  const map: Record<string, YamlValue> = {};
  let cursor = 0;
  while (cursor < lines.length) {
    const line = lines[cursor];
    if (line === undefined || line.indent !== indent) {
      cursor += 1;
      continue;
    }
    const separator = line.text.indexOf(':');
    if (separator === -1) {
      throw new SyntaxError(`front matter line is not a key: ${line.text}`);
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

/** Reads the subset described at the top of this file. Throws on anything else. */
export function parseYaml(source: string): YamlValue {
  const lines = readLines(source);
  if (lines.length === 0) return {};
  const indent = lines[0]?.indent ?? 0;
  return lines[0]?.text.startsWith('- ') === true
    ? parseSequence(lines, indent)
    : parseMapping(lines, indent);
}

const NEEDS_QUOTES = /^$|^\s|\s$|^[-?:,[\]{}#&*!|>'"%@`]|:\s|\s#/;
const RESERVED = new Set(['true', 'false', 'yes', 'no', 'null', '~', 'on', 'off']);

function emitScalar(value: string): string {
  const numeric = /^-?\d+(\.\d+)?$/.test(value);
  if (NEEDS_QUOTES.test(value) || numeric || RESERVED.has(value.toLowerCase())) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

function emitLines(value: YamlValue, indent: number): string[] {
  const pad = ' '.repeat(indent);
  if (typeof value === 'string') return [`${pad}${emitScalar(value)}`];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const [head, ...tail] = emitLines(item, indent + 2);
      return [`${pad}- ${(head ?? '').trimStart()}`, ...tail];
    });
  }
  return Object.entries(value).flatMap(([key, item]) => {
    if (typeof item === 'string') return [`${pad}${key}: ${emitScalar(item)}`];
    if (Array.isArray(item) && item.length === 0) return [`${pad}${key}: []`];
    if (!Array.isArray(item) && Object.keys(item).length === 0) return [`${pad}${key}: {}`];
    return [`${pad}${key}:`, ...emitLines(item, indent + 2)];
  });
}

/** Writes the subset described at the top of this file, with a trailing newline. */
export function emitYaml(value: YamlValue): string {
  const lines = emitLines(value, 0);
  return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
}
