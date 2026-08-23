// Registry Website [40]: the whole site, as files.
//
// Pure: a model in, the exact bytes of every page and every served document
// out. Nothing here touches a disk or a network, which is what lets the audit
// in `read-only.ts` judge the real output of a real build inside a unit test
// rather than after one.
//
// A served document is emitted TWICE and the two are different promises. The
// `.md` copy is the document, byte for byte, with nothing added and nothing
// rewritten. The `.html` page is a view of it: the same text, escaped, inside
// one `pre` block, so a document can be read in a browser without ever being
// interpreted as markup.

import type { MostWantedList } from './most-wanted.ts';
import type { EmittedFile } from './read-only.ts';
import type { CorpusListing } from './registry.ts';
import { escapeHtml, page } from './render.ts';

/** A document served exactly as it was read, plus where it was read from. */
export interface ServedDocument {
  readonly source: string;
  readonly text: string;
}

export interface SiteModel {
  readonly listings: readonly CorpusListing[];
  readonly spec: ServedDocument;
  readonly priming: ServedDocument;
  readonly mostWanted: MostWantedList;
}

const file = (path: string, contents: string): EmittedFile => Object.freeze({ path, contents });

const list = (items: readonly string[], className: string): string =>
  items.length === 0
    ? ''
    : `      <ul class="${className}">
${items.map((item) => `        <li>${escapeHtml(item)}</li>`).join('\n')}
      </ul>`;

const trustWord = (listing: CorpusListing): string =>
  listing.published ? listing.trust : `${listing.trust} (unpublished)`;

function registryRow(listing: CorpusListing): string {
  return `        <tr>
          <th scope="row"><a href="#${escapeHtml(listing.directory)}">${escapeHtml(listing.directory)}</a></th>
          <td>${escapeHtml(listing.provider)}</td>
          <td>${escapeHtml(listing.targetVersion)}</td>
          <td data-trust="${escapeHtml(listing.trust)}" data-published="${String(listing.published)}">${escapeHtml(trustWord(listing))}</td>
          <td class="numeric">${String(listing.topics.length)}</td>
          <td class="numeric">${String(listing.twinCount)}</td>
          <td class="numeric">${String(listing.fixCount)}</td>
        </tr>`;
}

function registrySection(listing: CorpusListing): string {
  return `      <section id="${escapeHtml(listing.directory)}">
        <h2>${escapeHtml(listing.directory)}</h2>
        <p class="lede">A corpus for <code>${escapeHtml(listing.package)}</code>, authored against
        version ${escapeHtml(listing.targetVersion)}, published by
        <code>${escapeHtml(listing.provider)}</code> at the
        <strong>${escapeHtml(trustWord(listing))}</strong> tier.</p>
        <h3>Topics</h3>
${list(listing.topics, 'topics')}
        <h3>Why this tier</h3>
${list(listing.reasons, 'reasons')}
      </section>`;
}

function registryPage(listings: readonly CorpusListing[]): string {
  const rows =
    listings.length === 0
      ? `        <tr><td colspan="7">The registry carries no corpus yet.</td></tr>`
      : listings.map(registryRow).join('\n');
  return page({
    title: 'Comprehendo registry',
    heading: 'Comprehendo registry',
    current: 'index.html',
    body: `      <p class="lede">Every corpus the registry carries, the package it documents, and where
      it stands on the trust ladder: community, endorsed, or native.</p>
      <table>
        <caption>Registry contents</caption>
        <thead>
          <tr>
            <th scope="col">Corpus</th>
            <th scope="col">Published as</th>
            <th scope="col">Target version</th>
            <th scope="col">Trust</th>
            <th scope="col">Topics</th>
            <th scope="col">Failures</th>
            <th scope="col">Fixes</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>
      <h2>Submitting a corpus</h2>
      <p>There is no submission on this site, by design. A corpus arrives as a pull request
      against <code>comprehendo-protocol/registry</code>, where the submission gate runs every
      check on it and a human reviews the diff. This page only reads what that channel already
      published.</p>
${listings.map(registrySection).join('\n')}`,
  });
}

function documentPage(title: string, heading: string, current: string, served: ServedDocument): string {
  return page({
    title,
    heading,
    current,
    body: `      <p class="lede">Served exactly as it is committed, from
      <code>${escapeHtml(served.source)}</code>.
      <a href="${current.replace('.html', '.md')}">Download the source file.</a></p>
      <pre class="document" data-source="${escapeHtml(served.source)}">${escapeHtml(served.text)}</pre>`,
  });
}

function mostWantedBody(most: MostWantedList): string {
  if (most.kind === 'unavailable') {
    return `      <p class="lede">The most-wanted list could not be read from
      <code>${escapeHtml(most.repository)}</code>, so this page shows no ranking rather than an
      empty one.</p>
      <p>${escapeHtml(most.reason)}</p>`;
  }
  if (most.requests.length === 0) {
    return `      <p class="lede">No corpus has been requested yet on
      <code>${escapeHtml(most.repository)}</code>.</p>
      <p>Demand is ranked from reactions on issues somebody opened deliberately. Nothing on this
      site is measured, counted, or collected from anyone reading it.</p>`;
  }
  const rows = most.requests
    .map(
      (request) => `        <tr>
          <td class="numeric">${String(request.rank)}</td>
          <th scope="row"><a href="${escapeHtml(request.url)}">${escapeHtml(request.title)}</a></th>
          <td class="numeric">${String(request.upvotes)}</td>
          <td class="numeric">${String(request.totalReactions)}</td>
        </tr>`,
    )
    .join('\n');
  return `      <p class="lede">The packages most people have asked for a corpus for, ranked by
      reactions on <code>${escapeHtml(most.repository)}</code>. Nothing here is measured from
      anyone reading this site.</p>
      <table>
        <caption>Corpus requests, most reacted-to first</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Request</th>
            <th scope="col">Thumbs up</th>
            <th scope="col">All reactions</th>
          </tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>`;
}

/** The whole site: every page, and every document served beside it. */
export function buildSite(model: SiteModel): readonly EmittedFile[] {
  return Object.freeze([
    file('index.html', registryPage(model.listings)),
    file(
      'spec.html',
      documentPage('Comprehendo specification', 'Specification', 'spec.html', model.spec),
    ),
    file('spec.md', model.spec.text),
    file(
      'priming.html',
      documentPage('Comprehendo priming snippet', 'Priming snippet', 'priming.html', model.priming),
    ),
    file('priming.md', model.priming.text),
    file(
      'most-wanted.html',
      page({
        title: 'Most wanted corpora',
        heading: 'Most wanted',
        current: 'most-wanted.html',
        body: mostWantedBody(model.mostWanted),
      }),
    ),
  ]);
}
