// CC11 Registry Truth [25], the running half: what it means to really provoke
// a cataloged failure out of a really-installed package, and to really prove a
// fix resolves it.
//
// Split out of `gate-upstream.ts` at the size gate, the same way this package
// splits `fingerprint.ts` from `fingerprint-facets.ts` and `corpus-validate.ts`
// from `corpus-apply.ts`, and for the same reason: resolving which package CI
// installed is one job, and calling it until it throws is another. Everything
// here is about the second job, and nothing here touches a filesystem.

/** How one cataloged failure is really provoked against the real package. */
export interface InductionWitness {
  readonly code: string;
  /** Literal call data into the declared surface: `{operation: [args]}`. */
  readonly induce: unknown;
}

export type ModuleLoader = (entryPath: string) => Promise<Record<string, unknown>>;

export type TruthFailureKind =
  | 'no-such-package'
  | 'directory-mismatch'
  | 'unloadable'
  | 'unrunnable-witness'
  | 'not-inducible'
  | 'misrouted'
  | 'fix-did-not-resolve';

export interface TruthFailure {
  readonly kind: TruthFailureKind;
  readonly at: string;
  readonly detail: string;
}

/** How a verified fix is named, so the folklore diff can look one up. */
export const fixKey = (code: string, title: string): string => `${code} :: ${title}`;

export interface Call {
  readonly operation: string;
  readonly args: readonly unknown[];
}

/** What the corpus's own compiled index said about a really-thrown error. */
export interface Routed {
  readonly outcome: string;
  readonly id?: string;
  readonly candidates: readonly string[];
}

export type Router = (raw: unknown) => Routed;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Literal call data as calls. The grammar is Corpus Format [28]'s `apply`
 * grammar (`{operation: operand}` or an array of them), read the one way the
 * whole project reads it: an array operand is the argument list, anything else
 * is a single argument. `null` means this is not call data at all, which is a
 * refusal rather than a shrug.
 */
export function readCalls(value: unknown): readonly Call[] | null {
  const stages = Array.isArray(value) ? value : [value];
  const calls: Call[] = [];
  for (const stage of stages) {
    if (!isRecord(stage)) return null;
    for (const [operation, operand] of Object.entries(stage)) {
      calls.push({
        operation,
        args: Array.isArray(operand) ? [...(operand as unknown[])] : [operand],
      });
    }
  }
  return calls.length === 0 ? null : calls;
}

export type Invocation = { threw: true; error: unknown } | { threw: false } | 'no-such-operation';

/** Run one call against the loaded module. The thrown value is the result. */
export async function invoke(
  module: Record<string, unknown>,
  call: Call,
): Promise<Invocation> {
  const operation = module[call.operation];
  if (typeof operation !== 'function') return 'no-such-operation';
  try {
    await (operation as (...args: readonly unknown[]) => unknown)(...call.args);
    return { threw: false };
  } catch (error) {
    return { threw: true, error };
  }
}

export const messageOf = (error: unknown): string =>
  String(error instanceof Error ? error.message : error);

export interface Induction {
  readonly failure?: TruthFailure;
  readonly induced?: string;
}

/** Where a really-thrown failure went, when it did not go where it was claimed. */
function routed(witness: InductionWitness, match: Routed): TruthFailure {
  if (match.outcome === 'matched') {
    return {
      kind: 'misrouted',
      at: witness.code,
      detail: `the failure this witness really provoked matches the cataloged entry ${String(match.id)}, not ${witness.code}`,
    };
  }
  if (match.outcome === 'ambiguous') {
    return {
      kind: 'misrouted',
      at: witness.code,
      detail: `the failure this witness really provoked matches more than one cataloged entry (${match.candidates.join(', ')}), so ${witness.code} is not what it identifies`,
    };
  }
  return {
    kind: 'not-inducible',
    at: witness.code,
    detail: `the real package threw, and the thrown failure does not match the fingerprint cataloged for ${witness.code}; the catalog has drifted from the package`,
  };
}

/** One witness, really run, and really matched against the corpus's own index. */
export async function induce(
  witness: InductionWitness,
  code: string,
  module: Record<string, unknown>,
  match: Router,
): Promise<Induction> {
  const calls = readCalls(witness.induce);
  if (calls === null) {
    return {
      failure: {
        kind: 'unrunnable-witness',
        at: witness.code,
        detail: `the witness for ${witness.code} is not literal call data, so nothing can be run from it`,
      },
    };
  }
  for (const call of calls) {
    const outcome = await invoke(module, call);
    if (outcome === 'no-such-operation') {
      return {
        failure: {
          kind: 'unrunnable-witness',
          at: witness.code,
          detail: `the installed package exports no ${call.operation}, so the witness for ${witness.code} cannot run against it`,
        },
      };
    }
    if (!outcome.threw) continue;
    const match_ = match(outcome.error);
    if (match_.outcome === 'matched' && match_.id === code) return { induced: code };
    return { failure: routed(witness, match_) };
  }
  return {
    failure: {
      kind: 'not-inducible',
      at: witness.code,
      detail: `the real installed package did not fail at all when the witness for ${witness.code} ran; a fingerprint the package cannot be induced to produce is drift, not a corpus entry`,
    },
  };
}

/** One fix, applied for real and retried for real. */
export async function proveFix(
  fix: { readonly title: string; readonly apply: unknown },
  code: string,
  module: Record<string, unknown>,
): Promise<TruthFailure | undefined> {
  const at = fixKey(code, fix.title);
  const calls = readCalls(fix.apply);
  if (calls === null) {
    return {
      kind: 'fix-did-not-resolve',
      at,
      detail: `the apply for "${fix.title}" is not literal call data, so it cannot be run against the real package`,
    };
  }
  for (const call of calls) {
    const outcome = await invoke(module, call);
    if (outcome === 'no-such-operation') {
      return {
        kind: 'fix-did-not-resolve',
        at,
        detail: `the installed package exports no ${call.operation}, so "${fix.title}" cannot be applied to it`,
      };
    }
    if (outcome.threw) {
      return {
        kind: 'fix-did-not-resolve',
        at,
        detail: `applying "${fix.title}" and retrying still failed: ${messageOf(outcome.error)}`,
      };
    }
  }
  return undefined;
}
