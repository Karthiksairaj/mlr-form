import { describe, expect, it } from 'vitest';
import { assertSafeUrl } from './url-policy.js';

describe('assertSafeUrl', () => {
  it('allows any HTTP(S) host when the allowlist is disabled', async () => {
    await expect(assertSafeUrl('https://example.org/form', {
      allowedHosts: new Set(),
      allowPrivateNetworks: true,
      requireAllowedHost: false
    })).resolves.toBeInstanceOf(URL);
  });

  it('requires an allowlisted host', async () => {
    await expect(assertSafeUrl('https://example.org/form', {
      allowedHosts: new Set(['example.com']),
      allowPrivateNetworks: true,
      requireAllowedHost: true
    })).rejects.toMatchObject({ code: 'host_not_allowed' });
  });

  it('allows exact hosts and subdomains', async () => {
    await expect(assertSafeUrl('https://forms.example.com/form', {
      allowedHosts: new Set(['example.com']),
      allowPrivateNetworks: true,
      requireAllowedHost: true
    })).resolves.toBeInstanceOf(URL);
  });

  it('blocks private network targets by default', async () => {
    await expect(assertSafeUrl('http://127.0.0.1/form', {
      allowedHosts: new Set(['127.0.0.1']),
      allowPrivateNetworks: false,
      requireAllowedHost: true
    })).rejects.toMatchObject({ code: 'private_network_blocked' });
  });

  it('blocks non-http protocols', async () => {
    await expect(assertSafeUrl('file:///etc/passwd', {
      allowedHosts: new Set(['example.com']),
      allowPrivateNetworks: true,
      requireAllowedHost: true
    })).rejects.toMatchObject({ code: 'invalid_protocol' });
  });
});
