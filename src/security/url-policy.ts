import dns from 'node:dns/promises';
import net from 'node:net';

export class UrlPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  const [a, b] = octets;
  if (a === undefined || b === undefined) return true;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (!net.isIPv6(ip)) return true;
  const normalized = ip.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

function hostAllowed(hostname: string, allowedHosts: Set<string>): boolean {
  if (allowedHosts.size === 0) return false;
  const host = hostname.toLowerCase();
  return [...allowedHosts].some(
    allowed => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export async function assertSafeUrl(
  rawUrl: string,
  options: {
    allowedHosts?: Set<string>;
    allowPrivateNetworks: boolean;
    requireAllowedHost?: boolean;
  }
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlPolicyError('invalid_url', 'The target URL is invalid.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new UrlPolicyError('invalid_protocol', 'Only HTTP and HTTPS URLs are allowed.');
  }
  if (url.username || url.password) {
    throw new UrlPolicyError('credentials_not_allowed', 'Credentials in URLs are not allowed.');
  }
  if (
    options.requireAllowedHost &&
    !hostAllowed(url.hostname, options.allowedHosts ?? new Set())
  ) {
    throw new UrlPolicyError(
      'host_not_allowed',
      `Host ${url.hostname} is not in ALLOWED_TARGET_HOSTS.`
    );
  }

  if (!options.allowPrivateNetworks) {
    const directIp = net.isIP(url.hostname);
    const addresses = directIp
      ? [{ address: url.hostname }]
      : await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(item => isPrivateIp(item.address))) {
      throw new UrlPolicyError(
        'private_network_blocked',
        `Host ${url.hostname} resolves to a blocked network.`
      );
    }
  }

  return url;
}
