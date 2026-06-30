'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Plus, X, Edit2, Scale, Gavel } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

type Processo = {
  id: string; numero_processo?: string; tipo: string; status: string
  vara?: string; comarca?: string; advogado_responsavel?: string
  valor_causa?: number; data_distribuicao?: string; observacoes?: string
  contrato_id?: string; cliente_id?: string
  contrato?: any; cliente?: any
}

const tipoLabel: Record<string, string> = { despejo: 'Despejo', cobranca: 'Cobrança', execucao: 'Execução', consignacao: 'Consignação', outro: 'Outro' }
const statusConfig: Record<string, { label: string; badge: string }> = {
  em_andamento: { label: 'Em andamento', badge: 'badge-blue' },
  suspenso: { label: 'Suspenso', badge: 'badge-yellow' },
  concluido: { label: 'Concluído', badge: 'badge-green' },
  arquivado: { label: 'Arquivado', badge: 'badge-gray' },
}

function formatVal(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0) }
function getNome(v: any) { if (!v) return '—'; if (Array.isArray(v)) return v[0]?.nome || v[0]?.titulo || '—'; return v.nome || v.titulo || '—' }

const formVazio = {
  id: '', numero_processo: '', tipo: 'cobranca', status: 'em_andamento',
  vara: '', comarca: '', advogado_responsavel: '', valor_causa: '',
  data_distribuicao: '', observacoes: '', contrato_id: '', cliente_id: '',
}

export default function ProcessosJudiciaisPage() {
  const [processos, setProcessos] = useState<Processo[]>([])
  const [contratos, setContratos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string, string> | null>(null)
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [pr, co, cl] = await Promise.all([
      supabase.from('processos_judiciais').select('*, contrato:contratos(numero), cliente:clientes(nome)').eq('organization_id', ORG_ID).order('created_at', { ascending: false }),
      supabase.from('contratos').select('id, numero').eq('organization_id', ORG_ID).order('numero'),
      supabase.from('clientes').select('id, nome').eq('organization_id', ORG_ID).order('nome'),
    ])
    if (pr.data) setProcessos(pr.data)
    if (co.data) setContratos(co.data)
    if (cl.data) setClientes(cl.data)
    setLoading(false)
  }

  function abrirNovo() { setFormInicial({ ...formVazio }) }
  function abrirEdicao(p: Processo) {
    setFormInicial({
      id: p.id, numero_processo: p.numero_processo || '', tipo: p.tipo, status: p.status,
      vara: p.vara || '', comarca: p.comarca || '', advogado_responsavel: p.advogado_responsavel || '',
      valor_causa: p.valor_causa?.toString() || '', data_distribuicao: p.data_distribuicao || '',
      observacoes: p.observacoes || '', contrato_id: p.contrato_id || '', cliente_id: p.cliente_id || '',
    })
  }

  async function salvar(dados: Record<string, string>) {
    setSalvando(true)
    const payload = {
      organization_id: ORG_ID,
      numero_processo: dados.numero_processo || null, tipo: dados.tipo, status: dados.status,
      vara: dados.vara || null, comarca: dados.comarca || null, advogado_responsavel: dados.advogado_responsavel || null,
      valor_causa: dados.valor_causa ? parseFloat(dados.valor_causa) : null,
      data_distribuicao: dados.data_distribuicao || null, observacoes: dados.observacoes || null,
      contrato_id: dados.contrato_id || null, cliente_id: dados.cliente_id || null,
    }
    let error
    if (dados.id) {
      const res = await supabase.from('processos_judiciais').update(payload).eq('id', dados.id)
      error = res.error
    } else {
      const res = await supabase.from('processos_judiciais').insert([payload])
      error = res.error
    }
    setSalvando(false)
    if (error) { alert('Erro: ' + error.message); return }

    await registrarLog({
      acao: dados.id ? 'editou' : 'criou', modulo: 'processo_judicial',
      registro_nome: dados.numero_processo || 'Processo sem número',
      descricao: `${dados.id ? 'Editou' : 'Criou'} processo judicial`,
    })

    setFormInicial(null)
    setSucesso(dados.id ? 'Processo atualizado!' : 'Processo criado!')
    setTimeout(() => setSucesso(''), 3000)
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este processo?')) return
    await supabase.from('processos_judiciais').delete().eq('id', id)
    carregar()
  }

  return (
    <AppLayout>
      <Topbar titulo="Processos Judiciais">
        <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} />Novo processo</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

        {formInicial !== null && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">{formInicial.id ? 'Editando processo' : 'Novo processo judicial'}</h2>
              <button onClick={() => setFormInicial(null)}><X size={14} /></button>
            </div>
            <FormProcesso inicial={formInicial} contratos={contratos} clientes={clientes} onSalvar={salvar} salvando={salvando} />
          </div>
        )}

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : processos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Scale size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-medium text-gray-500">Nenhum processo judicial cadastrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Nº Processo', 'Tipo', 'Cliente', 'Contrato', 'Vara/Comarca', 'Valor causa', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {processos.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs font-mono">{p.numero_processo || '—'}</td>
                    <td className="px-4 py-3 text-sm">{tipoLabel[p.tipo] || p.tipo}</td>
                    <td className="px-4 py-3 text-sm">{getNome(p.cliente)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.contrato ? `#${getNome(p.contrato)}` : '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.vara || '—'}{p.comarca ? ` / ${p.comarca}` : ''}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatVal(p.valor_causa || 0)}</td>
                    <td className="px-4 py-3"><span className={`badge ${statusConfig[p.status]?.badge || 'badge-gray'}`}>{statusConfig[p.status]?.label || p.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button className="btn btn-sm" onClick={() => abrirEdicao(p)}><Edit2 size={12} />Editar</button>
                        <button className="btn btn-sm" style={{ color: 'var(--text-danger)' }} onClick={() => excluir(p.id)}><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function FormProcesso({ inicial, contratos, clientes, onSalvar, salvando }: {
  inicial: Record<string, string>; contratos: any[]; clientes: any[]
  onSalvar: (d: Record<string, string>) => Promise<void>; salvando: boolean
}) {
  const [form, setForm] = useState(inicial)
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [c]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSalvar(form) }}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Número do processo</label>
          <input className="input" value={form.numero_processo} onChange={set('numero_processo')} placeholder="0000000-00.0000.0.00.0000" /></div>
        <div><label className="label">Tipo</label>
          <select className="input" value={form.tipo} onChange={set('tipo')}>
            {Object.entries(tipoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label className="label">Cliente</label>
          <select className="input" value={form.cliente_id} onChange={set('cliente_id')}>
            <option value="">Selecionar</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></div>
        <div><label className="label">Contrato relacionado</label>
          <select className="input" value={form.contrato_id} onChange={set('contrato_id')}>
            <option value="">Nenhum</option>
            {contratos.map(c => <option key={c.id} value={c.id}>#{c.numero}</option>)}
          </select></div>
        <div><label className="label">Vara</label>
          <input className="input" value={form.vara} onChange={set('vara')} /></div>
        <div><label className="label">Comarca</label>
          <input className="input" value={form.comarca} onChange={set('comarca')} /></div>
        <div><label className="label">Advogado responsável</label>
          <input className="input" value={form.advogado_responsavel} onChange={set('advogado_responsavel')} /></div>
        <div><label className="label">Valor da causa (R$)</label>
          <input className="input" type="number" step="0.01" value={form.valor_causa} onChange={set('valor_causa')} /></div>
        <div><label className="label">Data de distribuição</label>
          <input className="input" type="date" value={form.data_distribuicao} onChange={set('data_distribuicao')} /></div>
        <div><label className="label">Status</label>
          <select className="input" value={form.status} onChange={set('status')}>
            {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select></div>
        <div className="col-span-2"><label className="label">Observações</label>
          <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} /></div>
      </div>
      <button type="submit" disabled={salvando} className="btn btn-primary mt-4">
        <Gavel size={14} />{salvando ? 'Salvando...' : inicial.id ? 'Salvar alterações' : 'Cadastrar processo'}
      </button>
    </form>
  )
}
