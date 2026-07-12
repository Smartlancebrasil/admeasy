import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.admeasy.com.br";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

const TITLE = "Admeasy — Sistema de Gestão para Imobiliárias";
const DESCRIPTION =
  "Gestão completa de aluguéis, contratos, cobranças, repasses e inadimplência para imobiliárias. Boleto, Pix e portal do locatário em um só sistema.";

export const metadata: Metadata = {
  title: { default: TITLE, template: "%s | Admeasy" },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  keywords: [
    "sistema para imobiliária",
    "gestão de aluguéis",
    "software imobiliário",
    "administração de locações",
    "cobrança de aluguel",
    "gestão de contratos de locação",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
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
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
};

// Dados estruturados (schema.org) para o Google entender o que é o produto —
// ajuda a exibir rich results (preço, categoria) nos resultados de busca.
const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Admeasy",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  url: SITE_URL,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "BRL",
    lowPrice: "89.90",
    offerCount: "4",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={inter.className}>
        {GTM_ID && (
          <Script id="gtm-base" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {children}
      </body>
    </html>
  );
}
