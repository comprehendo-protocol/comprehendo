// The real witness for the CSP `form-action` twin: a real, headless Chromium
// (`playwright`, this package's own real devDependency, not the editor's
// session-only MCP tools) navigates to the real consent origin, fills the
// real form, and submits it. What the browser's own `console` event API
// really reports (or does not) is the entire signal; nothing here parses HTML
// or inspects the CSP header itself; a browser is the only thing on this
// machine that actually enforces the directive, and CC11 Registry Truth [25]
// means the corpus claims what a real enforcer really did, not what the
// header text implies it would do.

import { chromium } from 'playwright';

export interface CspSubmitResult {
  /** Every real `console.error`-level message the page emitted, verbatim. */
  readonly consoleErrors: readonly string[];
  /** The page's real URL after the submit attempt: unchanged when blocked. */
  readonly landedOn: string;
}

/** Submits the consent form for real and reports what the real browser really did. */
export async function submitConsentForm(consentUrl: string): Promise<CspSubmitResult> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(consentUrl);
    await page.fill('input[name="bridge_token"]', 'a-real-bridge-token');
    // `noWaitAfter`: a genuinely blocked submit schedules no navigation, so
    // waiting for one (the click helper's default) would hang for real.
    await page.click('button', { noWaitAfter: true });
    await page.waitForTimeout(500);

    return { consoleErrors: Object.freeze([...consoleErrors]), landedOn: page.url() };
  } finally {
    await browser.close();
  }
}
