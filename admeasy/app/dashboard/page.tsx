import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, Building2, FileText, Wrench, TrendingUp } from 'lucide-react'

const metricas = [
  { label: 'Imóveis ativos', valor: '34', sub: '18 aluguel · 16 venda', icon: Building2, cor: 'blue' },
  { label: 'Contratos', valor: '28', sub: '3 vencem em 30 dias', icon: FileText, cor: 'red' },
  { label: 'Demandas abertas', valor: '4', sub: '2 aguardando locador', icon: Wrench, cor: 'yellow' },
  { label: 'Receita do mês', valor: 'R$42k', sub: '+8% vs anterior', icon: TrendingUp, cor: 'green' },
]

const alertas = [
  { tipo: 'danger', msg: 'Contrato #042 vence em 5 dias — Ap. 304 · Maria Costa' },
  { tipo: 'warning', msg: 'Contrato #039 vence em 18 dias — Casa Jd. América' },
  { tipo: 'warning', msg: 'Demanda #08 aguarda autorização do locador há 3 dias' },
  { tipo: 'success', msg: 'Reajuste IGP-M disponível para 4 contratos' },
]

const corMap: Record<string, string> = {
  danger: 'bg-red-50 border-red-200 text-red-700',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  success: 'bg-green-50 border-green-200 text-green-700',
}

export default function DashboardPage() {
  return (
    <AppLayout>
      <Topbar titulo="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {metricas.map((m) => (
            <div key={m.label} className="card">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1.5">
                <m.icon size={13} /> {m.label}
              </div>
              <div className="text-2xl font-semibold text-gray-900">{m.valor}</div>
              <div className="text-xs text-gray-400 mt-1">{m.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Alertas */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={15} className="text-yellow-500" />
              <h2 className="text-sm font-semibold">Alertas críticos</h2>
            </div>
            <div className="space-y-2">
              {alertas.map((a, i) => (
                <div key={i} className={`px-3 py-2.5 rounded-lg border text-xs ${corMap[a.tipo]}`}>
                  {a.msg}
                </div>
              ))}
            </div>
          </div>

          {/* Linha do tempo contratos */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-4">Vencimentos próximos</h2>
            <div className="space-y-3">
              {[
                { num: '#042', imovel: 'Ap. 304 Bloco B', cliente: 'Maria Costa', data: '05/07/2024', dias: 5, cor: 'text-red-600' },
                { num: '#039', imovel: 'Casa Jd. América', cliente: 'Carlos Lima', data: '18/07/2024', dias: 18, cor: 'text-yellow-600' },
                { num: '#031', imovel: 'Sobrado Pinheiros', cliente: 'Pedro Matos', data: '28/07/2024', dias: 28, cor: 'text-yellow-600' },
                { num: '#028', imovel: 'Studio 12A', cliente: 'Ana Beatriz', data: '01/03/2025', dias: 255, cor: 'text-gray-500' },
              ].map((c) => (
                <div key={c.num} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-xs font-medium text-gray-900">{c.num} — {c.imovel}</div>
                    <div className="text-xs text-gray-400">{c.cliente}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold ${c.cor}`}>{c.data}</div>
                    <div className="text-[10px] text-gray-400">{c.dias} dias</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Receita */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-4">Receita do mês</h2>
            {[
              { label: 'Aluguéis recebidos', valor: 28400, pct: 67 },
              { label: 'Comissões (venda)', valor: 11200, pct: 27 },
              { label: 'Taxas administrativas', valor: 2600, pct: 6 },
            ].map((r) => (
              <div key={r.label} className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-medium">{formatCurrency(r.valor)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 flex justify-between">
              <span className="text-sm font-medium text-gray-900">Total</span>
              <span className="text-sm font-semibold text-green-600">{formatCurrency(42200)}</span>
            </div>
          </div>

          {/* Status imóveis */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-4">Imóveis por status</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Alugados', val: 18, badge: 'badge-blue' },
                { label: 'À venda', val: 12, badge: 'badge-purple' },
                { label: 'Disponíveis', val: 4, badge: 'badge-green' },
                { label: 'Em análise', val: 7, badge: 'badge-yellow' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-semibold text-gray-900">{s.val}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
