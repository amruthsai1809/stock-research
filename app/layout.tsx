import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://tide-equity-research.amruthsai1809.chatgpt.site"),
  title: "TIDE — Evidence-first equity research",
  description:
    "Research stocks with transparent multi-factor scores, dip analysis, 13F portfolios, public-official trades, and private AI-assisted memos.",
  applicationName: "TIDE",
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
    title: "TIDE — Evidence before opinion",
    description:
      "Transparent stock scores, filing-linked evidence, dip analysis, portfolios, and private AI-assisted research.",
    type: "website",
    siteName: "TIDE",
    url: "/",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "TIDE — Evidence before opinion",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TIDE — Evidence before opinion",
    description:
      "Transparent stock scores, filing-linked evidence, dip analysis, portfolios, and private AI-assisted research.",
    images: ["/og.png"],
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
