// Corpus Generator [17]: the grep-level lexer the target scan reads through.
//
// Deliberately NOT the TypeScript compiler API. This package carries zero
// runtime dependencies (scanned in CI), and `typescript` is a devDependency:
// a module under src/ importing it would make the compiler a runtime
// dependency of the published core. So the scan is a small lexer over the
// target's source text, the same technique this package's own CC1/CC9 scans
// already use, and it is honest about its limits: what it cannot resolve it
// leaves as a stub for a human rather than guessing.

/**
 * Replace every line and block comment with spaces, preserving length and line
 * breaks so offsets and line numbers still line up. String and template
 * literals are left intact, because the scan has to read the message a throw
 * site was constructed with.
 *
 * Known limitation of a lexer this small, stated rather than hidden: a regex
 * literal containing a quote character (`/don't/`) confuses the string state.
 * A target that carries one gets a slightly wrong scan of that file, never a
 * crash, and never a silently invented corpus field.
 */
export function blankComments(source: string): string {
  const out = source.split('');
  let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' = 'code';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (state === 'code') {
      if (char === '/' && next === '/') state = 'line';
      else if (char === '/' && next === '*') state = 'block';
      else if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') state = 'template';
      if (state === 'line' || state === 'block') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
      }
      continue;
    }
    if (state === 'line') {
      if (char === '\n') state = 'code';
      else out[i] = ' ';
      continue;
    }
    if (state === 'block') {
      if (char === '*' && next === '/') {
        out[i] = ' ';
        out[i + 1] = ' ';
        i += 1;
        state = 'code';
      } else if (char !== '\n') {
        out[i] = ' ';
      }
      continue;
    }
    if (char === '\\') {
      i += 1;
      continue;
    }
    if (
      (state === 'single' && char === "'") ||
      (state === 'double' && char === '"') ||
      (state === 'template' && char === '`')
    ) {
      state = 'code';
    }
  }
  return out.join('');
}

/** 1-based line number of a character offset. */
export const lineAt = (source: string, offset: number): number =>
  source.slice(0, offset).split('\n').length;

const OPENERS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}', '<': '>' };

/**
 * Scan forward from `from` until one of `stops` is met at bracket depth zero,
 * returning that offset, or -1. Angle brackets count as brackets so a generic
 * parameter list does not end a declaration header early.
 */
export function scanTo(code: string, from: number, stops: readonly string[]): number {
  const stack: string[] = [];
  for (let i = from; i < code.length; i += 1) {
    const char = code[i] ?? '';
    if (stack.length === 0 && stops.includes(char)) return i;
    if (char === '=' && code[i + 1] === '>' && stack.length === 0 && stops.includes('=>')) return i;
    const closer = OPENERS[char];
    if (closer !== undefined) {
      stack.push(closer);
      continue;
    }
    if (stack.length > 0 && char === stack[stack.length - 1]) stack.pop();
  }
  return -1;
}

/** The first string literal in a call's argument list, unquoted, or ''. */
export function firstStringArgument(code: string, openParen: number): string {
  const close = scanTo(code, openParen + 1, [')']);
  const args = code.slice(openParen + 1, close === -1 ? code.length : close);
  const match = /(['"`])((?:[^\\]|\\.)*?)\1/.exec(args);
  const literal = match?.[2] ?? '';
  // A template literal's interpolations are not part of the pattern a corpus
  // can match on, so the pattern stops at the first one.
  return literal.split('${')[0]?.trim() ?? '';
}

/** Collapse a declaration header to one line, the way a signature reads. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();
