// CC4 Folklore Gate [26], enforced by Submission Gate [29]: every twin code and
// every fix is provoked by a real test, or it does not ship.
//
// The coverage this diffs against is not something the corpus declares about
// itself. 26 is explicit that "provoked" means an actual test actually
// triggering the failure and actually observing the twin and the fix, never a
// hand-written assertion that the shape looks plausible, so the only evidence
// this module accepts is what `verifyAgainstUpstream` OBSERVED while calling
// the really-installed package. An author cannot write the evidence; they can
// only supply a witness, which the gate then runs.
//
// Three outcomes per entry, and they are deliberately different findings:
//   - never witnessed at all: folklore, rejected by name.
//   - witnessed, and the real package no longer produces it: DRIFT, which 26
//     calls a first-class failure mode rather than a silent no-op.
//   - witnessed, and the run did not observe the entry (the failure routed to
//     another entry, or the witness could not run): named as that.
// Collapsing them would tell a corpus author who broke nothing that they wrote
// folklore, which is how a gate teaches people to ignore it.

import { finding, type GateFinding, type SubmissionCorpus } from './gate-result.js';
import { fixKey, type TruthFailure, type UpstreamVerification } from './gate-upstream.js';

/** Every twin code a witness was really run for, and how that run ended. */
const witnessedOutcomes = (
  verification: UpstreamVerification,
): ReadonlyMap<string, TruthFailure> => {
  const outcomes = new Map<string, TruthFailure>();
  for (const failure of verification.failures) {
    if (failure.kind === 'no-such-package' || failure.kind === 'directory-mismatch') continue;
    if (failure.kind === 'fix-did-not-resolve') continue;
    if (!outcomes.has(failure.at)) outcomes.set(failure.at, failure);
  }
  return outcomes;
};

const describeFailure = (code: string, failure: TruthFailure): string =>
  failure.kind === 'not-inducible'
    ? `${code} is cataloged and no longer reproduces against the real package: drift, and a fix that stopped being inducible is never silently retained. ${failure.detail}`
    : `the inducing run for ${code} never observed it (${failure.kind}). ${failure.detail}`;

/**
 * Every entry this corpus ships without having been provoked, by name.
 *
 * A fix with an executable `apply` is provoked only by the run that applied it
 * and retried successfully. A fix that is an inert docs pointer has nothing to
 * execute, so it is provoked exactly when its twin was really induced and it
 * points at a topic that resolves (which Corpus Format [28]'s `validate`
 * already checks); that is the strongest honest reading of 26 for a fix that
 * is, by construction, not a call.
 */
export function folkloreFindings(
  submission: SubmissionCorpus,
  verification: UpstreamVerification,
): readonly GateFinding[] {
  const found: GateFinding[] = [];
  const induced = new Set(verification.inducedCodes);
  const verified = new Set(verification.verifiedFixes);
  const outcomes = witnessedOutcomes(verification);

  submission.source.twins.forEach((twin, index) => {
    const at = `twins[${String(index)}] (${twin.id})`;
    const failure = outcomes.get(twin.code);
    if (failure !== undefined) {
      // The whole twin is unsettled; naming its fixes as folklore on top of
      // that would report the same one fact three times.
      found.push(
        finding('folklore', submission.directory, at, describeFailure(twin.code, failure)),
      );
      return;
    }
    if (!induced.has(twin.code)) {
      found.push(
        finding(
          'folklore',
          submission.directory,
          at,
          `the twin code ${twin.code} has no inducing test: no run of this gate ever provoked it out of the real package, and the folklore rule ships no entry a test did not provoke`,
        ),
      );
    }
    found.push(...unprovedFixes(submission, twin, induced.has(twin.code), verified));
  });
  return Object.freeze(found);
}

/** Every fix of one twin that no run proved, by name. */
function unprovedFixes(
  submission: SubmissionCorpus,
  twin: { readonly id: string; readonly code: string },
  provoked: boolean,
  verified: ReadonlySet<string>,
): readonly GateFinding[] {
  const found: GateFinding[] = [];
  (submission.source.fixes[twin.id] ?? []).forEach((fix, position) => {
    const locator = `fixes["${twin.id}"][${String(position)}]`;
    if (fix.apply === undefined) {
      if (provoked) return;
      found.push(
        finding(
          'folklore',
          submission.directory,
          locator,
          `the fix "${fix.title}" has no inducing test: its twin ${twin.code} was never provoked, so nothing ever showed this pointer was the answer to a real failure (folklore rule)`,
        ),
      );
      return;
    }
    if (verified.has(fixKey(twin.code, fix.title))) return;
    found.push(
      finding(
        'folklore',
        submission.directory,
        locator,
        `the fix "${fix.title}" was never proved: no run induced ${twin.code}, applied this fix and saw the retry succeed (folklore rule)`,
      ),
    );
  });
  return found;
}

/** Every way this corpus failed to be true about the real package (CC11 [25]). */
export function registryTruthFindings(
  submission: SubmissionCorpus,
  verification: UpstreamVerification,
): readonly GateFinding[] {
  return Object.freeze(
    verification.failures.map((failure) =>
      finding('registryTruth', submission.directory, failure.at, failure.detail),
    ),
  );
}
