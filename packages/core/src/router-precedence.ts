// Router & Precedence [22], the precedence half: the ports, what "installed"
// means as data, and the precedence rule itself as one pure function.
//
// Split from `router.ts` for the same reason `twin-validate.ts` is split from
// `twin.ts`: the construction path and the pure checks are different jobs.
// Everything here is a value-to-value transform over an environment the
// caller supplies, and nothing here reaches a `node:` module, which is what
// makes "comprehend(raw) performs no I/O" checkable rather than asserted.
//
// CC8 [19]'s runtime half lands in {@link decideRoute}: native beats sidecar
// by default, the consumer's `prefer` knob is the only thing that reverses
// it, and nothing a PROVIDER can write can suppress a registry corpus. That
// last one is structural, not policy: the only provider-side input read here
// is a manifest reading, which Manifest Wiring [15] has already projected
// down to `{version, level}`, and there is no other channel.
//
// @see .mdd/docs/22-router-precedence.md
// @see .mdd/docs/19-cc8-native-precedence.md

import { resolveDiscovery } from './config.js';
import type { Discovery, ManifestReading } from './config.js';
import type { DocsSurface } from './docs.js';
import type { ComprehendoEntry } from './marker.js';
import type { ProviderCatalog, Twin } from './twin.js';

/** The one `prefer` value that reverses precedence (RFC section 10.5). */
export const PREFER_SIDECAR = 'sidecar';

// --- the matcher port -------------------------------------------------------
//
// Fingerprint Index & Matcher [21] lives in `@comprehendo/registry-tools`, and
// the dependency direction is one-way (registry-tools -> core), so core cannot
// import it. It arrives as a structural port instead: 21's compiled
// `FingerprintIndex` satisfies this interface with no adaptation, so the real
// matcher is what runs, and no matching is reimplemented here.

/** The corpus entry a confident match resolved to. */
export interface MatchedFingerprint {
  readonly package: string;
  readonly corpusEntryId: string;
}

/** One cataloged fingerprint the matcher considered, named `package#entry`. */
export interface ConsideredFingerprint {
  readonly name: string;
  readonly package: string;
  readonly corpusEntryId: string;
}

/**
 * What a lookup answered. The honest miss carries the matcher's OWN
 * UNSTRUCTURED twin (candidates named, CC10 [20]); the router passes it
 * through untouched rather than rebuilding the shape and drifting from it.
 */
export type CorpusMatch =
  | {
      readonly outcome: 'matched';
      readonly entry: MatchedFingerprint;
      readonly candidates: readonly ConsideredFingerprint[];
    }
  | {
      readonly outcome: 'ambiguous' | 'miss';
      readonly twin: Twin;
      readonly candidates: readonly ConsideredFingerprint[];
    };

export interface CorpusMatcher {
  match(raw: unknown): CorpusMatch;
}

// --- what is installed, as data ---------------------------------------------

/** One installed `@comprehendo/<pkg>` corpus, already loaded. */
export interface InstalledCorpus {
  /** The TARGET package this corpus is about, e.g. `ffmpeg`. */
  readonly package: string;
  /** The corpus package itself, e.g. `@comprehendo/ffmpeg`. */
  readonly corpusPackage: string;
  /** The cataloged failures, for Twin Builder [12]. */
  readonly catalog?: ProviderCatalog;
  /** Docs Engine [13]'s surface over this corpus's packed artifact. */
  readonly docs?: DocsSurface;
  readonly version?: string;
}

/**
 * What the environment knows about a TARGET package's native adoption. Both
 * channels, either of which may be missing: the runtime marker (Marker &
 * Probe [11], authoritative) and the static manifest (Manifest Wiring [15],
 * advisory). A caught value carrying its own marker supplies the first one at
 * call time, which is why installing a native implementation flips precedence
 * with no reconfiguration here.
 */
export interface NativeEvidence {
  readonly marker?: ComprehendoEntry;
  readonly manifest?: ManifestReading;
}

/** Something installed that could not be read. Reported, never silently skipped. */
export interface EnvironmentDefect {
  readonly at: string;
  readonly detail: string;
}

/** The snapshot the router routes against. */
export interface Environment {
  /** One index over every installed corpus, so cross-package ambiguity is visible. */
  readonly matcher: CorpusMatcher;
  readonly corpora: readonly InstalledCorpus[];
  readonly native?: Readonly<Record<string, NativeEvidence>>;
  readonly defects?: readonly EnvironmentDefect[];
}

/**
 * The consumer's knobs, as this router reads them. `prefer` is the only one
 * CC8 [19] gives a runtime meaning; the other four (`pin`, `disable`,
 * `require`, `local`) belong to Config Loader [23] and widen this type there.
 */
export interface RouterConfig {
  readonly prefer?: Readonly<Record<string, string>>;
}

// --- the decision -----------------------------------------------------------

export type RouteSource = 'native' | 'sidecar';

/** Which tier answers for a package, and why. Computed per call, never stored. */
export interface RouterDecision {
  readonly package: string;
  readonly source: RouteSource;
  readonly reason: string;
  /** Which discovery channel found the native implementation, when one was found. */
  readonly discovery?: Discovery;
}

const decision = (
  pkg: string,
  source: RouteSource,
  reason: string,
  discovery?: Discovery,
): RouterDecision =>
  Object.freeze({
    package: pkg,
    source,
    reason,
    ...(discovery === undefined ? {} : { discovery }),
  });

/**
 * Both channels, resolved by Manifest Wiring [15]'s own rule: when the marker
 * and the manifest disagree, the marker wins, and the manifest's claim is
 * discarded even where they agree (the disagreement fixture, Conformance
 * Fixtures [04]). A manifest that could not be READ is not a claim at all.
 */
function nativeDiscovery(evidence: NativeEvidence | undefined): Discovery | undefined {
  if (evidence === undefined) return undefined;
  const reading = evidence.manifest;
  return resolveDiscovery({
    marker: evidence.marker,
    manifest: reading?.status === 'declared' ? reading.declaration : undefined,
  });
}

const channel = (discovery: Discovery): string =>
  discovery.source === 'marker'
    ? 'its runtime marker, the authoritative channel'
    : 'its manifest declaration, the advisory channel';

/**
 * The precedence rule, whole, in one pure function.
 *
 * Native present and no override: native handles the call. Native present and
 * the consumer preferred the sidecar for this package: the sidecar handles it
 * anyway. No native present: the sidecar handles it unconditionally. Nothing a
 * provider declares appears anywhere in this function, by construction.
 */
export function decideRoute(
  pkg: string,
  evidence?: NativeEvidence,
  config: RouterConfig = {},
): RouterDecision {
  const discovery = nativeDiscovery(evidence);
  if (config.prefer?.[pkg] === PREFER_SIDECAR) {
    return decision(
      pkg,
      'sidecar',
      discovery === undefined
        ? `the consumer prefers the sidecar corpus for ${pkg}`
        : `the consumer prefers the sidecar corpus for ${pkg}, which reverses native precedence`,
      discovery,
    );
  }
  if (discovery !== undefined) {
    return decision(
      pkg,
      'native',
      `${pkg} speaks Comprehendo natively, reported by ${channel(discovery)}; ` +
        'native wins by default and only the consumer can reverse it',
      discovery,
    );
  }
  return decision(
    pkg,
    'sidecar',
    `no native implementation is present for ${pkg}, so an installed sidecar corpus answers`,
  );
}
