import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";
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
  title: "Demand Group — Independent Wear OS Watch Faces",
  description:
    "A small independent studio creating premium, vintage-inspired and uncommon watch faces for Wear OS.",
  applicationName: "Demand Group",
  openGraph: {
    title: "Demand Group — Uncommon timepieces for remarkable wrists",
    description:
      "Independent, vintage-inspired watch faces designed for Wear OS.",
    type: "website",
    images: [{ url: "/hero-collection.png", width: 1536, height: 1024 }],
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
