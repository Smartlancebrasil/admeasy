'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { FileText, Plus, X, AlertTriangle, Edit2, FileDown } from 'lucide-react'
import { registrarLog } from '@/lib/logs'
import Link from 'next/link'

type Contrato = {
  id: string
  numero: string
  tipo: string
  data_inicio: string
  data_fim: string
  valor_mensal: number
  valor_atual?: number
  valor_caucao?: number
  indice_reajuste: string
  mes_reajuste?: number
  multa_rescisao_locatario: number
  multa_rescisao_locador: number
  aviso_previo_dias: number
  tipo_garantia?: string
  status: string
  observacoes?: string
  imovel_id?: string
  locatario_id?: string
  locador_id?: string
  imovel?: any
  locatario?: any
  locador?: any
}

type SelectOpt = { id: string; titulo?: string; nome?: string }

function diasRestantes(dataFim: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const fim = new Date(dataFim + 'T00:00:00')
  return Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function statusContrato(dataFim: string, status: string) {
  if (status === 'encerrado' || status === 'rescindido') return status
  const dias = diasRestantes(dataFim)
  if (dias < 0) return 'encerrado'
  if (dias <= 15) return 'vencendo'
  if (dias <= 30) return 'atencao'
  return 'ativo'
}

const statusBadge: Record<string,string> = {
  ativo:'badge badge-green', vencendo:'badge badge-red',
  atencao:'badge badge-yellow', encerrado:'badge badge-gray',
  rescindido:'badge badge-gray', pendente:'badge badge-yellow',
}
const statusLabel: Record<string,string> = {
  ativo:'Ativo', vencendo:'Vencendo', atencao:'Atenção',
  encerrado:'Encerrado', rescindido:'Rescindido', pendente:'Pendente',
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date + 'T00:00:00'))
}
function getTitulo(val: any): string {
  if (!val) return '—'; if (Array.isArray(val)) return val[0]?.titulo || '—'; return val.titulo || '—'
}
function getNome(val: any): string {
  if (!val) return '—'; if (Array.isArray(val)) return val[0]?.nome || '—'; return val.nome || '—'
}

const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const formVazio = {
  id:'', numero:'', tipo:'locacao_residencial',
  imovel_id:'', locatario_id:'', locador_id:'',
  data_inicio:'', data_fim:'',
  valor_mensal:'', valor_caucao:'',
  parcelas_caucao: '1',
  indice_reajuste:'igpm', mes_reajuste:'1',
  multa_rescisao_locatario:'3', multa_rescisao_locador:'3',
  aviso_previo_dias:'30', tipo_garantia:'caucao',
  status:'ativo', observacoes:'',
}

function FormContrato({ inicial, imoveis, clientes, onSalvar, onCancelar }: {
  inicial: Record<string,string>
  imoveis: SelectOpt[]
  clientes: SelectOpt[]
  onSalvar: (dados: Record<string,string>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[c]:e.target.value}))

  const caucaoVal = parseFloat(form.valor_caucao) || 0
  const parcelasNum = parseInt(form.parcelas_caucao) || 1
  const valorParcela = caucaoVal > 0 && parcelasNum > 1 ? caucaoVal / parcelasNum : caucaoVal

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    try { await onSalvar(form) } catch(err: any) { setErro(err.message) }
    setSalvando(false)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">{inicial.id ? `Editando contrato #${inicial.numero}` : 'Novo contrato'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      {erro && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg mb-3 text-sm">{erro}</div>}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Número *</label>
            <input className="input" required value={form.numero} onChange={set('numero')} placeholder="Ex: 001/2024" /></div>
          <div><label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={set('tipo')}>
              <option value="locacao_residencial">Locação residencial</option>
              <option value="locacao_comercial">Locação comercial</option>
              <option value="compra_venda">Compra e venda</option>
            </select></div>
          <div className="col-span-2"><label className="label">Imóvel *</label>
            <select className="input" required value={form.imovel_id} onChange={set('imovel_id')}>
              <option value="">Selecionar imóvel</option>
              {imoveis.map(i => <option key={i.id} value={i.id}>{i.titulo}</option>)}
            </select></div>
          <div><label className="label">Locatário *</label>
            <select className="input" required value={form.locatario_id} onChange={set('locatario_id')}>
              <option value="">Selecionar</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
          <div><label className="label">Locador *</label>
            <select className="input" required value={form.locador_id} onChange={set('locador_id')}>
              <option value="">Selecionar</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
          <div><label className="label">Data início *</label>
            <input className="input" type="date" required value={form.data_inicio} onChange={set('data_inicio')} /></div>
          <div><label className="label">Data fim *</label>
            <input className="input" type="date" required value={form.data_fim} onChange={set('data_fim')} /></div>
          <div><label className="label">Valor mensal (R$) *</label>
            <input className="input" type="number" required value={form.valor_mensal} onChange={set('valor_mensal')} /></div>

          {/* Caução + Parcelamento */}
          <div>
            <label className="label">Caução (R$)</label>
            <input className="input" type="number" step="0.01" value={form.valor_caucao} onChange={set('valor_caucao')} placeholder="0,00" />
          </div>

          {caucaoVal > 0 && (
            <div className="col-span-2">
              <label className="label">Parcelamento do caução</label>
              <div className="flex gap-2 flex-wrap">
                {[1,2,3,4,5].map(p => (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({...f, parcelas_caucao: String(p)}))}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${parcelasNum === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {p === 1 ? 'À vista' : `${p}x`}
                  </button>
                ))}
              </div>
              {parcelasNum > 1 && caucaoVal > 0 && (
                <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs text-blue-700 font-medium">
                    {parcelasNum}x de {formatVal(valorParcela)} — Total: {formatVal(caucaoVal)}
                  </p>
                  <p className="text-[10px] text-blue-500 mt-1">
                    As parcelas serão lançadas automaticamente no financeiro a partir da data de início do contrato.
                  </p>
                </div>
              )}
            </div>
          )}

          <div><label className="label">Índice de reajuste</label>
            <select className="input" value={form.indice_reajuste} onChange={set('indice_reajuste')}>
              <option value="igpm">IGP-M</option><option value="ipca">IPCA</option>
              <option value="inpc">INPC</option><option value="ivar">IVAR</option>
            </select></div>
          <div><label className="label">Mês do reajuste</label>
            <select className="input" value={form.mes_reajuste} onChange={set('mes_reajuste')}>
              {meses.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
            </select></div>
          <div><label className="label">Multa locatário (aluguéis)</label>
            <input className="input" type="number" step="0.5" value={form.multa_rescisao_locatario} onChange={set('multa_rescisao_locatario')} /></div>
          <div><label className="label">Multa locador (aluguéis)</label>
            <input className="input" type="number" step="0.5" value={form.multa_rescisao_locador} onChange={set('multa_rescisao_locador')} /></div>
          <div><label className="label">Aviso prévio (dias)</label>
            <input className="input" type="number" value={form.aviso_previo_dias} onChange={set('aviso_previo_dias')} /></div>
          <div><label className="label">Garantia</label>
            <select className="input" value={form.tipo_garantia} onChange={set('tipo_garantia')}>
              <option value="caucao">Caução</option>
              <option value="fiador">Fiador</option>
              <option value="seguro_fianca">Seguro fiança</option>
              <option value="titulo_capitalizacao">Título de capitalização</option>
            </select></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="encerrado">Encerrado</option>
              <option value="rescindido">Rescindido</option>
            </select></div>
          <div className="col-span-2"><label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} /></div>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            {salvando ? 'Salvando...' : inicial.id ? 'Salvar alterações' : 'Criar contrato'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export default function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [imoveis, setImoveis] = useState<SelectOpt[]>([])
  const [clientes, setClientes] = useState<SelectOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string,string>|null>(null)
  const [sucesso, setSucesso] = useState('')

  const ORG_ID = '00000000-0000-0000-0000-000000000001'

  useEffect(() => { buscarTudo() }, [])

  async function buscarTudo() {
    setLoading(true)
    const [cont, imov, cli] = await Promise.all([
      supabase.from('contratos').select(`*, imovel:imoveis(titulo), locatario:clientes!contratos_locatario_id_fkey(nome), locador:clientes!contratos_locador_id_fkey(nome)`).order('numero'),
      supabase.from('imoveis').select('id, titulo').order('titulo'),
      supabase.from('clientes').select('id, nome').order('nome'),
    ])
    if (cont.data) setContratos(cont.data)
    if (imov.data) setImoveis(imov.data)
    if (cli.data) setClientes(cli.data)
    setLoading(false)
  }

  function abrirNovo() { setFormInicial({...formVazio}) }

  function abrirEdicao(c: Contrato) {
    setFormInicial({
      id: c.id, numero: c.numero||'', tipo: c.tipo||'locacao_residencial',
      imovel_id: c.imovel_id||'', locatario_id: c.locatario_id||'', locador_id: c.locador_id||'',
      data_inicio: c.data_inicio||'', data_fim: c.data_fim||'',
      valor_mensal: c.valor_mensal?.toString()||'', valor_caucao: c.valor_caucao?.toString()||'',
      parcelas_caucao: '1',
      indice_reajuste: c.indice_reajuste||'igpm', mes_reajuste: c.mes_reajuste?.toString()||'1',
      multa_rescisao_locatario: c.multa_rescisao_locatario?.toString()||'3',
      multa_rescisao_locador: c.multa_rescisao_locador?.toString()||'3',
      aviso_previo_dias: c.aviso_previo_dias?.toString()||'30',
      tipo_garantia: c.tipo_garantia||'caucao', status: c.status||'ativo',
      observacoes: c.observacoes||'',
    })
  }

  async function salvar(dados: Record<string,string>) {
    const inicioDate = new Date(dados.data_inicio)
    const proximoReajuste = new Date(inicioDate)
    proximoReajuste.setFullYear(proximoReajuste.getFullYear() + 1)

    const payload = {
      numero: dados.numero, tipo: dados.tipo,
      imovel_id: dados.imovel_id, locatario_id: dados.locatario_id, locador_id: dados.locador_id,
      data_inicio: dados.data_inicio, data_fim: dados.data_fim,
      valor_mensal: parseFloat(dados.valor_mensal),
      valor_atual: parseFloat(dados.valor_mensal),
      valor_caucao: dados.valor_caucao ? parseFloat(dados.valor_caucao) : null,
      indice_reajuste: dados.indice_reajuste, mes_reajuste: parseInt(dados.mes_reajuste),
      proximo_reajuste: dados.id ? undefined : proximoReajuste.toISOString().split('T')[0],
      multa_rescisao_locatario: parseFloat(dados.multa_rescisao_locatario),
      multa_rescisao_locador: parseFloat(dados.multa_rescisao_locador),
      aviso_previo_dias: parseInt(dados.aviso_previo_dias),
      tipo_garantia: dados.tipo_garantia, status: dados.status,
      observacoes: dados.observacoes||null,
      organization_id: ORG_ID,
    }

    let contratoId = dados.id
    let error

    if (dados.id) {
      const res = await supabase.from('contratos').update(payload).eq('id', dados.id)
      error = res.error
    } else {
      const res = await supabase.from('contratos').insert([{...payload, data_assinatura: dados.data_inicio}]).select().single()
      error = res.error
      if (res.data) contratoId = res.data.id
    }

    if (error) throw new Error(error.message)

    // Gerar parcelas do caução no financeiro (apenas em novo contrato)
    const caucaoVal = parseFloat(dados.valor_caucao) || 0
    const parcelasNum = parseInt(dados.parcelas_caucao) || 1

    if (!dados.id && caucaoVal > 0 && contratoId) {
      const valorParcela = caucaoVal / parcelasNum
      const lancamentos = []
      for (let i = 0; i < parcelasNum; i++) {
        const vencimento = new Date(dados.data_inicio + 'T00:00:00')
        vencimento.setMonth(vencimento.getMonth() + i)
        lancamentos.push({
          organization_id: ORG_ID,
          contrato_id: contratoId,
          cliente_id: dados.locatario_id,
          tipo: 'receita',
          categoria: 'caucao',
          descricao: parcelasNum > 1
            ? `Caução ${i + 1}/${parcelasNum} — Contrato #${dados.numero}`
            : `Caução — Contrato #${dados.numero}`,
          valor: valorParcela,
          data_lancamento: vencimento.toISOString().split('T')[0],
          status: 'pendente',
        })
      }
      await supabase.from('lancamentos').insert(lancamentos)
    }

    await registrarLog({
      acao: dados.id ? 'editou' : 'criou',
      modulo: 'contrato', registro_nome: `Contrato #${dados.numero}`,
      descricao: `${dados.id ? 'Editou' : 'Criou'} o contrato #${dados.numero}${!dados.id && caucaoVal > 0 && parcelasNum > 1 ? ` — caução parcelado em ${parcelasNum}x` : ''}`,
    })

    setFormInicial(null)
    setSucesso(dados.id ? 'Contrato atualizado!' : `Contrato criado!${caucaoVal > 0 && parcelasNum > 1 ? ` Caução parcelado em ${parcelasNum}x lançado no financeiro.` : ''}`)
    buscarTudo()
    setTimeout(() => setSucesso(''), 4000)
  }

  async function excluir(id: string, numero: string) {
    if (!confirm(`Excluir contrato #${numero}?`)) return
    await supabase.from('contratos').delete().eq('id', id)
    buscarTudo()
  }

  const vencendo = contratos.filter(c => {
    const st = statusContrato(c.data_fim, c.status)
    return st === 'vencendo' || st === 'atencao'
  })

  return (
    <AppLayout>
      <Topbar titulo="Contratos">
        <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} />Novo contrato</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

        {formInicial !== null && (
          <FormContrato key={formInicial.id||'novo'} inicial={formInicial}
            imoveis={imoveis} clientes={clientes}
            onSalvar={salvar} onCancelar={() => setFormInicial(null)} />
        )}

        {vencendo.length > 0 && !formInicial && (
          <div className="card mb-4 border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">{vencendo.length} contrato(s) vencendo em breve</span>
            </div>
            {vencendo.map(c => {
              const dias = diasRestantes(c.data_fim)
              return (
                <div key={c.id} className="text-xs text-yellow-700 py-1 border-t border-yellow-200 first:border-0">
                  #{c.numero} — {getTitulo(c.imovel)} · {getNome(c.locatario)} · vence em {dias} dias ({formatDate(c.data_fim)})
                </div>
              )
            })}
          </div>
        )}

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : contratos.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-2 opacity-30" />
              <div className="font-medium text-gray-500">Nenhum contrato cadastrado</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['#','Imóvel','Locatário','Locador','Início','Vencimento','Valor','Índice','Status',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contratos.map(c => {
                  const st = statusContrato(c.data_fim, c.status)
                  const dias = diasRestantes(c.data_fim)
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">#{c.numero}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-sm">{getTitulo(c.imovel)}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{getNome(c.locatario)}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{getNome(c.locador)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.data_inicio)}</td>
                      <td className="px-4 py-3 text-xs">
                        <div className={st==='vencendo'?'text-red-600 font-semibold':st==='atencao'?'text-yellow-600 font-medium':'text-gray-500'}>
                          {formatDate(c.data_fim)}
                        </div>
                        {dias > 0 && dias <= 60 && <div className="text-[10px] text-gray-400">{dias} dias</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-sm">{formatVal(c.valor_atual || c.valor_mensal)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 uppercase">{c.indice_reajuste}</td>
                      <td className="px-4 py-3"><span className={statusBadge[st]||'badge badge-gray'}>{statusLabel[st]||st}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button className="btn btn-sm" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                          <Link href={`/contratos/${c.id}/pdf`} className="btn btn-sm text-blue-600"><FileDown size={12} />PDF</Link>
                          <button className="btn btn-sm" style={{color:'var(--text-danger)'}} onClick={() => excluir(c.id, c.numero)}><X size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
