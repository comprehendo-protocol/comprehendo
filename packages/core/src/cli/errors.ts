// Corpus Generator [17]: the one error a verb raises on a precondition it can
// state plainly. Anything else is a bug and keeps its stack.

export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}
