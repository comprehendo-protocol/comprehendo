/** One named codec: a pure string-to-string transform. */
export type Codec = (input: string) => string;

/** The identity codec, the one every registry starts with. */
export const DEFAULT_CODEC: Codec = (input) => input;

/**
 * A registry of named codecs. Names are unique, and registering a name twice
 * is a programming error rather than a silent replacement.
 */
export class CodecRegistry {
  private readonly codecs = new Map<string, Codec>();

  register(name: string, codec: Codec): void {
    if (this.codecs.has(name)) {
      throw new Error('codec already registered');
    }
    this.codecs.set(name, codec);
  }

  resolve(name: string): Codec {
    const found = this.codecs.get(name);
    if (found === undefined) {
      throw new ReferenceError('no codec registered under that name');
    }
    return found;
  }
}
