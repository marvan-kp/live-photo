export function getPublicBaseUrl(): string {
  // 1. Explicit Vercel public URL env
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }
  // 2. Client-side window check
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return origin.replace("localhost", "192.168.0.103").replace("127.0.0.1", "192.168.0.103");
    }
    return origin;
  }
  // 3. Fallback
  return "http://192.168.0.103:3000";
}

