/** Options accepted by the encoder. */
export interface EncodeOptions {
  /** Extra characters to claim in the length prefix. */
  readonly padding?: number;
}

/**
 * Encode a payload into the toy wire format: a decimal length prefix, a
 * colon, then the payload itself.
 */
export function encode(input: string, options?: EncodeOptions): string {
  if (input.length === 0) {
    throw new RangeError('input must not be empty');
  }
  const padding = options?.padding ?? 0;
  if (padding < 0) {
    throw new TypeError('padding must not be negative');
  }
  return `${input.length + padding}:${input}`;
}

export function decode(wire: string): string {
  const colon = wire.indexOf(':');
  if (colon === -1) {
    throw new SyntaxError('wire format needs a length prefix');
  }
  return wire.slice(colon + 1);
}
