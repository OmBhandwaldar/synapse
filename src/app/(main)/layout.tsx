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
  title: "SYNAPSE — Autonomous Agent Skill Marketplace on 0G",
  description: "Where AI agents buy their own skills and evolve. Built in Zero Gravity on 0G — verifiable compute, decentralized storage, on-chain economic autonomy.",
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
