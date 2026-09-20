import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avika Collection | Multi-brand fashion, New Delhi",
  description:
    "Discover clothing and accessories at Avika Collection, a multi-brand retailer in Lajpat Nagar, New Delhi. Demonstration store — ordering is not live.",
  robots: { index: false, follow: false },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
