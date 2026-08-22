// RED-GATE STUB, replaced in the implement phase. Every constant carries a
// deliberately wrong sentinel so no assertion can pass vacuously here.
export const AUTHORING_FORMAT = -1;
export const AUTHORING_FILES: readonly string[] = [];
export const STUB = 'MDD skeleton';
export const COMPREHENDO_VERSION = 'MDD skeleton';
export const PACKED_DOCS_FORMAT = -1;
export const CORPUS_PACKED_FORMAT = -1;
export const CORPUS_ARTIFACT = 'MDD skeleton';
export const CORPUS_DESCRIPTOR_KEY = 'MDD skeleton';

export interface CorpusViolation {
  readonly rule: string;
  readonly reason: string;
  readonly locator: string;
  readonly message: string;
}
export interface CorpusSource {
  readonly provider: string;
}
export interface PackedCorpus {
  readonly comprehendo: string;
  readonly corpus_packed: number;
  readonly package: string;
  readonly provider: string;
  readonly docs: { readonly index: readonly string[]; readonly topics: Record<string, { summary: string }> };
  readonly twins: { readonly entries: readonly { code: string; fixes: readonly { title: string; apply?: unknown; docs?: string }[] }[] };
  readonly fingerprints: readonly { package: string; corpusEntryId: string; errorClass?: string }[];
}
export class CorpusFormatError extends Error {
  readonly violations: readonly CorpusViolation[] = [];
}
export function parse(_dir: string): CorpusSource {
  throw new Error('MDD skeleton');
}
export function validate(_corpus: CorpusSource): readonly CorpusViolation[] {
  throw new Error('MDD skeleton');
}
export function pack(_corpus: CorpusSource): PackedCorpus {
  throw new Error('MDD skeleton');
}
export function catalogOf(_corpus: CorpusSource): unknown {
  throw new Error('MDD skeleton');
}
export function serializeCorpus(_packed: PackedCorpus): string {
  throw new Error('MDD skeleton');
}
export function readPackedCorpus(_raw: unknown): PackedCorpus {
  throw new Error('MDD skeleton');
}
export function corpusDescriptor(_packed: PackedCorpus): unknown {
  throw new Error('MDD skeleton');
}
