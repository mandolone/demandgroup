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
  title: "Demand Group — Original Wear OS Watch Faces",
  description:
    "Explore original Wear OS watch faces, studio previews and the complete Demand Group collection. Designed in Italy.",
  applicationName: "Demand Group",
  icons: { icon: "/favicon.jpg", shortcut: "/favicon.jpg", apple: "/favicon.jpg" },
  openGraph: {
    title: "Demand Group — Space-inspired. Mechanically minded.",
    description:
      "Independent, vintage-inspired watch faces designed for Wear OS.",
    type: "website",
    images: [{ url: "https://demandgroup.smokeandthink.com/products/new-releases/megastructure-campaign.webp", width: 1024, height: 500 }],
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
