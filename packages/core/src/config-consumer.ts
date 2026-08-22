/**
 * Config Loader [23]: the CONSUMER's five knobs, `prefer`, `pin`, `disable`,
 * `require` and `local`, as a value.
 *
 * The other half of `config.ts`. That file reads what a PROVIDER declares
 * about itself (`{version, level}`, Manifest Wiring [15]); this one reads what
 * a CONSUMING project decides about its own routing. Both live under the same
 * manifest key, and that is precisely the asymmetry CC8 [19] rests on: the
 * provider-side read projects to two fields and has no channel for a third, so
 * the identical bytes in a provider's own manifest express nothing. Only the
 * consumer can override precedence, and this module is the only door.
 *
 * The knob set is the conformance kit's `config.schema.json` (RFC section
 * 10.5), not a restatement of it: a test asserts the two agree, so a schema
 * that grows a sixth knob turns red here instead of passing quietly.
 *
 * PURE, deliberately: no `node:` import, no I/O. `router-precedence.ts`
 * imports it as a value, and the routing modules' no-I/O scan
 * (`router-comprehend.test.ts`) has to keep passing. Reading the knobs off a
 * real manifest on disk is `config.ts`'s `readConsumerConfigFile`, on the
 * other side of that seam.
 *
 * @see .mdd/docs/23-config-loader.md
 * @see JUDGMENT-23-config-loader.md
 */

/**
 * The consuming project's configuration. Every knob is optional and the
 * default is the empty object: Comprehendo needs no configuration, and this
 * exists only as the escape hatch.
 */
export interface ConsumerConfig {
  /** Per-package tier override. `sidecar` reverses native precedence. */
  readonly prefer?: Readonly<Record<string, string>>;
  /** Per-corpus version pin, keyed by corpus package or by target package. */
  readonly pin?: Readonly<Record<string, string>>;
  /** Packages for which the consumer wants raw errors, please. */
  readonly disable?: readonly string[];
  /** Per-package trust demand, read against {@link TRUST_LEVELS}. */
  readonly require?: Readonly<Record<string, string>>;
  /** Private corpora, keyed by package, valued by directory path. */
  readonly local?: Readonly<Record<string, string>>;
}

/** The five knobs, in the order the schema declares them. */
export const CONFIG_KNOBS = Object.freeze(['prefer', 'pin', 'disable', 'require', 'local'] as const);

export type ConfigKnob = (typeof CONFIG_KNOBS)[number];

/**
 * The trust ladder (RFC section 10.6), lowest rung first. `community` is what
 * any registry corpus is; `endorsed` is what Owner Endorsement [30] (Wave 5)
 * will mark a corpus release the package's real owner blessed; `native` is a
 * package that speaks Comprehendo itself. Nothing populates `endorsed` yet,
 * and nothing here pretends otherwise (see JUDGMENT call 3).
 */
export const TRUST_LEVELS = Object.freeze(['community', 'endorsed', 'native'] as const);

export type TrustLevel = (typeof TRUST_LEVELS)[number];

/** No configuration at all: the default, and what an unreadable manifest yields. */
export const EMPTY_CONFIG: ConsumerConfig = Object.freeze({});

/**
 * What a config read found. A knob that could not be read is REPORTED, never
 * guessed at and never thrown: one malformed knob must not cost a project the
 * other four, and a silently dropped knob is a routing change nobody asked
 * for.
 */
export interface ConsumerConfigReading {
  readonly config: ConsumerConfig;
  readonly problems: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What a value is, for a message, without printing the value itself. */
const describe = (value: unknown): string => {
  if (value === undefined || value === null) return String(value);
  return Array.isArray(value) ? 'an array' : `a ${typeof value}`;
};

const isName = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** One knob's record form: package (or corpus) name to a single string value. */
function readRecordKnob(
  knob: ConfigKnob,
  value: unknown,
  problems: string[],
  check?: (key: string, entry: string) => string | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value)) {
    problems.push(`the "${knob}" knob must be an object keyed by package name, got ${describe(value)}`);
    return undefined;
  }
  const kept: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isName(entry)) {
      problems.push(`the "${knob}" value for "${key}" must be a string, got ${describe(entry)}`);
      continue;
    }
    const problem = check?.(key, entry);
    if (problem !== undefined) problems.push(problem);
    kept[key] = entry;
  }
  return Object.freeze(kept);
}

/** The `disable` knob: a list of package names, bad entries dropped by name. */
function readListKnob(value: unknown, problems: string[]): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    problems.push(`the "disable" knob must be an array of package names, got ${describe(value)}`);
    return undefined;
  }
  const kept = value.filter((entry, index) => {
    if (isName(entry)) return true;
    problems.push(`the "disable" entry at index ${String(index)} must be a package name, got ${describe(entry)}`);
    return false;
  });
  return Object.freeze(kept as string[]);
}

/**
 * A trust demand outside the ladder is reported AND kept: the router refuses
 * to route rather than reading an unreadable demand as no demand, which is the
 * one interpretation that quietly gives the consumer less than they asked for.
 */
const ladderProblem = (key: string, entry: string): string | undefined =>
  (TRUST_LEVELS as readonly string[]).includes(entry)
    ? undefined
    : `the "require" value for "${key}" must be one of ${TRUST_LEVELS.join(', ')}, got "${entry}"`;

/**
 * Read the five knobs out of whatever sat under the manifest key. Anything
 * else under that key (a provider's own `{version, level}`, RFC section 10.6's
 * endorsement keys) is not this loader's and is passed over in silence.
 */
export function parseConsumerConfig(value: unknown): ConsumerConfigReading {
  if (value === undefined) return { config: EMPTY_CONFIG, problems: Object.freeze([]) };
  const problems: string[] = [];
  if (!isRecord(value)) {
    problems.push(`the consumer configuration must be an object, got ${describe(value)}`);
    return { config: EMPTY_CONFIG, problems: Object.freeze(problems) };
  }
  const knob = <T>(name: ConfigKnob, read: T | undefined): Record<string, T> =>
    read === undefined ? {} : { [name]: read };

  const config: ConsumerConfig = {
    ...knob('prefer', 'prefer' in value ? readRecordKnob('prefer', value['prefer'], problems) : undefined),
    ...knob('pin', 'pin' in value ? readRecordKnob('pin', value['pin'], problems) : undefined),
    ...knob('disable', 'disable' in value ? readListKnob(value['disable'], problems) : undefined),
    ...knob(
      'require',
      'require' in value ? readRecordKnob('require', value['require'], problems, ladderProblem) : undefined,
    ),
    ...knob('local', 'local' in value ? readRecordKnob('local', value['local'], problems) : undefined),
  };
  return { config: Object.freeze(config), problems: Object.freeze(problems) };
}

// --- what the router asks a config -------------------------------------------

/** Has the consumer turned Comprehendo routing off for this package? */
export const isDisabled = (config: ConsumerConfig, pkg: string): boolean =>
  config.disable?.includes(pkg) === true;

/**
 * The version this consumer pinned for a package's corpus, by corpus package
 * name first (the kit's own spelling, `@comprehendo/ffmpeg`) and then by
 * target package name, because both read as "pin ffmpeg's corpus".
 */
export function pinnedVersion(
  config: ConsumerConfig,
  pkg: string,
  corpusPackage?: string,
): string | undefined {
  const pin = config.pin;
  if (pin === undefined) return undefined;
  return (corpusPackage === undefined ? undefined : pin[corpusPackage]) ?? pin[pkg];
}

/** The trust level demanded for this package, exactly as the consumer wrote it. */
export const demandedTrust = (config: ConsumerConfig, pkg: string): string | undefined =>
  config.require?.[pkg];

/** The directory a private corpus for this package was mounted from. */
export const localCorpusPath = (config: ConsumerConfig, pkg: string): string | undefined =>
  config.local?.[pkg];

/** Every private corpus this config mounts, as `[package, path]` pairs. */
export const localCorpusMounts = (config: ConsumerConfig): readonly (readonly [string, string])[] =>
  Object.entries(config.local ?? {}).map(([pkg, path]) => [pkg, path] as const);

/**
 * Does a corpus at `actual` satisfy a demand for `demanded`? A demand that is
 * not a rung on the ladder satisfies nothing: it cannot be read, so it cannot
 * be met.
 */
export function meetsTrust(actual: TrustLevel, demanded: string): boolean {
  const wanted = (TRUST_LEVELS as readonly string[]).indexOf(demanded);
  return wanted !== -1 && TRUST_LEVELS.indexOf(actual) >= wanted;
}
