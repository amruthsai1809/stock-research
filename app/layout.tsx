import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { product } from "@/src/config/product";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://amruthg.com"),
  title: `${product.name} — Evidence-first equity research`,
  description:
    "Research stocks with transparent multi-factor scores, dip analysis, 13F portfolios, public-official trades, and private AI-assisted memos.",
  applicationName: product.name,
  keywords: [
    "stock research",
    "AI stock analysis",
    "dip finder",
    "fundamental analysis",
    "13F filings",
    "public official trades",
    "portfolio comparison",
    "valuation",
  ],
  openGraph: {
    title: `${product.name} — Evidence before opinion`,
    description:
      "Transparent stock scores, filing-linked evidence, dip analysis, portfolios, and private AI-assisted research.",
    type: "website",
    siteName: product.name,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${product.name} — Evidence before opinion`,
    description:
      "Transparent stock scores, filing-linked evidence, dip analysis, portfolios, and private AI-assisted research.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
