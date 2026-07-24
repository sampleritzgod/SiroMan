import type { Metadata } from "next";
import { Caveat, Fraunces, Inter, Patrick_Hand } from "next/font/google";
import { Providers } from "@/components/providers";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-serif",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
  weight: ["500", "600", "700"],
});

const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  variable: "--font-patrick",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SiroMan",
  description: "Sticky notes that help you keep your commitments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body
        className={`${inter.variable} ${fraunces.variable} ${caveat.variable} ${patrickHand.variable} min-h-screen bg-canvas font-sans text-ink antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
