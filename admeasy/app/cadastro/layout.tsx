import type { Metadata } from 'next'

// app/cadastro/page.tsx é 'use client' (formulário interativo), então o
// título/descrição específicos da página de planos precisam vir daqui —
// um layout de servidor só para os metadados, sem mudar a página em si.
export const metadata: Metadata = {
  title: 'Planos e preços',
  description:
    'Conheça os planos do Admeasy e assine em poucos minutos: gestão de imóveis, contratos, cobranças e portal do locatário, com 7 dias grátis para testar.',
  alternates: { canonical: '/cadastro' },
}

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children
}
