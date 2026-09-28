import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALOYRI | Skincare CRM",
  description: "Your private skincare business CRM. Orders, customers, inventory and finances in BDT.",
  icons: {
    icon: "/aloyri-logo.webp",
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
