import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skinventory | Skincare CRM",
  description: "Your private skincare business CRM. Orders, customers, inventory and finances in BDT.",
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
