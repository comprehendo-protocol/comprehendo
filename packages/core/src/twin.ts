// Twin Builder [12], SKELETON. Types and signatures only; every function
// throws until Phase 6 implements it. Red Gate stage.

export const SPEC_VERSION = '0.1';
export const COMPREHENDO_MARKER: symbol = Symbol.for('comprehendo');

export type Confidence = 'high' | 'likely' | 'guess';

export interface Fix {
  readonly title: string;
  readonly apply?: unknown;
  readonly docs?: string;
  readonly confidence?: Confidence;
}

export interface Twin {
  readonly comprehendo: string;
  readonly code: string;
  readonly reason: string;
  readonly path?: string;
  readonly namespace?: string;
  readonly declared?: unknown;
  readonly received?: unknown;
  readonly accepts?: readonly string[];
  readonly fixes: readonly Fix[];
}

export interface DeclaredCallSchema {
  readonly surface: string;
  readonly operations: readonly string[];
}

export interface CatalogEntry {
  readonly code: string;
  readonly reason: string;
  readonly path?: string;
  readonly namespace?: string;
  readonly declared?: unknown;
  readonly received?: unknown;
  readonly accepts?: readonly string[];
  readonly fixes: readonly Fix[];
}

export interface ProviderCatalog {
  readonly declaredSchema: DeclaredCallSchema;
  readonly topics: readonly string[];
  readonly entries: readonly CatalogEntry[];
}

export type ViolationRule = 'CC3' | 'CC7' | 'CATALOG';

export type ViolationReason =
  | 'schema-escaping-fix'
  | 'unvalidatable-apply'
  | 'empty-apply'
  | 'fix-without-remedy'
  | 'fix-without-title'
  | 'dangling-docs-pointer'
  | 'empty-fixes'
  | 'reserved-code'
  | 'duplicate-code'
  | 'unknown-code'
  | 'raw-error-leak'
  | 'raw-error-discarded';

export interface Violation {
  readonly rule: ViolationRule;
  readonly reason: ViolationReason;
  readonly locator: string;
  readonly message: string;
}

export interface TwinContext {
  readonly path?: string;
  readonly namespace?: string;
  readonly declared?: unknown;
  readonly received?: unknown;
  readonly accepts?: readonly string[];
}

export interface ComprehendoError {
  readonly twin: Twin;
}

export interface TwinBuilder {
  readonly codes: readonly string[];
  has(code: string): boolean;
  build(code: string, context?: TwinContext): Twin;
  twinFor(code: string | undefined, raw?: unknown, context?: TwinContext): Twin;
  errorFor(code: string | undefined, raw?: unknown, context?: TwinContext): Error & ComprehendoError;
}

export class TwinCatalogError extends Error {
  readonly violations: readonly Violation[];

  constructor(violations: readonly Violation[]) {
    super('comprehendo: skeleton');
    this.name = 'TwinCatalogError';
    this.violations = violations;
  }
}

const skeleton = (): never => {
  throw new Error('MDD skeleton: twin.ts is not implemented yet');
};

export function applyOperations(_apply: unknown): readonly string[] | null {
  return skeleton();
}

export function validateCatalog(_catalog: ProviderCatalog): readonly Violation[] {
  return skeleton();
}

export function auditTwin(_twin: Twin, _raw?: unknown): readonly Violation[] {
  return skeleton();
}

export function unstructuredTwin(_raw: unknown): Twin {
  return skeleton();
}

export function attachTwin<E extends object>(
  _error: E,
  _twin: Twin,
  _probeValue: unknown = true,
): E & ComprehendoError {
  return skeleton();
}

export function createTwinBuilder(_catalog: ProviderCatalog): TwinBuilder {
  return skeleton();
}
