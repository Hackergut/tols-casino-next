import type { MetadataRoute } from "next";

// The casino is a single-entry app: games and sections are switched client-side
// under "/", not separate routes, so the sitemap lists the public entry point.
// Operator console and auth pages are intentionally excluded (they are noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL || "https://tols.fun";
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
