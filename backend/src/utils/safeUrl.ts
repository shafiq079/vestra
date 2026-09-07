import { isIP } from 'node:net';

function privateIp(host: string): boolean {
  if (isIP(host) === 4) {
    const parts = host.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31)
      || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0;
  }
  if (isIP(host) === 6) {
    const value = host.toLowerCase();
    return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8')
      || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
  }
  return false;
}

export function safeExternalHttpsUrl(value: string, allowedHosts?: readonly string[]): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || privateIp(host)) return null;
    if (allowedHosts && !allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return null;
    return url.toString();
  } catch {
    return null;
  }
}
