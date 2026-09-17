import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
import "../public/shop.css";
import Script from "next/script";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://demandgroup.smokeandthink.com"),
  alternates: { canonical: "/" },
  title: "Demand Group — Space & Mechanical Wear OS Watch Faces",
  description:
    "Explore free and paid Wear OS watch faces inspired by space, vintage instruments and unconventional mechanics. Designed in Italy.",
  applicationName: "Demand Group",
  icons: { icon: "/favicon.jpg", shortcut: "/favicon.jpg", apple: "/favicon.jpg" },
  openGraph: {
    title: "Demand Group — Space-inspired. Mechanically minded.",
    description:
      "Independent, vintage-inspired watch faces designed for Wear OS.",
    type: "website",
    images: [{ url: "https://demandgroup.smokeandthink.com/hero-collection.png", width: 1536, height: 1024 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        {children}
        <Script src="/consent.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
