import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { circleLocalization } from "@/lib/clerk-localization";
import { Analytics } from "@vercel/analytics/react";
import { CSPostHogProvider } from "./PostHogProvider";
import { Inter, Fraunces } from "next/font/google";
import NavBar from "./NavBar";
import "./globals.css";
import PostHogPageView from "./PostHogPageView";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
  variable: "--font-fraunces",
});

// Edge to edge under the notch (content pads back with safe-area insets), and
// let Android's keyboard shrink the layout like iOS does. Zoom stays allowed.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // The app has no dark theme; match the white header bar.
  themeColor: "#ffffff",
  colorScheme: "light",
};

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_URL
    ? new URL(`https://www.blitzer.fun`)
    : new URL(`http://localhost:3000`),
  title: "Blitzer",
  description: "Scores and statistics for Dutch Blitz",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.blitzer.fun",
    siteName: "Blitzer",
    images: [
      {
        url: "/img/og-image.png",
        width: 1200,
        height: 630,
        alt: "Blitzer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@blitzerfun",
    creator: "@mwickett",
    title: "Blitzer",
    description:
      "Blitzer does the Dutch Blitz math, keeps the totals, and tells you who's going to win.",
    images: [
      {
        url: "/img/twitter-image.png",
        alt: "Blitzer",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={circleLocalization}
      // Full-width provider buttons above the email form, so "Continue with
      // Google" is the first thing on the sign-up screen.
      appearance={{
        options: {
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
        },
      }}
    >
      <html lang="en">
        <CSPostHogProvider>
          <body className={`${inter.className} ${fraunces.variable} bg-brand`}>
            <Suspense fallback={null}>
              <ClerkProvider dynamic>
                <PostHogPageView />
              </ClerkProvider>
            </Suspense>
            <NavBar>
              {children}
              <Footer />
              <Analytics />
            </NavBar>
          </body>
        </CSPostHogProvider>
      </html>
    </ClerkProvider>
  );
}
