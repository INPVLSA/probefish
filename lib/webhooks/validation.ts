/**
 * Validates webhook URLs to prevent SSRF attacks.
 * Blocks requests to localhost, private IP ranges, and internal domains.
 */
export function isAllowedWebhookUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Block non-http(s) protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return false;
    }

    // Block private IP ranges
    const ipv4Match = hostname.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );
    if (ipv4Match) {
      const [, aStr, bStr] = ipv4Match;
      const a = Number(aStr);
      const b = Number(bStr);

      // 10.x.x.x (Class A private)
      if (a === 10) return false;

      // 172.16.x.x - 172.31.x.x (Class B private)
      if (a === 172 && b >= 16 && b <= 31) return false;

      // 192.168.x.x (Class C private)
      if (a === 192 && b === 168) return false;

      // 169.254.x.x (link-local)
      if (a === 169 && b === 254) return false;

      // 0.0.0.0 (all interfaces)
      if (a === 0) return false;
    }

    // Block common internal domains
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
