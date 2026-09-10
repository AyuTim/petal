import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { PageSkeleton } from "@/components/shell";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "petals",
  description: "Private lists for shopping, wishes, and bucket-list plans.",
  icons: {
    icon: [{ url: "/petals-flower-logo.png?v=2", type: "image/png", sizes: "any" }],
    shortcut: ["/petals-flower-logo.png?v=2"],
    apple: [{ url: "/petals-flower-logo.png?v=2", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} antialiased`}>
        <Suspense fallback={<PageSkeleton />}>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}
