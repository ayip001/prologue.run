import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "prologue.run - Scout Your Next Race",
  description:
    "Preview marathon routes through interactive 360° street-level imagery. Know exactly what to expect before race day.",
  keywords: [
    "marathon",
    "running",
    "360 view",
    "street view",
    "race preview",
    "route viewer",
  ],
  authors: [{ name: "prologue.run" }],
  openGraph: {
    title: "prologue.run - Scout Your Next Race",
    description:
      "Preview marathon routes through interactive 360° street-level imagery.",
    url: "https://prologue.run",
    siteName: "prologue.run",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "prologue.run - Scout Your Next Race",
    description:
      "Preview marathon routes through interactive 360° street-level imagery.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
