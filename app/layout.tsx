import type { Metadata } from "next";
import "./globals.css";
import "./design-system.css";

export const metadata: Metadata = {
  title: "ALOYRI | Skincare CRM",
  description: "Your private skincare business CRM. Orders, customers, inventory and finances in BDT.",
  icons: {
    icon: [{ url: "/favicon.svg?v=aloyri", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/favicon.svg?v=aloyri",
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
