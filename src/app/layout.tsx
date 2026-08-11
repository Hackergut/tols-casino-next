import type { Metadata } from "next";
import { Inter, Michroma, Oswald } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import TelegramWebApp from "@/components/TelegramWebApp";

// Display face — wide, geometric, futuristic. Single weight (400) and
// non-tabular figures, so it is scoped to the wordmark and section headings;
// body copy and every number stay on Inter.
// Wordmark face. The supplied brand SVGs specify Oswald, so the logotype is
// set in the real thing rather than the Arial fallback an <img> would use.
const oswald = Oswald({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

const michroma = Michroma({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// One typeface across the whole platform. Inter is the linear, minimal
// grotesque this design calls for, and its tabular figures are good enough to
// also cover the numeric slot — so there is no second family to fall out of
// sync. Both theme variables point at it; `font-mono` differs only by
// switching on tabular numerals (see globals.css).
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://tols.fun"),
  title: "TOLS Casino — Play & Win",
  description:
    "Premium online casino with provably fair games, slots, live dealers, and instant withdrawals.",
  keywords: [
    "TOLS",
    "casino",
    "slots",
    "live casino",
    "provably fair",
    "crypto casino",
  ],
  authors: [{ name: "TOLS Casino" }],
  // Favicon is served from src/app/icon.svg (a local TOLS mark). The previous
  // value pointed at a third-party CDN left over from the starter template —
  // wrong branding and an external dependency on every page load.
  openGraph: {
    title: "TOLS Casino — Play & Win",
    description:
      "Premium online casino with provably fair games, slots, live dealers, and instant withdrawals.",
    siteName: "TOLS Casino",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TOLS Casino — Play & Win",
    description:
      "Premium online casino with provably fair games, slots, live dealers, and instant withdrawals.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${michroma.variable} ${oswald.variable} antialiased bg-background text-foreground`}
      >
        {/* afterInteractive (not beforeInteractive): a beforeInteractive script
            placed in the App Router <body> renders an inline <script> during SSR
            that isn't part of React's client tree, mismatching hydration on every
            load. TelegramWebApp polls for window.Telegram.WebApp, so loading the
            SDK right after hydration is fine. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
        <TelegramWebApp />
        {children}
      </body>
    </html>
  );
}
