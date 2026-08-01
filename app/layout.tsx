import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sanal Salon",
  description: "Berber danışmanı ile saç ve sakal modellerini kesimden önce güvenle önizleyin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
