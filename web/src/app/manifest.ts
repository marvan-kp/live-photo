import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Signature by Marvan — Live Photography & AI Suite",
    short_name: "Signature Live",
    description: "Live photography and instant photo sharing platform by Signature by Marvan with AI face search and 9:16 story reels.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0B10",
    theme_color: "#D4B77A",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
