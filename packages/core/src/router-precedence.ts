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
import {
  demandedTrust,
  isDisabled,
  localCorpusPath,
  meetsTrust,
  pinnedVersion,
} from './config-consumer.js';
import type { ConfigKnob, ConsumerConfig, TrustLevel } from './config-consumer.js';
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
  /**
   * Where this corpus sits on the trust ladder. Absent means `community`,
   * which is what every registry corpus is until Owner Endorsement [30]
   * (Wave 5) marks a release endorsed. Nothing populates it today, and the
   * `require` knob reads it rather than assuming a rung.
   */
  readonly trust?: TrustLevel;
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
 * The consumer's knobs, as this router reads them: all five of them, exactly
 * Config Loader [23]'s {@link ConsumerConfig}. `prefer` is the one CC8 [19]
 * names; the other four are read here too, and each one changes routing.
 * Nothing a PROVIDER declares can reach this type, which is CC8's structural
 * half restated as a signature.
 */
export type RouterConfig = ConsumerConfig;

/** What the environment knows about the SIDECAR corpus installed for a package. */
export interface CorpusEvidence {
  readonly installed: boolean;
  /** The corpus package it came from, e.g. `@comprehendo/ffmpeg`. */
  readonly corpusPackage?: string;
  /** The installed corpus's own version, when it declares one. */
  readonly version?: string;
  /** Its rung on the trust ladder. Absent means `community`. */
  readonly trust?: TrustLevel;
}

// --- the decision -----------------------------------------------------------

/**
 * Which tier answers. `none` is not an error: it is the consumer having said,
 * through `disable`, `require` or `pin`, that they would rather have nothing
 * than this. The caller answers the honest UNSTRUCTURED / UNDOCUMENTED, never
 * the corpus that was ruled out.
 */
export type RouteSource = 'native' | 'sidecar' | 'none';

/** Which tier answers for a package, and why. Computed per call, never stored. */
export interface RouterDecision {
  readonly package: string;
  readonly source: RouteSource;
  readonly reason: string;
  /** Which discovery channel found the native implementation, when one was found. */
  readonly discovery?: Discovery;
  /** Which consumer knob decided this route. Absent means default precedence. */
  readonly knob?: ConfigKnob;
}

const decision = (
  pkg: string,
  source: RouteSource,
  reason: string,
  discovery?: Discovery,
  knob?: ConfigKnob,
): RouterDecision =>
  Object.freeze({
    package: pkg,
    source,
    reason,
    ...(discovery === undefined ? {} : { discovery }),
    ...(knob === undefined ? {} : { knob }),
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
 *
 * On top of that rule sit the consumer's other four knobs (Config Loader
 * [23]), read in a stated order so two of them set at once is not a coin toss:
 * `disable` first (routing off for this package at all, whatever else is
 * true), then `prefer` (which tier), then `require` (is that tier's corpus
 * trusted enough), then `pin` (is it the exact corpus version), and finally
 * `local` (this package's corpus is one the consumer mounted themselves).
 * Three of them can answer that NO tier routes, which is a decision, not a
 * failure: the consumer asked for nothing rather than this.
 */
export function decideRoute(
  pkg: string,
  evidence?: NativeEvidence,
  config: RouterConfig = {},
  corpus?: CorpusEvidence,
): RouterDecision {
  const discovery = nativeDiscovery(evidence);
  if (isDisabled(config, pkg)) {
    return decision(
      pkg,
      'none',
      `the consumer turned Comprehendo routing off for ${pkg}, so neither tier answers`,
      discovery,
      'disable',
    );
  }
  const preferred = config.prefer?.[pkg] === PREFER_SIDECAR;
  const native = !preferred && discovery !== undefined;
  const demanded = demandedTrust(config, pkg);
  let knob: ConfigKnob | undefined = preferred ? 'prefer' : undefined;
  // What the knobs that were SATISFIED add to the reason. A route that stands
  // because a demand was met reads nothing like one nobody configured.
  const met: string[] = [];

  if (demanded !== undefined) {
    const held: TrustLevel = native ? 'native' : (corpus?.trust ?? 'community');
    if (!meetsTrust(held, demanded)) {
      return decision(
        pkg,
        'none',
        `the consumer requires a "${demanded}" corpus for ${pkg}, and the one available is ${held}`,
        discovery,
        'require',
      );
    }
    met.push(`meeting the "${demanded}" trust level the consumer requires`);
    knob = 'require';
  }

  if (native && discovery !== undefined) {
    return decision(
      pkg,
      'native',
      `${pkg} speaks Comprehendo natively, reported by ${channel(discovery)}; ` +
        'native wins by default and only the consumer can reverse it',
      discovery,
      knob,
    );
  }

  const pinned = pinnedVersion(config, pkg, corpus?.corpusPackage);
  if (pinned !== undefined) {
    const installed = corpus?.version;
    if (installed !== pinned) {
      return decision(
        pkg,
        'none',
        `the consumer pinned the ${pkg} corpus to ${pinned}, and what is installed is ` +
          `${installed ?? 'a corpus that reports no version'}`,
        discovery,
        'pin',
      );
    }
    met.push(`at ${pinned}, the corpus version the consumer pinned`);
    knob = 'pin';
  }

  const suffix = met.length === 0 ? '' : `, ${met.join(', ')}`;
  const mounted = localCorpusPath(config, pkg);
  if (mounted !== undefined) {
    return decision(
      pkg,
      'sidecar',
      `${pkg} answers from the private corpus the consumer mounted at ${mounted}${suffix}`,
      discovery,
      'local',
    );
  }
  if (preferred) {
    return decision(
      pkg,
      'sidecar',
      discovery === undefined
        ? `the consumer prefers the sidecar corpus for ${pkg}${suffix}`
        : `the consumer prefers the sidecar corpus for ${pkg}, which reverses native precedence${suffix}`,
      discovery,
      knob ?? 'prefer',
    );
  }
  return decision(
    pkg,
    'sidecar',
    `no native implementation is present for ${pkg}, so an installed sidecar corpus answers${suffix}`,
    discovery,
    knob,
  );
}
