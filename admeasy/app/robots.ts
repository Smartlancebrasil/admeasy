import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.admeasy.com.br'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/cadastro', '/login', '/portal/login'],
        // Áreas autenticadas/internas não devem ser indexadas — não têm
        // valor de busca e não são acessíveis sem login de qualquer forma.
        disallow: ['/dashboard', '/admin', '/portal', '/api', '/clientes', '/contratos', '/imoveis', '/financeiro', '/demandas', '/fornecedores', '/reajuste', '/rescisao', '/vistorias', '/configuracoes', '/logs', '/analise-cadastral', '/cadastro/sucesso'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
