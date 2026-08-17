import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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

const SITE_URL = process.env.APP_URL || "https://www.tols.fun";
const TITLE = "TOLS Casino — Play & Win";
const DESCRIPTION =
  "Provably-fair crypto casino: Originals, slots, live dealers and instant withdrawals. Play Dice, Mines, Crash, Plinko and more on TOLS.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · TOLS Casino" },
  description: DESCRIPTION,
  applicationName: "TOLS Casino",
  keywords: ["TOLS", "casino", "slots", "live casino", "provably fair", "crypto casino", "dice", "crash", "plinko", "mines"],
  authors: [{ name: "TOLS Casino" }],
  alternates: { canonical: "/" },
  // Favicon (src/app/icon.svg) and apple-touch-icon (src/app/apple-icon.png)
  // are auto-registered by Next from the app directory — local TOLS marks, no
  // third-party CDN.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "TOLS Casino",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "TOLS Casino" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f1015",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Language chosen by the middleware from the visitor's region (or their saved
  // preference), so the document advertises the right language to the browser.
  const locale = (await cookies()).get("locale")?.value || "en";
  return (
    <html lang={locale} suppressHydrationWarning>
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
