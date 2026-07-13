'use client'

import { Inter } from 'next/font/google'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Chart from 'chart.js/auto'
import {
  CreditCard, ArrowLeftRight, ShieldCheck, FileText, BarChart3, Settings,
  ArrowUpRight, ArrowDownRight, ArrowRight, Calendar, Building2, Receipt, AlertTriangle,
  Home, Wallet, Lock, Headphones,
} from 'lucide-react'

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
  bg: '#030B18',
  bgGradientTop: '#071426',
  surface: '#09182B',
  surfaceAlt: '#071426',
  line: 'rgba(52,132,255,0.22)',
  text: '#FFFFFF',
  muted: '#A9B7CC',
  blue: '#168BFF',
  blueSecondary: '#006CFF',
  blueDim: 'rgba(22,139,255,0.14)',
  green: '#22C77A',
  yellow: '#F5B942',
  red: '#FF5B68',
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: COLORS.blue, background: COLORS.blueDim, border: `1px solid ${COLORS.line}` }} className="inline-block text-[11px] font-medium uppercase tracking-wide px-3 py-1 rounded-full mb-5">
      {children}
    </div>
  )
}

const KPIS_CARTEIRA = [
  { label: 'Receita prevista', value: 'R$ 184.500', delta: '+8%', bom: true, color: COLORS.blue },
  { label: 'Recebido no mês', value: 'R$ 143.200', delta: '+4%', bom: true, color: COLORS.green },
  { label: 'Em aberto', value: 'R$ 41.300', delta: '-2%', bom: true, color: COLORS.yellow },
  { label: 'Inadimplência', value: '6,8%', delta: '-1,2pp', bom: true, color: COLORS.red },
  { label: 'Repasses pendentes', value: 'R$ 92.700', delta: '+5%', bom: false, color: COLORS.yellow },
  { label: 'Ocupação da carteira', value: '87%', delta: '+3pp', bom: true, color: COLORS.green },
]

const COBRANCAS_CRITICAS = [
  { nome: 'João da Silva', imovel: 'Apto Santana', valor: 'R$ 2.500', status: 'Pago', cor: COLORS.green },
  { nome: 'Maria Oliveira', imovel: 'Casa Mandaqui', valor: 'R$ 2.200', status: 'A vencer', cor: COLORS.yellow },
]

const ALERTAS_CARTEIRA = [
  { texto: '12 boletos em atraso', cor: COLORS.red },
  { texto: '8 contratos vencem em 30 dias', cor: COLORS.yellow },
  { texto: '5 reajustes para aplicar', cor: COLORS.blue },
]

const SIDEBAR_ITENS = [
  { label: 'Visão Geral', icone: Home },
  { label: 'Imóveis', icone: Building2 },
  { label: 'Financeiro', icone: Wallet },
  { label: 'Contratos', icone: FileText },
  { label: 'Cobranças', icone: Receipt },
  { label: 'Repasses', icone: ArrowLeftRight },
  { label: 'Inadimplência', icone: AlertTriangle },
  { label: 'Relatórios', icone: BarChart3 },
  { label: 'Configurações', icone: Settings },
]

/** Pequeno cartão de indicador, reaproveitado no notebook e no celular do mockup. */
function KpiCard({ label, value, delta, bom, color, compact }: { label: string; value: string; delta?: string; bom?: boolean; color: string; compact?: boolean }) {
  return (
    <div
      style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}`, borderTop: `2px solid ${color}` }}
      className={compact ? 'rounded-md p-1.5' : 'rounded-lg p-2'}
    >
      <div style={{ color: COLORS.muted }} className={compact ? 'text-[6px] mb-0.5 leading-tight truncate' : 'text-[7px] mb-1 leading-tight truncate'}>{label}</div>
      <div style={{ color: COLORS.text }} className={compact ? 'text-[9px] font-bold leading-tight truncate' : 'text-[12px] font-bold leading-tight truncate'}>{value}</div>
      {delta && (
        <div className="flex items-center gap-0.5 mt-0.5" style={{ color: bom ? COLORS.green : COLORS.muted }}>
          {delta.startsWith('-') ? <ArrowDownRight size={7} strokeWidth={2.5} /> : <ArrowUpRight size={7} strokeWidth={2.5} />}
          <span className="text-[7px] font-semibold truncate">{delta}</span>
        </div>
      )}
    </div>
  )
}

/** Mockup de laptop + celular com a "Visão Executiva da Carteira", construído em
 * HTML/CSS/SVG e Chart.js (mesma biblioteca já usada em app/(interno)/dashboard) —
 * não é uma imagem estática, é a UI real do produto renderizada em miniatura. */
function DeviceMockup() {
  const lineCanvasRef = useRef<HTMLCanvasElement>(null)
  const doughnutCanvasRef = useRef<HTMLCanvasElement>(null)
  const phoneLineCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const charts: Chart[] = []
    if (lineCanvasRef.current) {
      charts.push(new Chart(lineCanvasRef.current, {
        type: 'line',
        data: {
          labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
          datasets: [{
            data: [98, 112, 104, 128, 119, 136, 143],
            borderColor: COLORS.blue,
            backgroundColor: `${COLORS.blue}1a`,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 0,
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: COLORS.muted, font: { size: 8 } } },
            y: { display: false },
          },
        },
      }))
    }
    if (doughnutCanvasRef.current) {
      charts.push(new Chart(doughnutCanvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Ocupados', 'Disponíveis'],
          datasets: [{
            data: [87, 13],
            backgroundColor: [COLORS.blue, COLORS.blueDim],
            borderColor: COLORS.surface,
            borderWidth: 3,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: false } } },
      }))
    }
    if (phoneLineCanvasRef.current) {
      charts.push(new Chart(phoneLineCanvasRef.current, {
        type: 'line',
        data: {
          labels: ['Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul'],
          datasets: [{
            data: [104, 119, 112, 128, 136, 143],
            borderColor: COLORS.blue,
            backgroundColor: `${COLORS.blue}1a`,
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 0,
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          layout: { padding: 0 },
        },
      }))
    }
    return () => charts.forEach(c => c.destroy())
  }, [])

  const screenContent = (
    <div className="flex h-full">
      {/* Menu lateral com os módulos reais do produto */}
      <div style={{ background: `${COLORS.bg}c0`, borderRight: `1px solid ${COLORS.line}` }} className="hidden sm:flex flex-col w-[86px] flex-shrink-0 py-3 px-2">
        <div className="flex items-center gap-1 px-1 mb-3">
          <div style={{ background: COLORS.blue }} className="w-3.5 h-3.5 rounded-[3px] flex-shrink-0" />
          <span style={{ color: COLORS.text }} className="text-[8px] font-semibold">Admeasy</span>
        </div>
        <div className="flex flex-col gap-0.5">
          {SIDEBAR_ITENS.map((item, i) => (
            <div
              key={item.label}
              style={i === 0 ? { background: COLORS.blueDim, color: COLORS.blue } : { color: COLORS.muted }}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1"
            >
              <item.icone size={9} strokeWidth={2} className="flex-shrink-0" />
              <span className="text-[6.5px] font-medium truncate">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3.5 md:p-4 flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-2.5 gap-3">
          <div className="min-w-0">
            <div style={{ color: COLORS.text }} className="text-[12px] font-semibold truncate">Visão Executiva da Carteira</div>
            <div style={{ color: COLORS.muted }} className="text-[9px] mt-0.5">Todos os imóveis</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span style={{ color: COLORS.muted, border: `1px solid ${COLORS.line}` }} className="hidden md:inline text-[7.5px] px-1.5 py-0.5 rounded-md whitespace-nowrap">Período: Mês atual</span>
            <span className="flex items-center gap-1.5 text-[9px]" style={{ color: COLORS.green }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: COLORS.green }} />
              Atualizado agora
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2.5">
          {KPIS_CARTEIRA.map(k => <KpiCard key={k.label} {...k} />)}
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-2 mb-2.5 h-28 flex-shrink-0">
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-3 flex flex-col overflow-hidden">
            <div style={{ color: COLORS.muted }} className="text-[9px] mb-1 flex-shrink-0">Evolução de recebimentos</div>
            <div className="relative flex-1 min-h-0">
              <canvas ref={lineCanvasRef} className="absolute inset-0 w-full h-full" />
            </div>
          </div>
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-3 flex flex-col items-center justify-center overflow-hidden">
            <div className="relative w-14 h-14 mb-1 flex-shrink-0">
              <canvas ref={doughnutCanvasRef} className="absolute inset-0 w-full h-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ color: COLORS.text }} className="text-[11px] font-bold">87%</span>
              </div>
            </div>
            <div style={{ color: COLORS.muted }} className="text-[8px] mt-0.5 text-center">ocupação da carteira</div>
          </div>
        </div>

        <div className="grid grid-cols-[1.3fr_1fr] gap-2">
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-2.5">
            <div style={{ color: COLORS.muted }} className="text-[8px] mb-1.5">Cobranças críticas</div>
            <div className="flex flex-col gap-1.5">
              {COBRANCAS_CRITICAS.map(c => (
                <div key={c.nome} className="flex items-center gap-1.5">
                  <div
                    style={{ background: COLORS.blueDim, color: COLORS.blue }}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                  >
                    {c.nome.split(' ').map(p => p[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div style={{ color: COLORS.text }} className="text-[10px] truncate">{c.nome}</div>
                    <div style={{ color: COLORS.muted }} className="text-[8px] truncate">{c.imovel}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div style={{ color: COLORS.text }} className="text-[10px] font-medium">{c.valor}</div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.cor }} />
                      <span style={{ color: COLORS.muted }} className="text-[8px] font-medium">{c.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-lg p-2.5">
            <div style={{ color: COLORS.muted }} className="text-[8px] mb-1.5">Alertas</div>
            <div className="flex flex-col gap-1">
              {ALERTAS_CARTEIRA.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.cor }} />
                  <span style={{ color: COLORS.text }} className="text-[9px] leading-tight">{a.texto}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="relative w-full max-w-5xl pb-12 pr-9 sm:pr-14">
      <div
        aria-hidden
        style={{ background: `radial-gradient(circle, ${COLORS.blue}30 0%, transparent 68%)` }}
        className="absolute -inset-12 blur-3xl -z-10"
      />

      {/* Laptop — uma única moldura contínua (tela + base), sem peças soltas */}
      <div
        style={{ background: '#050b16', border: `1px solid ${COLORS.line}`, boxShadow: `0 50px 100px -25px rgba(0,0,0,0.75)` }}
        className="rounded-2xl p-2 pb-3"
      >
        <div className="flex justify-center mb-1.5">
          <div style={{ background: COLORS.line }} className="w-1 h-1 rounded-full" />
        </div>
        <div
          style={{ background: `linear-gradient(155deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`, border: `1px solid ${COLORS.line}` }}
          className="rounded-lg overflow-hidden aspect-[16/9]"
        >
          {screenContent}
        </div>
        <div className="flex justify-center mt-2.5">
          <div style={{ background: COLORS.line }} className="w-10 h-0.5 rounded-full opacity-60" />
        </div>
      </div>

      {/* Celular, sobreposto no canto — bem mais alto que largo, como um smartphone de verdade */}
      <div className="absolute bottom-4 right-0 w-32 sm:w-36">
        <div style={{ background: '#050b16', border: `1px solid ${COLORS.line}`, boxShadow: `0 30px 70px -20px rgba(0,0,0,0.85)` }} className="rounded-2xl p-2">
          <div
            style={{ background: `linear-gradient(165deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`, border: `1px solid ${COLORS.line}` }}
            className="rounded-xl overflow-hidden aspect-[9/19] p-3.5 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3.5 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <div style={{ background: COLORS.blue }} className="w-4 h-4 rounded-[4px] flex-shrink-0" />
                <span style={{ color: COLORS.text }} className="text-[10px] font-semibold">Admeasy</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: COLORS.green }} />
            </div>

            <div className="mb-3 flex-shrink-0">
              <div style={{ color: COLORS.muted }} className="text-[8px] mb-1">Recebido no mês</div>
              <div style={{ color: COLORS.text }} className="text-[16px] font-bold leading-none whitespace-nowrap">R$ 143.200</div>
              <div className="flex items-center gap-0.5 mt-1.5" style={{ color: COLORS.green }}>
                <ArrowUpRight size={10} strokeWidth={2.5} />
                <span className="text-[9px] font-semibold">+4% vs mês anterior</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3 flex-shrink-0">
              <KpiCard label="Imóveis ativos" value="128" color={COLORS.blue} compact />
              <KpiCard label="Ocupação" value="87%" color={COLORS.green} compact />
              <KpiCard label="Inadimplência" value="6,8%" color={COLORS.red} compact />
              <KpiCard label="Repasses" value="R$ 92,7K" color={COLORS.yellow} compact />
            </div>

            <div style={{ background: `${COLORS.bg}90`, border: `1px solid ${COLORS.line}` }} className="rounded-md p-2.5 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                <span style={{ color: COLORS.muted }} className="text-[8px]">Últimos 6 meses</span>
                <span style={{ color: COLORS.blue }} className="text-[8px] font-semibold">R$ 143K</span>
              </div>
              <div className="relative flex-1 min-h-0">
                <canvas ref={phoneLineCanvasRef} className="absolute inset-0 w-full h-full" />
              </div>
              <div className="flex items-center justify-between mt-1 flex-shrink-0">
                {['F', 'M', 'A', 'M', 'J', 'J'].map((m, i) => (
                  <span key={i} style={{ color: COLORS.muted }} className="text-[6.5px]">{m}</span>
                ))}
              </div>
            </div>

            {/* Navegação inferior */}
            <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="flex items-center justify-between pt-2.5 mt-3 flex-shrink-0">
              {[Home, Receipt, ArrowLeftRight, Settings].map((Icone, i) => (
                <Icone key={i} size={12} strokeWidth={2} style={{ color: i === 0 ? COLORS.blue : COLORS.muted }} />
              ))}
            </div>
          </div>
          <div className="flex justify-center mt-2 mb-0.5">
            <div style={{ background: COLORS.muted }} className="w-9 h-0.5 rounded-full opacity-40" />
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
  useCalEmbed()

  return (
    <div
      style={{
        background: `radial-gradient(ellipse 900px 500px at 75% 5%, ${COLORS.blue}18 0%, transparent 60%), linear-gradient(180deg, ${COLORS.bgGradientTop} 0%, ${COLORS.surface} 480px, ${COLORS.bg} 100%)`,
        color: COLORS.text,
      }}
      className={`${inter.variable} min-h-screen font-sans overflow-x-hidden`}
    >
      {/* Header */}
      <header style={{ borderBottom: `1px solid ${COLORS.line}`, background: `${COLORS.bg}cc` }} className="sticky top-0 z-50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center -ml-28">
            <Image src="/admeasy-logo.png" alt="AdmEasy" width={320} height={80} priority />
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: COLORS.muted }}>
            <a href="#modulos" className="hover:opacity-80 transition-opacity">Como funciona</a>
            <a href="#recursos" className="hover:opacity-80 transition-opacity">Recursos</a>
            <a href="/cadastro" className="hover:opacity-80 transition-opacity">Planos</a>
            <a href="#imobiliarias" className="hover:opacity-80 transition-opacity">Para imobiliárias</a>
            <a href="#blog" className="hover:opacity-80 transition-opacity">Blog</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
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
            <Link href="/login" style={{ background: COLORS.blue, color: '#fff' }} className="text-center font-semibold px-4 py-2.5 rounded-md">Entrar</Link>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="max-w-[1360px] mx-auto px-5 md:px-8 pt-8 md:pt-12 pb-10 grid grid-cols-1 md:grid-cols-[0.72fr_1.4fr] gap-12 items-start">
        <div>
          <div style={{ color: COLORS.blue, background: COLORS.blueDim, border: `1px solid ${COLORS.line}` }} className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide px-3 py-1 rounded-full mb-5">
            <span style={{ background: COLORS.blue }} className="w-1.5 h-1.5 rounded-full flex-shrink-0" />
            Plataforma de gestão para imobiliárias
          </div>
          <h1 className="text-[2.4rem] md:text-[3.1rem] leading-[1.12] font-bold">
            Sua imobiliária
            <br />
            no controle.
            <br />
            <span style={{ color: COLORS.blue }}>Sempre.</span>
          </h1>
          <p style={{ color: COLORS.muted }} className="mt-6 text-base md:text-lg leading-relaxed max-w-md">
            Gestão completa de aluguéis, contratos, cobranças, repasses e inadimplência em um só lugar. Menos trabalho, mais previsibilidade e decisões baseadas em dados reais.
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
              className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030B18]"
            >
              <Calendar size={15} strokeWidth={2} />
              Agendar demonstração
              <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="/cadastro"
              style={{ color: COLORS.blue, background: `${COLORS.bg}80`, border: `1px solid ${COLORS.blue}` }}
              className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide px-6 py-3.5 rounded-lg transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030B18]"
            >
              Assinar agora
              <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
          <div style={{ borderTop: `1px solid ${COLORS.line}` }} className="mt-8 pt-5 flex items-center gap-3">
            <div className="flex items-center -space-x-2 flex-shrink-0">
              {['JS', 'MO', 'CS', 'AP'].map((iniciais, i) => (
                <div
                  key={i}
                  style={{ background: COLORS.surface, border: `2px solid ${COLORS.bg}`, color: COLORS.muted }}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold"
                >
                  {iniciais}
                </div>
              ))}
              <div
                style={{ background: COLORS.blueDim, border: `2px solid ${COLORS.bg}`, color: COLORS.blue }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold"
              >
                2k+
              </div>
            </div>
            <p style={{ color: COLORS.muted }} className="text-xs">
              Feito para imobiliárias que administram de 20 a 2.000 imóveis.
            </p>
          </div>
        </div>
        <div className="flex justify-center md:justify-end" style={{ overflow: 'visible' }}>
          <DeviceMockup />
        </div>
      </section>

      {/* Faixa de segurança + CTA — fixa no rodapé, fina, ocupando a largura toda */}
      <div
        style={{ background: `${COLORS.bg}f5`, borderTop: `1px solid ${COLORS.line}`, backdropFilter: 'blur(8px)' }}
        className="fixed bottom-0 left-0 right-0 z-50 px-5 md:px-8 py-2.5"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-5 min-w-0">
            {[
              { icone: Lock, texto: 'Dados protegidos' },
              { icone: ShieldCheck, texto: 'Ambiente 100% seguro' },
              { icone: Headphones, texto: 'Suporte humano' },
            ].map(({ icone: Icone, texto }) => (
              <div key={texto} className="flex items-center gap-1.5 flex-shrink-0">
                <Icone size={13} strokeWidth={2} style={{ color: COLORS.blue }} />
                <span style={{ color: COLORS.muted }} className="text-xs font-medium whitespace-nowrap">{texto}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span style={{ color: COLORS.text }} className="text-sm font-semibold truncate">
              Crie agora sua conta no Admeasy
            </span>
            <span style={{ color: COLORS.muted }} className="text-xs hidden sm:inline truncate">
              Teste grátis por 7 dias, sem compromisso.
            </span>
          </div>
          <a
            href="/cadastro"
            style={{ background: `linear-gradient(135deg, ${COLORS.blue} 0%, ${COLORS.blueSecondary} 100%)`, color: '#fff' }}
            className="group inline-flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide px-5 py-2.5 rounded-lg whitespace-nowrap transition-all hover:-translate-y-0.5 hover:shadow-xl flex-shrink-0"
          >
            Teste agora por 7 dias grátis
            <ArrowRight size={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>

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
      <footer style={{ borderTop: `1px solid ${COLORS.line}` }} className="pt-10 pb-20">
        <div className="max-w-6xl mx-auto px-5 md:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div style={{ color: COLORS.muted }} className="text-xs">
            © {new Date().getFullYear()} AdmEasy — Gestão Inteligente de Locações, por Smartlance Brasil
          </div>
          <div className="flex gap-6 text-xs" style={{ color: COLORS.muted }}>
            <Link href="/login" className="hover:opacity-80">Entrar</Link>
            <a href="mailto:contato@admeasy.com.br" className="hover:opacity-80">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
