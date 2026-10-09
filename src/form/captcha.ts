import type { Locator, Page } from 'playwright';

const providerSelectors = [
  {
    provider: 'reCAPTCHA',
    marker: 'iframe[src*="recaptcha"], script[src*="recaptcha"], .g-recaptcha, [data-sitekey][class*="recaptcha"]',
    // The .g-recaptcha mount and ordinary badge are present on successful
    // invisible integrations. Only a visible challenge frame needs a person.
    challenge: 'iframe[title*="recaptcha challenge" i], iframe[src*="recaptcha"][title*="challenge" i]'
  },
  {
    provider: 'hCaptcha',
    marker: 'iframe[src*="hcaptcha"], script[src*="hcaptcha"], .h-captcha',
    challenge: 'iframe[src*="hcaptcha"], .h-captcha'
  },
  {
    provider: 'Cloudflare Turnstile',
    marker: 'iframe[src*="challenges.cloudflare.com"], script[src*="challenges.cloudflare.com"], .cf-turnstile',
    challenge: 'iframe[src*="challenges.cloudflare.com"], .cf-turnstile'
  }
];

async function anyVisible(locator: Locator): Promise<boolean> {
  const count = await locator.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    if (await locator.nth(index).isVisible().catch(() => false)) return true;
  }
  return false;
}

export async function detectCaptcha(
  page: Page
): Promise<{ detected: boolean; provider?: string; blocking?: boolean }> {
  for (const frame of page.frames()) {
    for (const candidate of providerSelectors) {
      if ((await frame.locator(candidate.marker).count().catch(() => 0)) > 0) {
        return {
          detected: true,
          provider: candidate.provider,
          blocking: await anyVisible(frame.locator(candidate.challenge))
        };
      }
    }
    const generic = frame.getByText(/captcha|verify you are human|security challenge/i);
    if ((await generic.count().catch(() => 0)) > 0) {
      return { detected: true, provider: 'unknown', blocking: await anyVisible(generic) };
    }
  }
  return { detected: false };
}
