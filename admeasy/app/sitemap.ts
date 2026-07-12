import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.admeasy.com.br'

// Só as páginas públicas de marketing/aquisição entram aqui — telas
// autenticadas não têm por que aparecer em resultado de busca.
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date()
  return [
    { url: `${SITE_URL}/`, lastModified: agora, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/cadastro`, lastModified: agora, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/login`, lastModified: agora, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/portal/login`, lastModified: agora, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
