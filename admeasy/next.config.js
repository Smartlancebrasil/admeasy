/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-project.supabase.co'],
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'AdmEasy',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
  async headers() {
    // Reforço em nível de config para o fluxo de recuperação de senha
    // — além dos headers já setados diretamente nas rotas envolvidas
    // (app/api/auth/recuperacao/*, app/confirmar-recuperacao). Garante
    // que nenhum proxy/CDN guarde em cache uma resposta que já carregou
    // o token, e que o navegador nunca envie essa URL como Referer para
    // nenhum destino, mesmo em caminhos futuros que esqueçam de setar
    // os headers manualmente.
    return [
      {
        source: '/confirmar-recuperacao',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/api/auth/recuperacao/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
