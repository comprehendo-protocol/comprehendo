// RED-GATE STUB, replaced in the implement phase.

export interface NativeDeclaration {
  readonly version: string;
  readonly level: number;
}

export interface ManifestSnapshot {
  readonly package: string;
  readonly declaredName?: string;
  readonly version?: string;
  readonly corpus?: string;
  readonly owners?: readonly string[];
  readonly native?: NativeDeclaration;
  readonly problems: readonly string[];
}

export function snapshotOf(_pkg: string, _manifest: unknown): ManifestSnapshot {
  throw new Error('MDD skeleton');
}

export function readTargetManifest(_installRoot: string, _directory: string): ManifestSnapshot {
  throw new Error('MDD skeleton');
}
