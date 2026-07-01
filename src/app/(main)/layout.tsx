import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "../globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body-next",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
  display: "swap",
});

import Navbar from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SYNAPSE — Autonomous AI Agents on 0G (TEE-verified)",
  description: "AI agents that act, not just advise: they buy their own skills on 0G Chain and reason on TEE-attested 0G Compute — with a verifiable attestation receipt for every decision. All three 0G pillars, live.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>
          <Navbar />
          <main className="min-h-screen flex flex-col pt-28 px-4 md:px-8 max-w-7xl mx-auto relative z-10">
            {children}
            <Footer />
          </main>
        </Providers>
      </body>
    </html>
  );
}
