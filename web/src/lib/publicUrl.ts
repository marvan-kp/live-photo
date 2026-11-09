export const CANONICAL_PUBLIC_DOMAIN = "https://web-rho-sage-25.vercel.app";

export function getPublicBaseUrl(): string {
  // 1. Explicit production custom domain if specified
  if (process.env.NEXT_PUBLIC_SITE_URL && !process.env.NEXT_PUBLIC_SITE_URL.includes("localhost")) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  // 2. Client-side browser window check
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    // If accessed via localhost/127.0.0.1 or an internal preview hash (*-projects.vercel.app),
    // force canonical public URL so guest QR scans always work worldwide without Vercel login.
    if (
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("-projects.vercel.app") ||
      origin.includes("-git-")
    ) {
      return CANONICAL_PUBLIC_DOMAIN;
    }
    // If accessed directly through official production domain or custom domain
    if (origin.includes("web-rho-sage-25.vercel.app") || !origin.includes("vercel.app")) {
      return origin;
    }
  }

  // 3. Fallback: Always return the public production domain (never internal Vercel preview hashes)
  return CANONICAL_PUBLIC_DOMAIN;
}


