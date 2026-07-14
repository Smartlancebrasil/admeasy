'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import { Target, TrendingUp, Building2, Save } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

type Meta = {
  id: string
  ano: number
  meta_receita_mensal: number
}

type ContratoAtivo = {
  id: string
  valor_atual?: number
  valor_mensal?: number
  taxa_administracao?: number
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
}

const anoAtual = new Date().getFullYear()
const anosDisponiveis = Array.from({ length: 5 }, (_, i) => anoAtual - 1 + i)

export default function MetaPage() {
  const { organizacao } = useOrganization()
  const [ano, setAno] = useState(anoAtual)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [contratosAtivos, setContratosAtivos] = useState<ContratoAtivo[]>([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [valorMeta, setValorMeta] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    if (organizacao?.id) buscarTudo(organizacao.id, ano)
  }, [organizacao?.id, ano])

  async function buscarTudo(orgId: string, anoSel: number) {
    setLoading(true)
    const [metaRes, contratosRes] = await Promise.all([
      supabase.from('metas').select('id, ano, meta_receita_mensal').eq('organization_id', orgId).eq('ano', anoSel).maybeSingle(),
      supabase.from('contratos').select('id, valor_atual, valor_mensal, taxa_administracao').eq('organization_id', orgId).eq('status', 'ativo'),
    ])
    setMeta(metaRes.data || null)
    setValorMeta(metaRes.data?.meta_receita_mensal?.toString() || '')
    if (contratosRes.data) setContratosAtivos(contratosRes.data)
    setEditando(false)
    setLoading(false)
  }

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault()
    if (!organizacao?.id) return
    setSalvando(true)
    const valor = parseFloat(valorMeta) || 0

    if (meta) {
      const { error } = await supabase.from('metas').update({ meta_receita_mensal: valor }).eq('id', meta.id).eq('organization_id', organizacao.id)
      if (!error) await registrarLog({ acao: 'editar', modulo: 'meta', registro_id: meta.id, registro_nome: `Meta ${ano}`, descricao: `Atualizou a meta de ${ano} para ${formatVal(valor)}/mês` })
    } else {
      const { data, error } = await supabase.from('metas').insert([{ organization_id: organizacao.id, ano, meta_receita_mensal: valor }]).select('id').single()
      if (!error) await registrarLog({ acao: 'criar', modulo: 'meta', registro_id: data?.id, registro_nome: `Meta ${ano}`, descricao: `Definiu a meta de ${ano}: ${formatVal(valor)}/mês` })
    }

    setSucesso('Meta salva!')
    setTimeout(() => setSucesso(''), 3000)
    setSalvando(false)
    buscarTudo(organizacao.id, ano)
  }

  // Receita de administração atual: só a comissão sobre o aluguel dos
  // contratos ativos — a meta do usuário é especificamente sobre "renda
  // recorrente de administrações", não inclui honorários nem seguros.
  const receitaAdmAtual = contratosAtivos.reduce((acc, c) => {
    const valorAluguel = c.valor_atual || c.valor_mensal || 0
    const taxaPct = c.taxa_administracao || 10
    return acc + (valorAluguel * taxaPct / 100)
  }, 0)

  const ticketMedioComissao = contratosAtivos.length > 0 ? receitaAdmAtual / contratosAtivos.length : 0
  const metaMensal = meta?.meta_receita_mensal || 0
  const contratosNecessarios = ticketMedioComissao > 0 ? Math.ceil(metaMensal / ticketMedioComissao) : 0
  const contratosFaltando = Math.max(0, contratosNecessarios - contratosAtivos.length)
  const progressoPct = metaMensal > 0 ? Math.min((receitaAdmAtual / metaMensal) * 100, 100) : 0

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1200px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Meta da imobiliária</h1>
              <p style={{ color: '#8b8d98' }} className="text-[12px] mt-0.5">Projete o crescimento e acompanhe quantos contratos faltam pra bater a meta do ano</p>
            </div>
            <select
              value={ano}
              onChange={e => setAno(parseInt(e.target.value))}
              style={{ background: '#161b22', border: '0.5px solid #2a2f3a', color: '#c3c2b7' }}
              className="rounded-lg px-3 py-2 text-sm"
            >
              {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

          {loading ? (
            <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
          ) : (
            <>
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p style={{ color: '#8b8d98' }} className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5"><Target size={13} />Meta de {ano} — renda mensal recorrente de administrações</p>
                  {!editando && (
                    <button className="btn btn-sm" onClick={() => setEditando(true)}>{meta ? 'Editar meta' : 'Definir meta'}</button>
                  )}
                </div>

                {editando ? (
                  <form onSubmit={salvarMeta} className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="label">Meta de receita mensal (R$)</label>
                      <input className="input" type="number" step="0.01" required value={valorMeta} onChange={e => setValorMeta(e.target.value)} placeholder="Ex: 40000" />
                    </div>
                    <button type="submit" disabled={salvando} className="btn btn-primary">
                      <Save size={13} />{salvando ? 'Salvando...' : 'Salvar meta'}
                    </button>
                    <button type="button" className="btn" onClick={() => { setEditando(false); setValorMeta(meta?.meta_receita_mensal?.toString() || '') }}>Cancelar</button>
                  </form>
                ) : (
                  <div>
                    <div style={{ color: '#f4f4f3' }} className="text-2xl font-semibold">{meta ? formatVal(metaMensal) : '—'}</div>
                    {!meta && <p style={{ color: '#8b8d98' }} className="text-xs mt-1">Nenhuma meta definida pra {ano} ainda.</p>}
                  </div>
                )}
              </div>

              {meta && (
                <>
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ color: '#8b8d98' }} className="text-xs">Progresso da meta mensal</span>
                      <span style={{ color: progressoPct >= 100 ? '#3fb950' : '#c3c2b7' }} className="text-xs font-medium">{progressoPct.toFixed(1)}%</span>
                    </div>
                    <div style={{ background: '#161b22', height: 10, borderRadius: 6 }}>
                      <div style={{ background: progressoPct >= 100 ? '#3fb950' : '#1A7FFF', width: `${progressoPct}%`, height: 10, borderRadius: 6 }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="card">
                      <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} />Receita de administração atual</div>
                      <div style={{ color: '#3fb950' }} className="text-xl font-semibold">{formatVal(receitaAdmAtual)}</div>
                      <div style={{ color: '#8b8d98' }} className="text-xs mt-1">por mês, recorrente</div>
                    </div>
                    <div className="card">
                      <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><Building2 size={12} />Contratos ativos</div>
                      <div style={{ color: '#f4f4f3' }} className="text-xl font-semibold">{contratosAtivos.length}</div>
                      <div style={{ color: '#8b8d98' }} className="text-xs mt-1">Ticket médio: {formatVal(ticketMedioComissao)}</div>
                    </div>
                    <div className="card">
                      <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><Target size={12} />Contratos p/ bater a meta</div>
                      <div style={{ color: '#f4f4f3' }} className="text-xl font-semibold">{contratosNecessarios || '—'}</div>
                      <div style={{ color: '#8b8d98' }} className="text-xs mt-1">no total, pra atingir a meta</div>
                    </div>
                    <div className="card">
                      <div style={{ color: '#8b8d98' }} className="text-xs mb-1 flex items-center gap-1"><Building2 size={12} />Faltam fechar</div>
                      <div style={{ color: contratosFaltando > 0 ? '#f59e0b' : '#3fb950' }} className="text-xl font-semibold">{contratosFaltando}</div>
                      <div style={{ color: '#8b8d98' }} className="text-xs mt-1">{contratosFaltando > 0 ? 'contratos novos' : 'meta batida!'}</div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
