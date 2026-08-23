// Cold-Agent Benchmark [38]: Corpus Format [28]'s `apply` grammar, on a
// command line.
//
// A DELIBERATE DUPLICATE of `packages/registry-tools/test/helpers/
// ffmpeg-cli.ts`'s `applyToArgv`, which is the only implementation of this
// grammar in the repository and lives in a test tree that a `scripts/` file
// loading `dist/` cannot import. The copy is guarded, never left to drift:
// `packages/registry-tools/test/cold-agent-benchmark.test.ts` asserts this
// function returns the byte-identical argv as that helper for every fix in the
// real catalog on every argv in this suite. That is this project's stated
// answer to boundary-imposed duplication, an unguarded copy is drift waiting.
//
// Pure: no `node:` import, so the applier cannot touch a disk either.
//
// @see JUDGMENT-38-cold-agent-benchmark.md, call 4
// @see .mdd/docs/28-corpus-format.md

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const dropOption = (argv: readonly string[], option: string): string[] => {
  const kept: string[] = [];
  for (let at = 0; at < argv.length; at += 1) {
    if (argv[at] === option) {
      at += 1;
      continue;
    }
    kept.push(argv[at] as string);
  }
  return kept;
};

const insertOption = (
  argv: readonly string[],
  option: string,
  operands: readonly string[],
): string[] => {
  const added = operands.flatMap((operand) => [option, operand]);
  const at = Math.max(argv.length - 1, 0);
  return [...argv.slice(0, at), ...added, ...argv.slice(at)];
};

/**
 * Apply literal call data to an argument vector.
 *
 * A DELIBERATE DUPLICATE of `packages/registry-tools/test/helpers/
 * ffmpeg-cli.ts`'s `applyToArgv`, which is the only implementation of this
 * grammar in the repository and lives in a test tree a `scripts/` file loading
 * `dist/` cannot import. The copy is guarded, not left to drift: the suite
 * asserts this function returns the byte-identical argv as that helper for
 * every fix in the real catalog on every argv in this suite. See
 * JUDGMENT-38-cold-agent-benchmark.md, call 4.
 */
export function applyToArgv(
  argv: readonly string[],
  apply: unknown,
  declaredOperations: readonly string[],
): readonly string[] {
  const stages = Array.isArray(apply) ? (apply as readonly unknown[]) : [apply];
  let next = [...argv];
  for (const stage of stages) {
    if (!isRecord(stage)) {
      throw new Error('an apply is literal call data: an object, or a list of them');
    }
    for (const [option, operand] of Object.entries(stage)) {
      if (!declaredOperations.includes(option)) {
        throw new Error(
          `the apply names ${option}, which this corpus's declared_schema does not declare; an apply stays inside the provider's own call surface`,
        );
      }
      const operands = Array.isArray(operand) ? (operand as readonly unknown[]) : [operand];
      if (operands.length === 0 || !operands.every((one) => typeof one === 'string')) {
        throw new Error(
          `the apply for ${option} is not a string operand or a non-empty list of them, so it is not literal call data for a command line`,
        );
      }
      next = insertOption(dropOption(next, option), option, operands as readonly string[]);
    }
  }
  return Object.freeze(next);
}
