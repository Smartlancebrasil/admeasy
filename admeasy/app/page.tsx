'use client'

import { Inter } from 'next/font/google'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CreditCard, ArrowLeftRight, ShieldCheck, FileText, BarChart3, X } from 'lucide-react'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' })

// Carrega o embed do Cal.com uma única vez. Qualquer elemento com
// data-cal-link vira automaticamente um gatilho que abre o agendamento
// num popup, sem sair da página. Confirmações/lembretes já são enviados
// pelo próprio Cal.com pro e-mail cadastrado na conta admeasy.
function useCalEmbed() {
  useEffect(() => {
    (function (C: any, A: any, L: any) {
      let p = function (a: any, ar: any) { a.q.push(ar) }
      let d = C.document
      C.Cal = C.Cal || function () {
        let cal = C.Cal
        let ar = arguments
        if (!cal.loaded) {
          cal.ns = {}
          cal.q = cal.q || []
          d.head.appendChild(d.createElement('script')).src = A
          cal.loaded = true
        }
        if (ar[0] === L) {
          const api: any = function () { p(api, arguments) }
          const namespace = ar[1]
          api.q = api.q || []
          if (typeof namespace === 'string') {
            cal.ns[namespace] = cal.ns[namespace] || api
            p(cal.ns[namespace], ar)
            p(cal, ['initNamespace', namespace])
          } else p(cal, ar)
          return
        }
        p(cal, ar)
      }
    })(window, 'https://app.cal.com/embed/embed.js', 'init')
    ;(window as any).Cal('init', { origin: 'https://cal.com' })
    ;(window as any).Cal('ui', {
      styles: { branding: { brandColor: '#1E88FF' } },
      hideEventTypeDetails: false,
      layout: 'month_view',
    })
  }, [])
}

const COLORS = {
  bg: '#07111F',
  bgGradientTop: '#0d1f38',
  surface: '#0d1a2e',
  surfaceAlt: '#0a1524',
  line: 'rgba(59,130,246,0.25)',
  text: '#FFFFFF',
  muted: '#AEBBD0',
  blue: '#1E88FF',
  blueSecondary: '#0B5FD3',
  blueDim: 'rgba(30,136,255,0.14)',
  green: '#22C55E',
  orange: '#F59E0B',
  red: '#EF4444',
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: COLORS.blue, background: COLORS.blueDim, border: `1px solid ${COLORS.line}` }} className="inline-block text-[11px] font-medium uppercase tracking-wide px-3 py-1 rounded-full mb-5">
      {children}
    </div>
  )
}

function DashboardMockup() {
  const linhaPontos = [28, 40, 34, 52, 45, 60, 54, 68, 62, 78, 72, 88]
  const w = 240
  const h = 72
  const linhaPath = linhaPontos.map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (linhaPontos.length - 1)) * w} ${h - (v / 100) * (h - 10)}`).join(' ')

  const kpis = [
    { label: 'Receita prevista', value: 'R$ 184.500', color: COLORS.blue },
    { label: 'Recebido no mês', value: 'R$ 143.200', color: COLORS.green },
    { label: 'Em aberto', value: 'R$ 41.300', color: COLORS.orange },
    { label: 'Inadimplência', value: '6,8%', color: COLORS.red },
    { label: 'Repasses pendentes', value: 'R$ 92.700', color: COLORS.orange },
    { label: 'Ocupação da carteira', value: '87%', color: COLORS.green },
  ]

  const cobrancas = [
    { nome: 'João da Silva', imovel: 'Apto Santana', valor: 'R$ 2.500', status: 'Pago', cor: COLORS.green },
    { nome: 'Maria Oliveira', imovel: 'Casa Mandaqui', valor: 'R$ 2.200', status: 'A vencer', cor: COLORS.orange },
    { nome: 'Carlos Santos', imovel: 'Apto Tucuruvi', valor: 'R$ 1.800', status: 'Atrasado', cor: COLORS.red },
  ]

  const alertas = [
    { texto: '12 boletos em atraso', cor: COLORS.red },
    { texto: '8 contratos vencem em 30 dias', cor: COLORS.orange },
    { texto: '5 reajustes para aplicar', cor: COLORS.blue },
  ]

  return (
    <div className="relative w-full max-w-2xl" style={{ perspective: '1600px' }}>
      <div
        aria-hidden
        style={{ background: `radial-gradient(circle, ${COLORS.blue}45 0%, transparent 68%)` }}
        className="absolute -inset-16 blur-3xl -z-10"
      />
      <div
        aria-hidden
        style={{ background: `radial-gradient(circle, ${COLORS.blueSecondary}30 0%, transparent 60%)` }}
        className="absolute -inset-6 blur-2xl -z-10"
      />

      <div
        style={{
          background: `linear-gradient(155deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
          border: `1px solid ${COLORS.line}`,
          transform: 'rotateY(-7deg) rotateX(3deg)',
          transformStyle: 'preserve-3d',
          boxShadow: `0 60px 120px -25px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03) inset`,
        }}
        className="rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={{ color: COLORS.text }} className="text-base font-semibold">Visão Executiva da Carteira</div>
            <div style={{ color: COLORS.muted }} className="text-[11px] mt-0.5">Julho/2026 · Todos os imóveis</div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] flex-shrink-0" style={{ color: COLORS.green }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.green }} />
            Atualizado agora
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-3.5">
          {kpis.map((k, i) => (
            <div
              key={i}
              style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}`, borderTop: `2px solid ${k.color}` }}
              className="rounded-lg p-3"
            >
              <div style={{ color: COLORS.muted }} className="text-[9px] mb-1 leading-tight">{k.label}</div>
              <div style={{ color: k.color }} className="text-[14px] font-bold leading-tight">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-2.5 mb-3.5">
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-4">
            <div style={{ color: COLORS.muted }} className="text-[10px] mb-2">Evolução de recebimentos</div>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
              <defs>
                <linearGradient id="areaFillHero" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.blue} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={COLORS.blue} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${linhaPath} L ${w} ${h} L 0 ${h} Z`} fill="url(#areaFillHero)" />
              <path d={linhaPath} fill="none" stroke={COLORS.blue} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-4 flex flex-col items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-16 h-16 mb-1.5">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={COLORS.line} strokeWidth="4" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={COLORS.blue} strokeWidth="4" strokeDasharray="87 100" strokeDashoffset="25" strokeLinecap="round" />
            </svg>
            <div style={{ color: COLORS.text }} className="text-[12px] font-bold">87% ocupação</div>
          </div>
        </div>

        <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-4">
            <div style={{ color: COLORS.muted }} className="text-[10px] mb-2.5">Cobranças críticas</div>
            <div className="flex flex-col gap-2">
              {cobrancas.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div style={{ color: COLORS.text }} className="text-[11px] truncate">{c.nome}</div>
                    <div style={{ color: COLORS.muted }} className="text-[9px] truncate">{c.imovel}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div style={{ color: COLORS.text }} className="text-[11px] font-medium">{c.valor}</div>
                    <div style={{ color: c.cor }} className="text-[9px] font-semibold">{c.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-4">
            <div style={{ color: COLORS.muted }} className="text-[10px] mb-2.5">Alertas</div>
            <div className="flex flex-col gap-2">
              {alertas.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.cor }} />
                  <span style={{ color: COLORS.text }} className="text-[10px] leading-tight">{a.texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LedgerRow({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="grid grid-cols-1 md:grid-cols-[140px_1fr_1.4fr] gap-3 md:gap-8 py-7">
      <div style={{ color: COLORS.blue }} className="text-[11px] font-semibold uppercase tracking-wider pt-1">{eyebrow}</div>
      <h3 style={{ color: COLORS.text }} className="text-xl md:text-2xl font-semibold">{title}</h3>
      <p style={{ color: COLORS.muted }} className="text-sm leading-relaxed">{description}</p>
    </div>
  )
}

const artigos = [
  {
    tag: 'Para locadores',
    titulo: 'Como reduzir a inadimplência sem perder bons inquilinos',
    resumo: 'Três práticas de cobrança que preservam a relação e ainda assim protegem o caixa da sua carteira.',
  },
  {
    tag: 'Gestão',
    titulo: 'Reajuste de aluguel: IGP-M, IPCA ou IVAR — qual escolher',
    resumo: 'As diferenças entre os principais índices e como decidir junto com o proprietário na hora de fechar o contrato.',
  },
  {
    tag: 'Para inquilinos',
    titulo: 'Boleto, Pix ou cartão: como funciona o pagamento do aluguel',
    resumo: 'Um guia rápido para o locatário entender os prazos, multas e formas de pagamento aceitas pela imobiliária.',
  },
]

export default function PaginaInicial() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [barraVisivel, setBarraVisivel] = useState(true)
  useCalEmbed()

  return (
    <div
      style={{
        background: `radial-gradient(ellipse 900px 500px at 75% 5%, ${COLORS.blue}22 0%, transparent 60%), linear-gradient(180deg, #0a1526 0%, #050b16 480px, ${COLORS.bg} 100%)`,
        color: COLORS.text,
      }}
      className={`${inter.variable} min-h-screen font-sans`}
    >
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${COLORS.line}`, background: `${COLORS.bg}cc` }} className="sticky top-0 z-50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/admeasy-logo.png" alt="AdmEasy" width={28} height={28} className="rounded-sm" />
            <span className="text-base font-bold tracking-wide">
              Adm<span style={{ color: COLORS.blue }}>easy</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: COLORS.muted }}>
            <a href="#modulos" className="hover:opacity-80 transition-opacity">Como funciona</a>
            <a href="#recursos" className="hover:opacity-80 transition-opacity">Recursos</a>
            <a href="/cadastro" className="hover:opacity-80 transition-opacity">Planos</a>
            <a href="#imobiliarias" className="hover:opacity-80 transition-opacity">Para imobiliárias</a>
            <a href="#blog" className="hover:opacity-80 transition-opacity">Blog</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/portal" style={{ color: COLORS.text, border: `1px solid ${COLORS.line}` }} className="text-sm font-medium px-4 py-2 rounded-md hover:border-[#1A7FFF] transition-colors">
              Área do inquilino
            </Link>
            <Link href="/login" style={{ background: COLORS.blue, color: '#fff' }} className="text-sm font-semibold px-4 py-2 rounded-md hover:opacity-90 transition-opacity">
              Entrar
            </Link>
          </div>

          <button onClick={() => setMenuAberto(!menuAberto)} className="md:hidden" style={{ color: COLORS.text }} aria-label="Abrir menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {menuAberto && (
          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="md:hidden px-5 py-4 flex flex-col gap-4 text-sm">
            <a href="#modulos" style={{ color: COLORS.muted }} onClick={() => setMenuAberto(false)}>Como funciona</a>
            <a href="#recursos" style={{ color: COLORS.muted }} onClick={() => setMenuAberto(false)}>Recursos</a>
            <a href="/cadastro" style={{ color: COLORS.muted }} onClick={() => setMenuAberto(false)}>Planos</a>
            <a href="#imobiliarias" style={{ color: COLORS.muted }} onClick={() => setMenuAberto(false)}>Para imobiliárias</a>
            <a href="#blog" style={{ color: COLORS.muted }} onClick={() => setMenuAberto(false)}>Blog</a>
            <Link href="/portal" style={{ color: COLORS.text, border: `1px solid ${COLORS.line}` }} className="text-center font-medium px-4 py-2.5 rounded-md">Área do inquilino</Link>
            <Link href="/login" style={{ background: COLORS.blue, color: '#fff' }} className="text-center font-semibold px-4 py-2.5 rounded-md">Entrar</Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 pt-8 md:pt-12 pb-10 grid grid-cols-1 md:grid-cols-[0.85fr_1.3fr] gap-12 items-start">
        <div>
          <Eyebrow>Plataforma de gestão para imobiliárias</Eyebrow>
          <h1 className="text-[2.4rem] md:text-[3.1rem] leading-[1.12] font-bold">
            Sua imobiliária no controle. <span style={{ color: COLORS.blue }}>Sempre.</span>
          </h1>
          <p style={{ color: COLORS.muted }} className="mt-6 text-base md:text-lg leading-relaxed max-w-md">
            Gestão completa de aluguéis, contratos, cobranças, repasses e inadimplência em um só lugar. Mais controle, menos trabalho e decisões baseadas em dados reais.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              data-cal-link="admeasy"
              data-cal-config='{"layout":"month_view"}'
              style={{
                background: `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.blueSecondary} 100%)`,
                color: '#fff',
                boxShadow: `0 12px 30px -8px ${COLORS.blue}80`,
              }}
              className="text-sm font-semibold uppercase tracking-wide px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Agendar demonstração
            </button>
            <a
              href="/cadastro"
              style={{ color: COLORS.blue, background: `${COLORS.bg}80`, border: `1px solid ${COLORS.blue}` }}
              className="text-sm font-semibold uppercase tracking-wide px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Assinar agora
            </a>
            <a
              href="#modulos"
              style={{ color: COLORS.text, background: `${COLORS.bg}80`, border: `1px solid ${COLORS.line}` }}
              className="text-sm font-semibold uppercase tracking-wide px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 hover:border-[#1E88FF]"
            >
              Ver painel de gestão
            </a>
          </div>
          <p style={{ color: COLORS.muted, borderTop: `1px solid ${COLORS.line}` }} className="mt-8 pt-5 text-xs">
            Feito para imobiliárias que administram de 20 a 2.000 imóveis.
          </p>
        </div>
        <div className="flex justify-center md:justify-end" style={{ overflow: 'visible' }}>
          <DashboardMockup />
        </div>
      </section>

      {/* Faixa de benefícios */}
      <section style={{ borderTop: `1px solid ${COLORS.line}`, borderBottom: `1px solid ${COLORS.line}`, background: COLORS.surfaceAlt }}>
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 grid grid-cols-2 md:grid-cols-5 gap-6">
          {[
            { icone: CreditCard, titulo: 'Cobranças automáticas', desc: 'Boletos, Pix e cartão com conciliação automática.' },
            { icone: ArrowLeftRight, titulo: 'Repasses com controle total', desc: 'Repasse automático aos proprietários com transparência.' },
            { icone: ShieldCheck, titulo: 'Inadimplência monitorada', desc: 'Alertas, cobranças e acompanhamento em tempo real.' },
            { icone: FileText, titulo: 'Contratos e reajustes organizados', desc: 'Renovações, reajustes e documentos sempre em dia.' },
            { icone: BarChart3, titulo: 'Relatórios e BI em tempo real', desc: 'Decisões mais rápidas com dados claros e confiáveis.' },
          ].map((b, i) => {
            const Icone = b.icone
            return (
              <div key={i} className="col-span-2 md:col-span-1">
                <div style={{ background: COLORS.blueDim, color: COLORS.blue }} className="w-9 h-9 rounded-md flex items-center justify-center mb-3">
                  <Icone size={17} strokeWidth={2} />
                </div>
                <div style={{ color: COLORS.text }} className="text-sm font-semibold mb-1">{b.titulo}</div>
                <p style={{ color: COLORS.muted }} className="text-xs leading-relaxed">{b.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Módulos / como funciona */}
      <section id="modulos" className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <div id="recursos" />
        <Eyebrow>O que está incluso</Eyebrow>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 max-w-lg">
          Cada módulo resolve uma dor real de quem administra imóveis.
        </h2>

        <div className="mt-8">
          <LedgerRow eyebrow="Contratos" title="Da assinatura ao PDF, sem retrabalho" description="Cadastra o contrato uma vez e o sistema já calcula reajuste, multas, caução e honorários — e gera o PDF pronto pra assinatura." />
          <LedgerRow eyebrow="Financeiro" title="Fluxo de caixa realizado e previsto" description="Saiba não só quanto já entrou, mas o que está previsto pros próximos 30 dias — aluguéis, honorários e despesas fixas, tudo cruzado." />
          <LedgerRow eyebrow="Repasses" title="Proprietário recebe, imobiliária concilia" description="Cada cobrança já nasce com o repasse calculado, taxa de administração descontada e status de pagamento rastreável." />
          <LedgerRow eyebrow="Portal do inquilino" title="Boleto, histórico e manutenção num só link" description="O locatário acessa sozinho: baixa boleto, vê pagamentos anteriores e abre chamado de manutenção com foto." />
        </div>
      </section>

      {/* Para imobiliárias */}
      <section id="imobiliarias" style={{ background: COLORS.surfaceAlt, borderTop: `1px solid ${COLORS.line}`, borderBottom: `1px solid ${COLORS.line}` }} className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-5 md:px-8 grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-12 items-start">
          <div>
            <Eyebrow>Para outras imobiliárias</Eyebrow>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight">
              Testado na prática. Disponível pra sua imobiliária.
            </h2>
            <p style={{ color: COLORS.muted }} className="mt-5 text-sm leading-relaxed max-w-md">
              O mesmo sistema que administra a carteira da nossa imobiliária piloto está disponível como plataforma própria pra você — com sua marca, seus dados, seu domínio.
            </p>
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-7">
            <div style={{ borderBottom: `1px solid ${COLORS.line}` }} className="pb-5 mb-5">
              <div style={{ color: COLORS.muted }} className="text-xs uppercase tracking-wider mb-1">Adesão única</div>
              <div style={{ color: COLORS.blue }} className="text-2xl font-bold">Sob consulta</div>
              <p style={{ color: COLORS.muted }} className="text-xs mt-1">Implantação, migração de dados e configuração da sua marca.</p>
            </div>
            <div>
              <div style={{ color: COLORS.muted }} className="text-xs uppercase tracking-wider mb-1">Mensalidade</div>
              <div style={{ color: COLORS.blue }} className="text-2xl font-bold">Sob consulta</div>
              <p style={{ color: COLORS.muted }} className="text-xs mt-1">Varia pelo tamanho da carteira administrada.</p>
            </div>
            <a href="mailto:contato@admeasy.com.br" style={{ background: COLORS.blue, color: '#fff' }} className="mt-6 block text-center text-sm font-semibold px-5 py-3 rounded-md hover:opacity-90 transition-opacity">
              Falar com a gente
            </a>
          </div>
        </div>
      </section>

      {/* Blog / dicas */}
      <section id="blog" className="max-w-6xl mx-auto px-5 md:px-8 py-16 md:py-20">
        <Eyebrow>No blog</Eyebrow>
        <h2 className="text-2xl md:text-3xl font-bold mb-10 max-w-lg">
          Dicas pra proprietários, inquilinos e quem administra os dois lados.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {artigos.map((a, i) => (
            <article key={i} style={{ border: `1px solid ${COLORS.line}`, background: COLORS.surface }} className="rounded-lg p-6 flex flex-col">
              <div style={{ color: COLORS.blue }} className="text-[11px] font-semibold uppercase tracking-wider mb-3">{a.tag}</div>
              <h3 className="text-lg font-semibold leading-snug mb-3">{a.titulo}</h3>
              <p style={{ color: COLORS.muted }} className="text-sm leading-relaxed flex-1">{a.resumo}</p>
              <span style={{ color: COLORS.blue }} className="text-xs font-semibold mt-5">Ler artigo →</span>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${COLORS.line}` }} className="py-10 pb-24">
        <div className="max-w-6xl mx-auto px-5 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div style={{ color: COLORS.muted }} className="text-xs">
            © {new Date().getFullYear()} AdmEasy — Gestão Inteligente de Locações, por Smartlance Brasil
          </div>
          <div className="flex gap-6 text-xs" style={{ color: COLORS.muted }}>
            <Link href="/login" className="hover:opacity-80">Entrar</Link>
            <Link href="/portal" className="hover:opacity-80">Área do inquilino</Link>
            <a href="mailto:contato@admeasy.com.br" className="hover:opacity-80">Contato</a>
          </div>
        </div>
      </footer>

      {/* Faixa fixa no rodapé */}
      {barraVisivel && (
        <div
          style={{ background: '#0a1526', borderTop: `1px solid ${COLORS.line}` }}
          className="fixed bottom-0 left-0 right-0 z-50 py-3 px-5"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span style={{ color: COLORS.text }} className="text-sm font-semibold truncate">
                Crie agora sua conta no AdmEasy
              </span>
              <span style={{ color: COLORS.muted }} className="text-xs hidden sm:inline truncate">
                Teste grátis por 7 dias, sem compromisso.
              </span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <a
                href="/cadastro"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.blueSecondary} 100%)`,
                  color: '#fff',
                }}
                className="text-xs font-semibold uppercase tracking-wide px-5 py-2.5 rounded-lg whitespace-nowrap"
              >
                Teste agora por 7 dias grátis
              </a>
              <button
                onClick={() => setBarraVisivel(false)}
                aria-label="Fechar"
                style={{ color: COLORS.muted }}
                className="hover:opacity-80"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
