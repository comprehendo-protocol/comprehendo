// Scoped Publisher [31]: what stops a publish, in one place.
//
// PUBLISHING IS A REFUSAL BY DEFAULT, and this module is the whole of the
// reason it ever stops being one. A refusal is DATA, never an exception, for
// the same reason Corpus Format [28]'s violations and Submission Gate [29]'s
// findings are: CI reports every reason a merge did not publish at once,
// rather than one per re-run.
//
// The load-bearing rule here is the first one. `registryTruth` and `folklore`
// are the two checks 29 reports as `not-run` when `verifyAgainstUpstream` did
// not run, and this module reads those check outcomes DIRECTLY rather than
// trusting the `publishable` summary flag beside them. That is deliberate:
// `publishable` is a boolean on a plain interface, and CC11 [25]'s threat
// model is a corpus claiming to have been verified against a package nobody
// ran. `not-run` is not `pass`, here as much as in 29.

import type { CorpusSource } from './corpus-format.js';
import { fingerprintsOf } from './gate-fingerprint.js';
import { GATE_CHECKS } from './gate-result.js';
import type { GateCheck } from './gate-result.js';
import type { GateResult } from './gate.js';

/** The one ref a publish may run from. A release branch is not main. */
export const PUBLISH_REF = 'refs/heads/main';

/** The one event a publish may run from: the merge itself, never the PR. */
export const PUBLISH_EVENT = 'merge';

/**
 * The two checks that cannot be `pass` unless `verifyAgainstUpstream` really
 * ran. Named as a constant rather than inferred inside a loop, so the CC11
 * [25] contract this feature satisfies is something a reader can find.
 */
export const UPSTREAM_CHECKS: readonly GateCheck[] = Object.freeze([
  'registryTruth',
  'folklore',
]);

/** What CI states about the merge it is publishing from. */
export interface PublishTrigger {
  /** The repository the merge happened in. */
  readonly repository: string;
  /** The workflow event. Anything but {@link PUBLISH_EVENT} refuses. */
  readonly event: string;
  /** The ref merged to. Anything but {@link PUBLISH_REF} refuses. */
  readonly ref: string;
  /** The merged commit, as a full 40-character sha. */
  readonly commit: string;
  readonly mergedAt: string;
  /** The CI run, when the runner supplies one. */
  readonly runId?: string;
}

export type PublishRefusalReason =
  | 'unverified-against-upstream'
  | 'gate-not-publishable'
  | 'gate-result-not-for-this-corpus'
  | 'not-a-merge-commit'
  | 'not-the-publish-branch'
  | 'no-publish-version'
  | 'unpackable-corpus';

export interface PublishRefusal {
  readonly reason: PublishRefusalReason;
  readonly detail: string;
}

export const refusal = (reason: PublishRefusalReason, detail: string): PublishRefusal =>
  Object.freeze({ reason, detail });

/** Everything wrong with the gate run, named check by check. */
export function gateRefusals(gateResult: GateResult): readonly PublishRefusal[] {
  const unverified = UPSTREAM_CHECKS.filter((check) => gateResult.checks[check] !== 'pass');
  const failed = GATE_CHECKS.filter(
    (check) => gateResult.checks[check] !== 'pass' && !unverified.includes(check),
  );
  const said = (checks: readonly GateCheck[]): string =>
    checks.map((check) => `${check} is ${gateResult.checks[check]}`).join(', ');

  const found: PublishRefusal[] = [];
  if (unverified.length > 0) {
    found.push(
      refusal(
        'unverified-against-upstream',
        `verifyAgainstUpstream did not pass on this gate run (${said(unverified)}), so no claim this corpus makes has been checked against the really installed package; not-run is never pass`,
      ),
    );
  }
  if (failed.length > 0) {
    found.push(refusal('gate-not-publishable', `the submission gate did not pass: ${said(failed)}`));
  }
  if (found.length === 0 && gateResult.publishable !== true) {
    found.push(
      refusal(
        'gate-not-publishable',
        'every check reports pass and the gate still did not mark this submission publishable; the summary and the checks disagree, which is never resolved in favour of publishing',
      ),
    );
  }
  return found;
}

/**
 * That the gate run is about THIS corpus.
 *
 * A green result for corpus A does not license publishing corpus B, and
 * `GateResult` does not name its corpora, so the binding is checked through
 * the one thing it does carry: the compiled index. Every fingerprint this
 * corpus compiles must be in it, under this package.
 */
export function bindingRefusals(
  corpus: CorpusSource,
  gateResult: GateResult,
): readonly PublishRefusal[] {
  const compiled = fingerprintsOf(corpus);
  if (compiled.length === 0) return [];
  const indexed = new Set(
    (gateResult.index?.entries ?? []).map((entry) => `${entry.package}::${entry.corpusEntryId}`),
  );
  const missing = compiled
    .map((entry) => `${entry.package}::${entry.corpusEntryId}`)
    .filter((key) => !indexed.has(key));
  return missing.length === 0
    ? []
    : [
        refusal(
          'gate-result-not-for-this-corpus',
          `gate run ${gateResult.prId} built an index that does not carry ${missing.join(', ')}, so it is not a run over this corpus and cannot license publishing it`,
        ),
      ];
}

const SHA = /^[0-9a-f]{40}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;

/** That this really is the merge, on the publish branch, at a real commit. */
export function triggerRefusals(
  trigger: PublishTrigger,
  version: string,
): readonly PublishRefusal[] {
  const found: PublishRefusal[] = [];
  if (trigger.event !== PUBLISH_EVENT) {
    found.push(
      refusal(
        'not-a-merge-commit',
        `publishing runs only on ${PUBLISH_EVENT}, and this run reports "${trigger.event}"; a corpus is published when it lands, never while it is proposed`,
      ),
    );
  }
  if (!SHA.test(trigger.commit)) {
    found.push(
      refusal(
        'not-a-merge-commit',
        `"${trigger.commit}" is not a full commit sha, and an attestation that cannot name the commit it came from attests nothing`,
      ),
    );
  }
  if (trigger.ref !== PUBLISH_REF) {
    found.push(
      refusal(
        'not-the-publish-branch',
        `publishing runs only from ${PUBLISH_REF}, and this run reports "${trigger.ref}"`,
      ),
    );
  }
  if (!VERSION.test(version)) {
    found.push(
      refusal(
        'no-publish-version',
        `"${version}" is not a version a package can be published at; CI reads the corpus package's own version and passes it in`,
      ),
    );
  }
  return found;
}
