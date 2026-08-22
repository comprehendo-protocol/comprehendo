// Fingerprint Index & Matcher [21], the facet half: the pure, testable parts
// the index and the matcher are made of, extracted from the construction path
// in `fingerprint.ts` because one file does one job (the same split core makes
// between `twin.ts` and `twin-validate.ts`).
//
// Nothing here builds an index or allocates a twin. Every function is a pure
// value-to-value transform: does this text match this pattern, does this stack
// carry these frames, what can be observed of this raw value, which of an
// entry's declared facets hold, and is this corpus entry compilable at all.
// `fingerprint.ts` re-exports all of it, so consumers still import one module.

/**
 * What a fingerprint matches against. `runtime-error` is a caught error or
 * stderr text, the only kind the matcher runs. `static-pattern` (matching
 * source rather than runtime errors, surfaced by the zod sample corpus) is an
 * open Wave-1 design question: who runs it is not yet decided, so the format
 * carries it and the runtime matcher ignores it rather than foreclosing the
 * decision.
 */
export type FingerprintKind = 'runtime-error' | 'static-pattern';

/** The three facets a fingerprint can declare. Order is the report order. */
export const FACETS = Object.freeze(['errorClass', 'messagePattern', 'stackShape'] as const);

export type Facet = (typeof FACETS)[number];

/** One compiled fingerprint: the doc's Data Model, plus the open-kind field. */
export interface FingerprintEntry {
  readonly package: string;
  readonly errorClass?: string;
  /** Literal text, `*` the only metacharacter, anchored at both ends. */
  readonly messagePattern?: string;
  /** Frame markers that must appear in the stack, in this order. */
  readonly stackShape?: readonly string[];
  readonly corpusEntryId: string;
  /** Defaults to `runtime-error` when a corpus does not say. */
  readonly kind?: FingerprintKind;
}

/** What the matcher could actually observe about a raw caught error. */
export interface ObservedError {
  readonly errorClass?: string;
  readonly message?: string;
  readonly stack: readonly string[];
}

/** One cataloged fingerprint that was considered, and how it fared. */
export interface FingerprintCandidate {
  readonly package: string;
  readonly corpusEntryId: string;
  /** `package#corpusEntryId`, the name this candidate is reported under. */
  readonly name: string;
  readonly matched: readonly Facet[];
  readonly rejectedOn: readonly Facet[];
}

/** A corpus entry that cannot be compiled into the index. */
export interface IndexDefect {
  readonly at: string;
  readonly detail: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The raw text of a caught value, or undefined when it has none. */
export const rawTextOf = (raw: unknown): string | undefined => {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Error) return raw.message;
  if (isRecord(raw) && typeof raw['message'] === 'string') return raw['message'];
  return undefined;
};

/** `package#corpusEntryId`: how a candidate is named in an honest miss. */
export const nameOf = (entry: FingerprintEntry): string =>
  `${entry.package}#${entry.corpusEntryId}`;

/**
 * Anchored literal matching with `*` as the only metacharacter. Deliberately
 * not a RegExp: corpus text is data, never instructions, and a corpus-supplied
 * regex would be both a backtracking hazard and an escaping question nobody
 * wants at registry build time. Linear in the text length per segment.
 */
export function matchesPattern(pattern: string, text: string): boolean {
  const segments = pattern.split('*');
  const first = segments[0] ?? '';
  if (!text.startsWith(first)) return false;
  if (segments.length === 1) return text.length === first.length;
  const last = segments[segments.length - 1] ?? '';
  let cursor = first.length;
  for (let i = 1; i < segments.length - 1; i += 1) {
    const segment = segments[i] ?? '';
    if (segment === '') continue;
    const at = text.indexOf(segment, cursor);
    if (at < 0) return false;
    cursor = at + segment.length;
  }
  return text.length - last.length >= cursor && text.endsWith(last);
}

/** Every marker appears in a frame, in the declared order. */
export function matchesStackShape(
  markers: readonly string[],
  frames: readonly string[],
): boolean {
  let at = 0;
  for (const marker of markers) {
    while (at < frames.length && !(frames[at] ?? '').includes(marker)) at += 1;
    if (at >= frames.length) return false;
    at += 1;
  }
  return true;
}

/**
 * What can be seen of a raw caught value: an Error, an error-shaped object, or
 * bare stderr text (the sidecar router's other input). Anything else observes
 * nothing, which is a miss, never a match.
 */
export function observe(raw: unknown): ObservedError {
  const message = rawTextOf(raw);
  const record = isRecord(raw) ? raw : undefined;
  const named = record !== undefined && typeof record['name'] === 'string' ? record['name'] : undefined;
  const errorClass = named ?? (raw instanceof Error ? raw.constructor.name : undefined);
  const stackText =
    record !== undefined && typeof record['stack'] === 'string' ? record['stack'] : '';
  const stack = stackText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '));
  return {
    ...(errorClass !== undefined ? { errorClass } : {}),
    ...(message !== undefined ? { message } : {}),
    stack: Object.freeze(stack),
  };
}

/**
 * Which of the entry's declared facets the observed error satisfies. A facet
 * the raw error does not expose (no stack, no class on stderr text) counts as
 * rejected, never as a shrug: precision-first means an unconfirmable facet is
 * not a match.
 */
export function judge(entry: FingerprintEntry, seen: ObservedError): FingerprintCandidate {
  const matched: Facet[] = [];
  const rejectedOn: Facet[] = [];
  const record = (facet: Facet, ok: boolean): void => {
    (ok ? matched : rejectedOn).push(facet);
  };
  if (entry.errorClass !== undefined) {
    record('errorClass', seen.errorClass === entry.errorClass);
  }
  if (entry.messagePattern !== undefined) {
    const pattern = entry.messagePattern;
    record('messagePattern', seen.message !== undefined && matchesPattern(pattern, seen.message));
  }
  if (entry.stackShape !== undefined) {
    record('stackShape', seen.stack.length > 0 && matchesStackShape(entry.stackShape, seen.stack));
  }
  return Object.freeze({
    package: entry.package,
    corpusEntryId: entry.corpusEntryId,
    name: nameOf(entry),
    matched: Object.freeze(matched),
    rejectedOn: Object.freeze(rejectedOn),
  });
}

/** The canonical fingerprint of an entry: what a collision is a collision ON. */
export function signatureOf(entry: FingerprintEntry): string {
  return JSON.stringify({
    kind: entry.kind ?? 'runtime-error',
    errorClass: entry.errorClass ?? null,
    messagePattern: entry.messagePattern ?? null,
    stackShape: entry.stackShape ?? null,
  });
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/** The defects in one declared facet, if any. */
function facetDefects(raw: Record<string, unknown>, at: string): readonly IndexDefect[] {
  const defects: IndexDefect[] = [];
  const { errorClass, messagePattern, stackShape } = raw;
  if (errorClass !== undefined && !nonEmptyString(errorClass))
    defects.push({ at, detail: 'errorClass is present but empty' });
  if (messagePattern !== undefined && !nonEmptyString(messagePattern))
    defects.push({ at, detail: 'messagePattern is present but empty' });
  if (
    stackShape !== undefined &&
    (!Array.isArray(stackShape) ||
      stackShape.length === 0 ||
      !stackShape.every((frame) => nonEmptyString(frame)))
  )
    defects.push({
      at,
      detail: 'stackShape is present but is not a non-empty list of frame markers',
    });
  if (errorClass === undefined && messagePattern === undefined && stackShape === undefined)
    defects.push({
      at,
      detail:
        'declares no errorClass, no messagePattern and no stackShape, so it would match every error or none',
    });
  return defects;
}

/**
 * A validated entry, or the defects that stop it compiling. Runs against
 * `unknown` on purpose: the same function validates a hand-written corpus and
 * a JSON artifact loaded off disk.
 */
export function normalizeEntry(
  value: unknown,
  at: string,
): FingerprintEntry | readonly IndexDefect[] {
  if (!isRecord(value)) return [{ at, detail: 'not an object' }];
  const defects: IndexDefect[] = [];
  if (!nonEmptyString(value['package'])) defects.push({ at, detail: 'package is missing or empty' });
  if (!nonEmptyString(value['corpusEntryId']))
    defects.push({ at, detail: 'corpusEntryId is missing or empty' });
  const kind = value['kind'];
  if (kind !== undefined && kind !== 'runtime-error' && kind !== 'static-pattern')
    defects.push({ at, detail: `kind ${JSON.stringify(kind)} is not a fingerprint kind` });
  defects.push(...facetDefects(value, at));
  if (defects.length > 0) return defects;
  const { errorClass, messagePattern, stackShape } = value;
  return Object.freeze({
    package: value['package'] as string,
    corpusEntryId: value['corpusEntryId'] as string,
    ...(errorClass !== undefined ? { errorClass: errorClass as string } : {}),
    ...(messagePattern !== undefined ? { messagePattern: messagePattern as string } : {}),
    ...(stackShape !== undefined ? { stackShape: Object.freeze([...(stackShape as string[])]) } : {}),
    ...(kind !== undefined ? { kind: kind as FingerprintKind } : {}),
  });
}
