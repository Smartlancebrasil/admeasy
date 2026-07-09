import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Admeasy — Gestão Imobiliária",
  description: "Sistema de administração imobiliária",
  metadataBase: new URL("https://admeasy.vercel.app"),
  openGraph: {
    title: "Admeasy — Gestão Imobiliária",
    description: "Sistema de administração imobiliária",
    url: "https://admeasy.vercel.app",
    siteName: "Admeasy",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Admeasy — Inteligência em Gestão de Locações",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Admeasy — Gestão Imobiliária",
    description: "Sistema de administração imobiliária",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
