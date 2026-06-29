'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Plus, X, Edit2, Save, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import { registrarLog } from '@/lib/logs'

type Demanda = {
  id: string
  numero?: string
  titulo: string
  descricao?: string
  tipo?: string
  local_imovel?: string
  urgencia: string
  origem: string
  status: string
  orcamento?: number
  valor_final?: number
  quem_paga?: string
  data_abertura: string
  data_conclusao?: string
  observacoes?: string
  imovel?: any
  contrato?: any
  locatario?: any
  locador?: any
  fornecedor?: any
}

type SelectOpt = { id: string; nome?: string; titulo?: string; numero?: string }

const statusFlow = ['aberta','recebida','aguardando_locador','autorizada','em_execucao','concluida','recusada']

const statusLabel: Record<string,string> = {
  aberta: 'Aberta', recebida: 'Recebida', aguardando_locador: 'Aguard. locador',
  autorizada: 'Autorizada', em_execucao: 'Em execução', concluida: 'Concluída', recusada: 'Recusada',
}
const statusCor: Record<string,string> = {
  aberta: 'badge-blue', recebida: 'badge-purple', aguardando_locador: 'badge-yellow',
  autorizada: 'badge-green', em_execucao: 'badge-purple', concluida: 'badge-green', recusada: 'badge-red',
}
const urgenciaCor: Record<string,string> = {
  alta: 'text-red-600 bg-red-50 border-red-200',
  media: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  baixa: 'text-green-600 bg-green-50 border-green-200',
}

const tipos = ['vazamento','eletrica','hidraulica','esquadria','pintura','eletrodomestico','outro']
const locais = ['Cozinha','Banheiro','Sala','Quarto','Área de serviço','Área externa','Fachada','Outro']

const progSteps = ['aberta','recebida','aguardando_locador','autorizada','em_execucao','concluida']

function ProgressBar({ status }: { status: string }) {
  const idx = progSteps.indexOf(status)
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {progSteps.map((s,i) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${
            status === 'recusada' ? 'bg-red-300' :
            i < idx ? 'bg-blue-500' : i === idx ? 'bg-blue-400' : 'bg-gray-200'
          }`} />
        ))}
      </div>
      <div className="flex justify-between mt-0.5">
        {progSteps.map(s => (
          <div key={s} className="text-[8px] text-gray-400 flex-1 text-center">{statusLabel[s].split(' ')[0]}</div>
        ))}
      </div>
    </div>
  )
}

function FormDemanda({ inicial, imoveis, clientes, fornecedores, contratos, onSalvar, onCancelar }: {
  inicial: Record<string,string>
  imoveis: SelectOpt[]
  clientes: SelectOpt[]
  fornecedores: SelectOpt[]
  contratos: SelectOpt[]
  onSalvar: (dados: Record<string,string>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[c]:e.target.value}))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    try { await onSalvar(form) } catch(err: any) { setErro(err.message) }
    setSalvando(false)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">{inicial.id ? 'Editar demanda' : 'Nova demanda'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Título *</label>
            <input className="input" required value={form.titulo} onChange={set('titulo')} placeholder="Ex: Vazamento na torneira da cozinha" />
          </div>
          <div>
            <label className="label">Imóvel</label>
            <select className="input" value={form.imovel_id} onChange={set('imovel_id')}>
              <option value="">Selecionar imóvel</option>
              {imoveis.map(i => <option key={i.id} value={i.id}>{i.titulo}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Contrato</label>
            <select className="input" value={form.contrato_id} onChange={set('contrato_id')}>
              <option value="">Selecionar contrato</option>
              {contratos.map(c => <option key={c.id} value={c.id}>#{c.numero}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Locatário</label>
            <select className="input" value={form.locatario_id} onChange={set('locatario_id')}>
              <option value="">Selecionar</option>
              {clientes.filter(c=>['locatario','comprador','lead'].includes((c as any).tipo)).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Locador</label>
            <select className="input" value={form.locador_id} onChange={set('locador_id')}>
              <option value="">Selecionar</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo do problema</label>
            <select className="input" value={form.tipo} onChange={set('tipo')}>
              <option value="">Selecionar</option>
              {tipos.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Local</label>
            <select className="input" value={form.local_imovel} onChange={set('local_imovel')}>
              <option value="">Selecionar</option>
              {locais.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Urgência *</label>
            <select className="input" value={form.urgencia} onChange={set('urgencia')}>
              <option value="alta">Alta — risco à saúde/segurança</option>
              <option value="media">Média — afeta conforto</option>
              <option value="baixa">Baixa — cosmético</option>
            </select>
          </div>
          <div>
            <label className="label">Origem</label>
            <select className="input" value={form.origem} onChange={set('origem')}>
              <option value="locatario">Locatário</option>
              <option value="imobiliaria">Imobiliária</option>
            </select>
          </div>
          <div>
            <label className="label">Fornecedor</label>
            <select className="input" value={form.fornecedor_id} onChange={set('fornecedor_id')}>
              <option value="">A definir</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Orçamento (R$)</label>
            <input className="input" type="number" value={form.orcamento} onChange={set('orcamento')} placeholder="0,00" />
          </div>
          <div>
            <label className="label">Quem paga</label>
            <select className="input" value={form.quem_paga} onChange={set('quem_paga')}>
              <option value="a_definir">A definir</option>
              <option value="locador">Locador</option>
              <option value="locatario">Locatário</option>
              <option value="imobiliaria">Imobiliária</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              {statusFlow.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Prazo estimado</label>
            <input className="input" type="date" value={form.prazo_estimado} onChange={set('prazo_estimado')} />
          </div>
          <div className="col-span-2">
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} value={form.descricao} onChange={set('descricao')} placeholder="Descreva o problema detalhadamente..." />
          </div>
          <div className="col-span-2">
            <label className="label">Observações internas</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} />
          </div>
        </div>
        {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            <Save size={13} />{salvando ? 'Salvando...' : inicial.id ? 'Salvar' : 'Abrir demanda'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

const formVazio = {
  id:'', titulo:'', descricao:'', tipo:'', local_imovel:'', urgencia:'media',
  origem:'imobiliaria', status:'aberta', imovel_id:'', contrato_id:'',
  locatario_id:'', locador_id:'', fornecedor_id:'', orcamento:'',
  quem_paga:'a_definir', prazo_estimado:'', observacoes:'',
}

export default function DemandasPage() {
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [imoveis, setImoveis] = useState<SelectOpt[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<SelectOpt[]>([])
  const [contratos, setContratos] = useState<SelectOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string,string>|null>(null)
  const [sucesso, setSucesso] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [expandido, setExpandido] = useState<string|null>(null)

  useEffect(() => { buscarTudo() }, [])

  async function buscarTudo() {
    setLoading(true)
    const [dem, imov, cli, forn, cont] = await Promise.all([
      supabase.from('demandas').select(`*, imovel:imoveis(titulo), contrato:contratos(numero), locatario:clientes!demandas_locatario_id_fkey(nome), locador:clientes!demandas_locador_id_fkey(nome), fornecedor:fornecedores(nome)`).order('created_at', {ascending:false}),
      supabase.from('imoveis').select('id, titulo').order('titulo'),
      supabase.from('clientes').select('id, nome, tipo').order('nome'),
      supabase.from('fornecedores').select('id, nome').order('nome'),
      supabase.from('contratos').select('id, numero').order('numero'),
    ])
    if (dem.data) setDemandas(dem.data)
    if (imov.data) setImoveis(imov.data)
    if (cli.data) setClientes(cli.data)
    if (forn.data) setFornecedores(forn.data)
    if (cont.data) setContratos(cont.data)
    setLoading(false)
  }

  function abrirNovo() { setFormInicial({...formVazio}) }

  function abrirEdicao(d: Demanda) {
    setFormInicial({
      id: d.id, titulo: d.titulo||'', descricao: d.descricao||'',
      tipo: d.tipo||'', local_imovel: d.local_imovel||'', urgencia: d.urgencia||'media',
      origem: d.origem||'imobiliaria', status: d.status||'aberta',
      imovel_id: (d as any).imovel_id||'', contrato_id: (d as any).contrato_id||'',
      locatario_id: (d as any).locatario_id||'', locador_id: (d as any).locador_id||'',
      fornecedor_id: (d as any).fornecedor_id||'', orcamento: d.orcamento?.toString()||'',
      quem_paga: d.quem_paga||'a_definir', prazo_estimado: d.prazo_estimado||'',
      observacoes: d.observacoes||'',
    })
  }

  async function salvar(dados: Record<string,string>) {
    const payload = {
      titulo: dados.titulo, descricao: dados.descricao||null, tipo: dados.tipo||null,
      local_imovel: dados.local_imovel||null, urgencia: dados.urgencia, origem: dados.origem,
      status: dados.status,
      imovel_id: dados.imovel_id||null, contrato_id: dados.contrato_id||null,
      locatario_id: dados.locatario_id||null, locador_id: dados.locador_id||null,
      fornecedor_id: dados.fornecedor_id||null,
      orcamento: dados.orcamento ? parseFloat(dados.orcamento) : null,
      quem_paga: dados.quem_paga||null,
      prazo_estimado: dados.prazo_estimado||null,
      observacoes: dados.observacoes||null,
    }

    let error
    if (dados.id) {
      const res = await supabase.from('demandas').update(payload).eq('id', dados.id)
      error = res.error
    } else {
      const res = await supabase.from('demandas').insert([{...payload, data_abertura: new Date().toISOString()}])
      error = res.error
    }
    if (error) throw new Error(error.message)

    await registrarLog({
      acao: dados.id ? 'editou' : 'criou',
      modulo: 'demanda', registro_nome: dados.titulo,
      descricao: `${dados.id ? 'Editou' : 'Abriu'} demanda: ${dados.titulo}`,
    })

    setFormInicial(null)
    setSucesso(dados.id ? 'Demanda atualizada!' : 'Demanda aberta!')
    buscarTudo()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function avancarStatus(d: Demanda) {
    const idx = statusFlow.indexOf(d.status)
    if (idx >= statusFlow.length - 2) return
    const novoStatus = statusFlow[idx + 1]
    await supabase.from('demandas').update({
      status: novoStatus,
      data_conclusao: novoStatus === 'concluida' ? new Date().toISOString() : null,
    }).eq('id', d.id)
    await registrarLog({
      acao: 'editou', modulo: 'demanda', registro_id: d.id,
      registro_nome: d.titulo,
      descricao: `Avançou demanda "${d.titulo}" para: ${statusLabel[novoStatus]}`,
    })
    buscarTudo()
  }

  async function excluir(id: string, titulo: string) {
    if (!confirm(`Excluir demanda "${titulo}"?`)) return
    await supabase.from('demandas').delete().eq('id', id)
    buscarTudo()
  }

  function getNome(val: any): string {
    if (!val) return '—'
    if (Array.isArray(val)) return val[0]?.nome || '—'
    return val.nome || '—'
  }
  function getTitulo(val: any): string {
    if (!val) return '—'
    if (Array.isArray(val)) return val[0]?.titulo || '—'
    return val.titulo || '—'
  }
  function getNumero(val: any): string {
    if (!val) return '—'
    if (Array.isArray(val)) return val[0]?.numero || '—'
    return val.numero || '—'
  }

  const filtradas = filtroStatus === 'todos' ? demandas : demandas.filter(d => d.status === filtroStatus)
  const contadores: Record<string,number> = {}
  demandas.forEach(d => { contadores[d.status] = (contadores[d.status]||0)+1 })

  return (
    <AppLayout>
      <Topbar titulo="Demandas de reparo">
        <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} />Nova demanda</button>
      </Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

        {formInicial !== null && (
          <FormDemanda key={formInicial.id||'novo'} inicial={formInicial}
            imoveis={imoveis} clientes={clientes} fornecedores={fornecedores} contratos={contratos}
            onSalvar={salvar} onCancelar={() => setFormInicial(null)} />
        )}

        {/* Filtros */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFiltroStatus('todos')} className={`btn btn-sm ${filtroStatus==='todos'?'btn-primary':''}`}>
            Todas ({demandas.length})
          </button>
          {statusFlow.map(s => {
            const c = contadores[s]||0
            if (!c) return null
            return (
              <button key={s} onClick={() => setFiltroStatus(s)} className={`btn btn-sm ${filtroStatus===s?'btn-primary':''}`}>
                {statusLabel[s]} ({c})
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <Wrench size={36} className="mx-auto mb-2 opacity-30" />
            <div className="font-medium text-gray-500">Nenhuma demanda</div>
            <div className="text-sm mt-1">Clique em "Nova demanda" para registrar</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map(d => (
              <div key={d.id} className={`card border ${d.urgencia==='alta'?'border-red-200':d.urgencia==='media'?'border-yellow-200':'border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`px-2 py-0.5 rounded text-[10px] font-medium border flex-shrink-0 mt-0.5 ${urgenciaCor[d.urgencia]}`}>
                    {d.urgencia.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{d.titulo}</span>
                      <span className={`badge badge-${statusCor[d.status]||'gray'} text-[10px]`}>{statusLabel[d.status]}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3 flex-wrap">
                      <span>🏠 {getTitulo(d.imovel)}</span>
                      <span>👤 {getNome(d.locatario)}</span>
                      {d.fornecedor && <span>🔧 {getNome(d.fornecedor)}</span>}
                      {d.orcamento && <span>💰 R$ {d.orcamento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>}
                    </div>
                    <ProgressBar status={d.status} />
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {d.status !== 'concluida' && d.status !== 'recusada' && (
                      <button className="btn btn-sm btn-primary text-[11px]" onClick={() => avancarStatus(d)}>
                        Avançar →
                      </button>
                    )}
                    <button className="btn btn-sm" onClick={() => abrirEdicao(d)}><Edit2 size={12} /></button>
                    <button className="btn btn-sm" onClick={() => setExpandido(expandido===d.id?null:d.id)}>
                      {expandido===d.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {expandido === d.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 space-y-1">
                    {d.descricao && <div><strong>Descrição:</strong> {d.descricao}</div>}
                    {d.tipo && <div><strong>Tipo:</strong> {d.tipo} {d.local_imovel && `· ${d.local_imovel}`}</div>}
                    <div><strong>Locador:</strong> {getNome(d.locador)}</div>
                    {d.quem_paga && <div><strong>Quem paga:</strong> {d.quem_paga}</div>}
                    {d.observacoes && <div><strong>Obs:</strong> {d.observacoes}</div>}
                    <div className="flex gap-2 pt-2">
                      <button className="btn btn-sm" style={{color:'var(--text-danger)',fontSize:'11px'}} onClick={() => excluir(d.id, d.titulo)}>
                        <X size={11} />Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
