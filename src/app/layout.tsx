import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { CSPostHogProvider } from "./PostHogProvider";
import { Inter } from "next/font/google";
import NavBar from "./NavBar";
import "./globals.css";

import dynamic from "next/dynamic";

const PostHogPageView = dynamic(() => import("./PostHogPageView"), {
  ssr: false,
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Blitzer",
  description: "Scores and statistics for Dutch Blitz",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.blitzer.fun",
    siteName: "Blitzer",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <CSPostHogProvider>
          <body className={`${inter.className} bg-brand`}>
            <PostHogPageView />
            <NavBar>
              {children}
              <Analytics />
            </NavBar>
          </body>
        </CSPostHogProvider>
      </html>
    </ClerkProvider>
  );
}
