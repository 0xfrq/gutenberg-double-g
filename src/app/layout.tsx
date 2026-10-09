import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "Dogear",
    template: "%s · Dogear",
  },
  description:
    "Read free classics from Project Gutenberg and your own EPUBs, comfortably, on any screen. Dogear keeps your page.",
  applicationName: "Dogear",
  appleWebApp: {
    capable: true,
    title: "Dogear",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17130f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-dvh bg-paper text-ink">{children}</body>
    </html>
  );
}
