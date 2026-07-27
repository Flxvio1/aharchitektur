import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

// neo-grotesque carries the whole interface: Swiss-style typography works by
// weight and scale rather than by mixing families
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// the one exception — a light classical serif reserved for the closing
// statement, where the wide-tracked caps are the whole point
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "AH Architektur — Funktionelle, individuelle Architektur",
  description:
    "AH Architektur in Lausen: massgeschneiderte Neubauten und Umbauten mit klarer, zeitloser Formsprache.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
