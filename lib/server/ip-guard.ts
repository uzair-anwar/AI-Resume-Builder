import "server-only";
import ipaddr from "ipaddr.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost")) return true;
  return false;
}

export function isBlockedIp(ip: string): boolean {
  try {
    const addr = ipaddr.parse(ip);
    const range = addr.range();
    if (range === "unicast") {
      if (addr.kind() === "ipv6") {
        const v6 = addr as ipaddr.IPv6;
        if (v6.isIPv4MappedAddress()) {
          return isBlockedIp(v6.toIPv4Address().toString());
        }
      }
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function validateResolvedAddresses(addresses: string[]): boolean {
  for (const ip of addresses) {
    if (isBlockedIp(ip)) return false;
  }
  return addresses.length > 0;
}
