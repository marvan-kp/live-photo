import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0A0B10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://web-rho-sage-25.vercel.app"),
  title: "Signature by Marvan — Live Photography & AI Suite",
  description:
    "Live photography and instant photo sharing platform by Signature by Marvan. Powered by deep neural AI face recognition, live QR access, story reels, and cloud storage.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Signature by Marvan — Live Photography & AI Suite",
    description: "Instant event photo sharing, AI face recognition, 9:16 story reels, and live stage projector wall.",
    siteName: "Signature by Marvan",
    images: [{ url: "/logo.png", width: 800, height: 800, alt: "Signature by Marvan Logo" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Signature by Marvan — Live Photography & AI Suite",
    description: "Instant event photo sharing, AI face recognition, 9:16 story reels, and live stage projector wall.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
