// Submission Gate [29]'s trust ladder: the human layer, on top of the content
// checks. Green CI is a precondition for an automatic merge, never a licence
// for one, and this is where that distinction is enforced.

import { describe, expect, it } from 'vitest';

import { mergePolicy } from '../src/gate-policy.js';
import type { PullRequestFacts } from '../src/gate-policy.js';

const facts = (patch: Partial<PullRequestFacts> = {}): PullRequestFacts => ({
  firstTimeCorpus: false,
  targetAdoption: 'ordinary',
  touchesCodeowners: false,
  touchesApply: false,
  docsWordingOnly: false,
  ownerApproved: true,
  coreApproved: false,
  ...patch,
});

describe('the trust ladder decides what may bot-merge', () => {
  it('lets an owner-approved, green, ordinary update bot-merge', () => {
    const policy = mergePolicy(facts(), true, false);

    expect(policy.botMergeEligible).toBe(true);
    expect(policy.requiresCoreReview).toBe(false);
  });

  it('never bot-merges a first-time corpus for a high-adoption package, even green', () => {
    const policy = mergePolicy(
      facts({ firstTimeCorpus: true, targetAdoption: 'high' }),
      true,
      false,
    );

    expect(policy.botMergeEligible).toBe(false);
    expect(policy.requiresCoreReview).toBe(true);
    expect(policy.reasons.join(' ')).toContain('first-time');
  });

  it('treats unknown adoption as high for a first-time corpus, failing closed', () => {
    const unknownAdoption = facts({ firstTimeCorpus: true });
    delete (unknownAdoption as { targetAdoption?: string }).targetAdoption;
    const policy = mergePolicy(unknownAdoption, true, false);

    expect(policy.botMergeEligible).toBe(false);
    expect(policy.requiresCoreReview).toBe(true);
  });

  it('lets a first-time corpus for an ordinary package bot-merge on owner approval', () => {
    const policy = mergePolicy(
      facts({ firstTimeCorpus: true, targetAdoption: 'ordinary' }),
      true,
      false,
    );

    expect(policy.botMergeEligible).toBe(true);
  });

  it('requires core approval for a CODEOWNERS change regardless of CI', () => {
    const green = mergePolicy(facts({ touchesCodeowners: true }), true, false);
    const red = mergePolicy(facts({ touchesCodeowners: true }), false, false);

    expect(green.requiresCoreReview).toBe(true);
    expect(red.requiresCoreReview).toBe(true);
    expect(green.botMergeEligible).toBe(false);
  });

  it('elevates review for a diff touching fixes[].apply', () => {
    const owner = mergePolicy(facts({ touchesApply: true }), true, false);
    const core = mergePolicy(facts({ touchesApply: true, coreApproved: true }), true, false);

    expect(owner.elevatedReview).toBe(true);
    expect(owner.botMergeEligible).toBe(false);
    expect(core.botMergeEligible).toBe(true);
  });

  it('elevates review for a destructive apply the danger lint found', () => {
    const policy = mergePolicy(facts({ docsWordingOnly: true }), true, true);

    expect(policy.elevatedReview).toBe(true);
    expect(policy.botMergeEligible).toBe(false);
  });

  it('lets a docs-wording-only diff bot-merge', () => {
    const policy = mergePolicy(facts({ docsWordingOnly: true }), true, false);

    expect(policy.botMergeEligible).toBe(true);
  });

  it('never bot-merges on red CI, whatever the approvals', () => {
    const policy = mergePolicy(facts({ coreApproved: true }), false, false);

    expect(policy.botMergeEligible).toBe(false);
    expect(policy.reasons.join(' ')).toContain('CI');
  });

  it('never bot-merges without an owner approval', () => {
    const policy = mergePolicy(facts({ ownerApproved: false }), true, false);

    expect(policy.botMergeEligible).toBe(false);
  });

  it('never bot-merges when CI knows nothing about the PR at all', () => {
    const policy = mergePolicy(undefined, true, false);

    expect(policy.botMergeEligible).toBe(false);
    expect(policy.requiresCoreReview).toBe(true);
  });
});
