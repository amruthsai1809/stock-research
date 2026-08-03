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
  title: "TIDE — Fundamentals-first equity research",
  description:
    "Find financially resilient businesses inside meaningful market drawdowns with transparent, filing-linked analysis.",
  applicationName: "TIDE",
  keywords: ["stock research", "dip finder", "fundamental analysis", "SEC filings", "valuation"],
  openGraph: {
    title: "TIDE — Find the signal beneath the selloff",
    description:
      "A transparent equity research workbench for finding resilient businesses inside meaningful drawdowns.",
    type: "website",
    siteName: "TIDE",
  },
  twitter: {
    card: "summary_large_image",
    title: "TIDE — Find the signal beneath the selloff",
    description:
      "A transparent equity research workbench for finding resilient businesses inside meaningful drawdowns.",
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
