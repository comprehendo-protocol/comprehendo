/** Options accepted by the encoder. */
export interface EncodeOptions {
  /** Extra characters to claim in the length prefix. */
  readonly padding?: number;
}

/**
 * Encode a payload into the toy wire format: a decimal length prefix, a
 * colon, then the payload itself. The codec name is now required.
 */
export function encode(input: string, codec: string, options?: EncodeOptions): string {
  if (input.length === 0) {
    throw new RangeError('input must not be empty');
  }
  const padding = options?.padding ?? 0;
  if (padding < 0) {
    throw new TypeError('padding must not be negative');
  }
  return `${codec}/${input.length + padding}:${input}`;
}

/** Encode every payload in one pass, so callers stop writing the loop. */
export function encodeAll(inputs: readonly string[], codec: string): string[] {
  return inputs.map((input) => encode(input, codec));
}

export function decode(wire: string): string {
  const colon = wire.indexOf(':');
  if (colon === -1) {
    throw new TypeError('wire is not in the toy wire format');
  }
  return wire.slice(colon + 1);
}
