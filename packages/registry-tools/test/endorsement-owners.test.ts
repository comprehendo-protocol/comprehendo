// Owner Endorsement [30]: the `comprehendo.owners` delegation decision.
//
// The owner names identities in their manifest once; from then on those
// people's approvals on a corpus PR count as owner review, with no package
// republish per corpus update. What is testable here is exactly the decision,
// and deliberately only the decision: given the identities the LIVE manifest
// declares and the identities that really approved the PR, is a named delegate
// among them. Where the approver list comes from is the registry repo's GitHub
// API call, on the far side of the same boundary [29] already drew (see the
// feature doc's Known Issues).
//
// Every rule fails CLOSED, the way [29]'s merge policy does. An identity that
// cannot be read is never read as a permissive one: an owner entry with no
// scheme names no identity provider, so it names nobody, and it says so.

import { describe, expect, it } from 'vitest';

import { approvingDelegate, githubApprovers } from '../src/endorsement-owners.js';

describe('a named delegate approving the PR is owner review', () => {
  it('approves when a declared delegate is among the approvers', () => {
    const delegation = approvingDelegate({
      owners: ['github:octocat', 'github:hubot'],
      approvers: ['github:hubot'],
    });

    expect(delegation.approved).toBe(true);
    expect(delegation.delegate).toBe('github:hubot');
  });

  it('needs no republish: the same declaration answers a second, later PR', () => {
    const owners = ['github:octocat'];

    expect(approvingDelegate({ owners, approvers: ['github:octocat'] }).approved).toBe(true);
    expect(approvingDelegate({ owners, approvers: ['github:octocat'] }).approved).toBe(true);
  });

  it('folds the case of a login, which the identity provider does too', () => {
    const delegation = approvingDelegate({
      owners: ['github:OctoCat'],
      approvers: ['github:octocat'],
    });

    expect(delegation.approved).toBe(true);
  });
});

describe('everything else fails closed', () => {
  it('refuses an approver the manifest never named', () => {
    const delegation = approvingDelegate({
      owners: ['github:octocat'],
      approvers: ['github:someone-else'],
    });

    expect(delegation.approved).toBe(false);
    expect(delegation.delegate).toBeUndefined();
    expect(delegation.reasons.join(' ')).toContain('named');
  });

  it('refuses when the manifest declares no owners at all', () => {
    const delegation = approvingDelegate({ owners: undefined, approvers: ['github:octocat'] });

    expect(delegation.approved).toBe(false);
    expect(delegation.reasons.join(' ')).toContain('owners');
  });

  it('refuses when the manifest declares an empty owners list', () => {
    const delegation = approvingDelegate({ owners: [], approvers: ['github:octocat'] });

    expect(delegation.approved).toBe(false);
  });

  it('refuses when nobody approved the PR', () => {
    const delegation = approvingDelegate({ owners: ['github:octocat'], approvers: [] });

    expect(delegation.approved).toBe(false);
    expect(delegation.reasons.join(' ')).toContain('approv');
  });

  it('refuses an owner entry with no scheme, and names it as unreadable', () => {
    const delegation = approvingDelegate({ owners: ['octocat'], approvers: ['octocat'] });

    expect(delegation.approved).toBe(false);
    expect(delegation.reasons.join(' ')).toContain('octocat');
    expect(delegation.reasons.join(' ')).toContain('scheme');
  });

  it('refuses an approver identity with no scheme, whoever they are', () => {
    const delegation = approvingDelegate({ owners: ['github:octocat'], approvers: ['octocat'] });

    expect(delegation.approved).toBe(false);
  });

  it('refuses an identity from another provider with the same login', () => {
    const delegation = approvingDelegate({
      owners: ['github:octocat'],
      approvers: ['gitlab:octocat'],
    });

    expect(delegation.approved).toBe(false);
  });
});

describe('the boundary the registry repo hands identities across', () => {
  it('qualifies bare GitHub logins into the scheme the manifest spells', () => {
    expect(githubApprovers(['octocat', 'hubot'])).toEqual(['github:octocat', 'github:hubot']);
  });

  it('leaves an already-qualified identity alone rather than double-prefixing it', () => {
    expect(githubApprovers(['github:octocat'])).toEqual(['github:octocat']);
  });
});
