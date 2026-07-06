'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Plus, X, Edit2, Save, Wrench, ChevronDown, ChevronUp, Check, Ban, Archive } from 'lucide-react'
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
  prazo_estimado?: string
  observacoes?: string
  justificativa?: string
  resposta_imobiliaria?: string
  arquivada_em?: string | null
  imovel?: any
  contrato?: any
  locatario?: any
  locador?: any
  fornecedor?: any
}

type HistoricoItem = {
  id: string
  status_anterior: string | null
  status_novo: string
  justificativa: string | null
  criado_em: string
}

type SelectOpt = { id: string; nome?: string; titulo?: string; numero?: string }
type ContratoOpt = SelectOpt & { imovel_id?: string; locatario_id?: string; locador_id?: string }

const statusFlow = ['aberta', 'deferida', 'em_execucao', 'concluida', 'indeferida']

const statusLabel: Record<string,string> = {
  aberta: 'Aguardando decisão', deferida: 'Deferida', indeferida: 'Indeferida',
  em_execucao: 'Em execução', concluida: 'Concluída',
  recebida: 'Recebida', aguardando_locador: 'Aguard. locador', autorizada: 'Autorizada', recusada: 'Recusada',
}
const statusCor: Record<string,string> = {
  aberta: 'badge-blue', deferida: 'badge-green', indeferida: 'badge-red',
  em_execucao: 'badge-purple', concluida: 'badge-green',
  recebida: 'badge-purple', aguardando_locador: 'badge-yellow', autorizada: 'badge-green', recusada: 'badge-red',
}
const urgenciaCor: Record<string, { color: string; bg: string; border: string }> = {
  alta: { color: '#ef4444', bg: '#2e1717', border: '#4a2424' },
  media: { color: '#f59e0b', bg: '#2e2515', border: '#4a3a1f' },
  baixa: { color: '#3fb950', bg: '#1a2e1f', border: '#2d4a35' },
}

const tipos = ['vazamento','eletrica','hidraulica','esquadria','pintura','eletrodomestico','outro']
const locais = ['Cozinha','Banheiro','Sala','Quarto','Área de serviço','Área externa','Fachada','Outro']

const progSteps = ['aberta','deferida','em_execucao','concluida']

function formatDataHora(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

function ProgressBar({ status }: { status: string }) {
  const idx = progSteps.indexOf(status)
  const terminalNegativo = status === 'indeferida' || status === 'recusada'
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {progSteps.map((s,i) => (
          <div key={s} style={{
            background: terminalNegativo ? '#5c2424' : i < idx ? '#2563eb' : i === idx ? '#3987e5' : '#2a2f3a'
          }} className="flex-1 h-1.5 rounded-full" />
        ))}
      </div>
      <div className="flex justify-between mt-0.5">
        {progSteps.map(s => (
          <div key={s} style={{ color: '#5b5e6b' }} className="text-[8px] flex-1 text-center">{statusLabel[s].split(' ')[0]}</div>
        ))}
      </div>
    </div>
  )
}

/** Linha do tempo com o histórico de mudanças de status da demanda. */
function HistoricoDemanda({ demandaId }: { demandaId: string }) {
  const [itens, setItens] = useState<HistoricoItem[] | null>(null)

  useEffect(() => {
    supabase
      .from('demandas_historico')
      .select('id, status_anterior, status_novo, justificativa, criado_em')
      .eq('demanda_id', demandaId)
      .order('criado_em', { ascending: true })
      .then(({ data }) => setItens(data || []))
  }, [demandaId])

  if (itens === null) return <div style={{ color: '#5b5e6b' }} className="text-xs">Carregando histórico...</div>
  if (itens.length === 0) return <div style={{ color: '#5b5e6b' }} className="text-xs">Sem histórico registrado.</div>

  return (
    <div className="space-y-2">
      {itens.map(h => (
        <div key={h.id} className="flex gap-2 text-xs">
          <div style={{ color: '#5b5e6b' }} className="whitespace-nowrap">{formatDataHora(h.criado_em)}</div>
          <div style={{ color: '#c3c2b7' }}>
            {h.status_anterior ? (
              <>Mudou de <strong style={{ color: '#f4f4f3' }}>{statusLabel[h.status_anterior] || h.status_anterior}</strong> para <strong style={{ color: '#f4f4f3' }}>{statusLabel[h.status_novo] || h.status_novo}</strong></>
            ) : (
              <>Demanda aberta com status <strong style={{ color: '#f4f4f3' }}>{statusLabel[h.status_novo] || h.status_novo}</strong></>
            )}
            {h.justificativa && <div style={{ color: '#8b8d98' }} className="mt-0.5">"{h.justificativa}"</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

function PainelDecisao({ demandas, onDecidir }: {
  demandas: Demanda[]
  onDecidir: (id: string, decisao: 'deferida' | 'indeferida', justificativa: string) => Promise<void>
}) {
  const pendentes = demandas.filter(d => d.status === 'aberta' && !d.arquivada_em)
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [justificativa, setJustificativa] = useState('')
  const [decidindo, setDecidindo] = useState(false)
  const [erro, setErro] = useState('')

  if (pendentes.length === 0) return null

  function abrirDecisao(id: string) {
    setAbertoId(id)
    setJustificativa('')
    setErro('')
  }

  async function confirmar(id: string, decisao: 'deferida' | 'indeferida') {
    if (justificativa.trim().length < 5) {
      setErro('Escreva uma justificativa (mínimo 5 caracteres) — ela fica visível para o locatário.')
      return
    }
    setDecidindo(true)
    await onDecidir(id, decisao, justificativa.trim())
    setDecidindo(false)
    setAbertoId(null)
    setJustificativa('')
  }

  return (
    <div className="mb-6">
      <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-3 flex items-center gap-2">
        <span style={{ background: '#ef4444' }} className="w-2 h-2 rounded-full inline-block" />
        Aguardando sua decisão ({pendentes.length})
      </h2>
      <div className="space-y-3">
        {pendentes.map(d => (
          <div key={d.id} className="card" style={{ border: '0.5px solid #1e3a5f' }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ color: '#f4f4f3' }} className="font-medium text-sm">
                  {d.titulo}
                  {d.numero && <span style={{ color: '#5b9bf5' }} className="ml-2 text-xs font-normal">{d.numero}</span>}
                </div>
                <div style={{ color: '#8b8d98' }} className="text-xs mt-0.5">
                  {d.origem === 'locatario' ? '🏠 Aberta pelo locatário' : '🏢 Aberta pela imobiliária'}
                  {d.descricao ? ` · ${d.descricao}` : ''}
                </div>
              </div>
              {abertoId !== d.id && (
                <div className="flex gap-2 flex-shrink-0">
                  <button className="btn btn-sm" style={{ background: '#1a2e1f', color: '#3fb950', border: '0.5px solid #2d4a35' }} onClick={() => abrirDecisao(d.id)}>
                    <Check size={12} />Deferir
                  </button>
                  <button className="btn btn-sm" style={{ background: '#2e1717', color: '#ef4444', border: '0.5px solid #4a2424' }} onClick={() => abrirDecisao(d.id)}>
                    <Ban size={12} />Indeferir
                  </button>
                </div>
              )}
            </div>

            {abertoId === d.id && (
              <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="mt-3 pt-3">
                <label className="label">Justificativa (o locatário vai ver este texto) *</label>
                <textarea
                  className="input" rows={3} value={justificativa}
                  onChange={e => setJustificativa(e.target.value)}
                  placeholder="Ex: Problema é de responsabilidade do locador, autorizado o reparo com o fornecedor X."
                />
                {erro && <div style={{ color: '#ef4444' }} className="text-xs mt-1">{erro}</div>}
                <div className="flex gap-2 mt-3">
                  <button disabled={decidindo} className="btn btn-sm" style={{ background: '#1a2e1f', color: '#3fb950', border: '0.5px solid #2d4a35' }} onClick={() => confirmar(d.id, 'deferida')}>
                    <Check size={12} />{decidindo ? 'Salvando...' : 'Confirmar deferimento'}
                  </button>
                  <button disabled={decidindo} className="btn btn-sm" style={{ background: '#2e1717', color: '#ef4444', border: '0.5px solid #4a2424' }} onClick={() => confirmar(d.id, 'indeferida')}>
                    <Ban size={12} />{decidindo ? 'Salvando...' : 'Confirmar indeferimento'}
                  </button>
                  <button className="btn btn-sm" onClick={() => setAbertoId(null)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
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
  contratos: ContratoOpt[]
  onSalvar: (dados: Record<string,string>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => setForm(f=>({...f,[c]:e.target.value}))

  const contratosDoImovel = form.imovel_id
    ? contratos.filter(c => c.imovel_id === form.imovel_id)
    : contratos

  useEffect(() => {
    if (!form.imovel_id) return
    const vinculados = contratos.filter(c => c.imovel_id === form.imovel_id)
    const contratoAtualValido = vinculados.some(c => c.id === form.contrato_id)

    if (vinculados.length === 1 && !contratoAtualValido) {
      const unico = vinculados[0]
      setForm(f => ({
        ...f,
        contrato_id: unico.id,
        locatario_id: unico.locatario_id || f.locatario_id,
        locador_id: unico.locador_id || f.locador_id,
      }))
    } else if (vinculados.length !== 1 && !contratoAtualValido && form.contrato_id) {
      setForm(f => ({ ...f, contrato_id: '' }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.imovel_id])

  function handleContratoChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const contratoId = e.target.value
    const contrato = contratos.find(c => c.id === contratoId)
    setForm(f => ({
      ...f,
      contrato_id: contratoId,
      locatario_id: contrato?.locatario_id || f.locatario_id,
      locador_id: contrato?.locador_id || f.locador_id,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true); setErro('')
    if ((form.status === 'deferida' || form.status === 'indeferida') && (!form.justificativa || form.justificativa.trim().length < 5)) {
      setErro('Status "Deferida"/"Indeferida" exige uma justificativa (mínimo 5 caracteres).')
      setSalvando(false)
      return
    }
    try { await onSalvar(form) } catch(err: any) { setErro(err.message) }
    setSalvando(false)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">
          {inicial.id ? `Editar demanda${inicial.numero ? ` — ${inicial.numero}` : ''}` : 'Nova demanda'}
        </h2>
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
            <select className="input" value={form.contrato_id} onChange={handleContratoChange}>
              <option value="">Selecionar contrato</option>
              {contratosDoImovel.map(c => <option key={c.id} value={c.id}>#{c.numero}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Locatário</label>
            <select className="input" value={form.locatario_id} onChange={set('locatario_id')}>
              <option value="">Selecionar</option>
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
              <option value="aberta">Aguardando decisão</option>
              <option value="deferida">Deferida</option>
              <option value="indeferida">Indeferida</option>
              <option value="em_execucao">Em execução</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>
          <div>
            <label className="label">Prazo estimado</label>
            <input className="input" type="date" value={form.prazo_estimado} onChange={set('prazo_estimado')} />
          </div>
          {(form.status === 'deferida' || form.status === 'indeferida') && (
            <div className="col-span-2">
              <label className="label">Justificativa (visível para o locatário) *</label>
              <textarea className="input" rows={2} value={form.justificativa} onChange={set('justificativa')} />
            </div>
          )}
          <div className="col-span-2">
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} value={form.descricao} onChange={set('descricao')} placeholder="Descreva o problema detalhadamente..." />
          </div>
          <div className="col-span-2">
            <label className="label">Observações internas</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} />
          </div>
        </div>
        {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
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
  id:'', numero:'', titulo:'', descricao:'', tipo:'', local_imovel:'', urgencia:'media',
  origem:'imobiliaria', status:'aberta', imovel_id:'', contrato_id:'',
  locatario_id:'', locador_id:'', fornecedor_id:'', orcamento:'',
  quem_paga:'a_definir', prazo_estimado:'', observacoes:'', justificativa:'',
}

export default function DemandasPage() {
  const [demandas, setDemandas] = useState<Demanda[]>([])
  const [imoveis, setImoveis] = useState<SelectOpt[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<SelectOpt[]>([])
  const [contratos, setContratos] = useState<ContratoOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [formInicial, setFormInicial] = useState<Record<string,string>|null>(null)
  const [sucesso, setSucesso] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'arquivada' | string>('todos')
  const [expandido, setExpandido] = useState<string|null>(null)

  useEffect(() => { buscarTudo() }, [])

  async function buscarTudo() {
    setLoading(true)
    const [dem, imov, cli, forn, cont] = await Promise.all([
      supabase.from('demandas').select(`*, imovel:imoveis(titulo), contrato:contratos(numero), locatario:clientes!demandas_locatario_id_fkey(nome), locador:clientes!demandas_locador_id_fkey(nome), fornecedor:fornecedores(nome)`).order('created_at', {ascending:false}),
      supabase.from('imoveis').select('id, titulo').order('titulo'),
      supabase.from('clientes').select('id, nome, tipo').order('nome'),
      supabase.from('fornecedores').select('id, nome').order('nome'),
      supabase.from('contratos').select('id, numero, imovel_id, locatario_id, locador_id').order('numero'),
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
      id: d.id, numero: d.numero||'', titulo: d.titulo||'', descricao: d.descricao||'',
      tipo: d.tipo||'', local_imovel: d.local_imovel||'', urgencia: d.urgencia||'media',
      origem: d.origem||'imobiliaria', status: d.status||'aberta',
      imovel_id: (d as any).imovel_id||'', contrato_id: (d as any).contrato_id||'',
      locatario_id: (d as any).locatario_id||'', locador_id: (d as any).locador_id||'',
      fornecedor_id: (d as any).fornecedor_id||'', orcamento: d.orcamento?.toString()||'',
      quem_paga: d.quem_paga||'a_definir', prazo_estimado: d.prazo_estimado||'',
      observacoes: d.observacoes||'', justificativa: d.justificativa||'',
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
      justificativa: dados.justificativa || null,
    }

    let error
    if (dados.id) {
      const res = await supabase.from('demandas').update(payload).eq('id', dados.id)
      error = res.error
    } else {
      // "numero" (protocolo) não é enviado — o gatilho no banco preenche sozinho.
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

  async function decidir(id: string, decisao: 'deferida' | 'indeferida', justificativa: string) {
    const d = demandas.find(x => x.id === id)
    await supabase.from('demandas').update({ status: decisao, justificativa }).eq('id', id)
    await registrarLog({
      acao: 'editou', modulo: 'demanda', registro_id: id,
      registro_nome: d?.titulo || '',
      descricao: `${decisao === 'deferida' ? 'Deferiu' : 'Indeferiu'} demanda "${d?.titulo}": ${justificativa}`,
    })
    setSucesso(decisao === 'deferida' ? 'Demanda deferida!' : 'Demanda indeferida!')
    buscarTudo()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function avancarStatus(d: Demanda) {
    const ordem = ['deferida', 'em_execucao', 'concluida']
    const idx = ordem.indexOf(d.status)
    if (idx === -1 || idx >= ordem.length - 1) return
    const novoStatus = ordem[idx + 1]
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

  async function arquivar(d: Demanda) {
    if (!confirm(`Arquivar a demanda "${d.titulo}"? Ela sai da lista principal mas continua acessível na aba "Arquivada".`)) return
    const { error } = await supabase.from('demandas').update({ arquivada_em: new Date().toISOString() }).eq('id', d.id)
    if (error) {
      alert('Erro ao arquivar: ' + error.message)
      console.error('Erro ao arquivar demanda:', error)
      return
    }
    await registrarLog({
      acao: 'editou', modulo: 'demanda', registro_id: d.id,
      registro_nome: d.titulo,
      descricao: `Arquivou demanda "${d.titulo}"`,
    })
    buscarTudo()
  }

  async function desarquivar(d: Demanda) {
    const { error } = await supabase.from('demandas').update({ arquivada_em: null }).eq('id', d.id)
    if (error) {
      alert('Erro ao desarquivar: ' + error.message)
      console.error('Erro ao desarquivar demanda:', error)
      return
    }
    buscarTudo()
  }

  async function excluir(id: string, titulo: string) {
    if (!confirm(`Excluir demanda "${titulo}"? Esta ação não pode ser desfeita.`)) return
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

  const naoArquivadas = demandas.filter(d => !d.arquivada_em)
  const arquivadas = demandas.filter(d => !!d.arquivada_em)

  const filtradas =
    filtro === 'todos' ? naoArquivadas :
    filtro === 'arquivada' ? arquivadas :
    naoArquivadas.filter(d => d.status === filtro)

  const contadores: Record<string,number> = {}
  naoArquivadas.forEach(d => { contadores[d.status] = (contadores[d.status]||0)+1 })

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Demandas de reparo</h1>
            <button className="btn btn-primary" onClick={abrirNovo}><Plus size={14} />Nova demanda</button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}

          {formInicial !== null && (
            <FormDemanda key={formInicial.id||'novo'} inicial={formInicial}
              imoveis={imoveis} clientes={clientes} fornecedores={fornecedores} contratos={contratos}
              onSalvar={salvar} onCancelar={() => setFormInicial(null)} />
          )}

          <PainelDecisao demandas={demandas} onDecidir={decidir} />

          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setFiltro('todos')} className={`btn btn-sm ${filtro==='todos'?'btn-primary':''}`}>
              Todas ({naoArquivadas.length})
            </button>
            {statusFlow.map(s => {
              const c = contadores[s]||0
              return (
                <button key={s} onClick={() => setFiltro(s)} className={`btn btn-sm ${filtro===s?'btn-primary':''}`}>
                  {statusLabel[s]} ({c})
                </button>
              )
            })}
            <button onClick={() => setFiltro('arquivada')} className={`btn btn-sm ${filtro==='arquivada'?'btn-primary':''}`}>
              <Archive size={11} className="inline mr-1" />Arquivada ({arquivadas.length})
            </button>
          </div>

          {loading ? (
            <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="card text-center py-12" style={{ color: '#8b8d98' }}>
              <Wrench size={36} className="mx-auto mb-2 opacity-30" />
              <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhuma demanda</div>
              <div className="text-sm mt-1">Clique em "Nova demanda" para registrar</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filtradas.map(d => {
                const urg = urgenciaCor[d.urgencia] || urgenciaCor.media
                const arquivadaBool = !!d.arquivada_em
                return (
                  <div key={d.id} className="card" style={{ border: `0.5px solid ${arquivadaBool ? '#2a2f3a' : urg.border}`, opacity: arquivadaBool ? 0.85 : 1 }}>
                    <div className="flex items-start gap-3">
                      <div style={{ color: urg.color, background: urg.bg, border: `0.5px solid ${urg.border}` }} className="px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 mt-0.5">
                        {d.urgencia.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ color: '#f4f4f3' }} className="font-medium text-sm">{d.titulo}</span>
                          {d.numero && <span style={{ color: '#5b9bf5' }} className="text-xs">{d.numero}</span>}
                          <span className={`badge ${statusCor[d.status]||'badge-gray'} text-[10px]`}>{statusLabel[d.status]||d.status}</span>
                          {arquivadaBool && <span className="badge badge-gray text-[10px]"><Archive size={9} className="inline mr-1" />Arquivada</span>}
                        </div>
                        <div style={{ color: '#8b8d98' }} className="text-xs mt-0.5 flex gap-3 flex-wrap">
                          <span>🏠 {getTitulo(d.imovel)}</span>
                          <span>👤 {getNome(d.locatario)}</span>
                          {d.fornecedor && <span>🔧 {getNome(d.fornecedor)}</span>}
                          {d.orcamento && <span>💰 R$ {d.orcamento.toLocaleString('pt-BR', {minimumFractionDigits:2})}</span>}
                        </div>
                        {!arquivadaBool && d.status !== 'aberta' && d.status !== 'indeferida' && d.status !== 'recusada' && <ProgressBar status={d.status} />}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!arquivadaBool && (d.status === 'deferida' || d.status === 'em_execucao') && (
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
                      <div style={{ borderTop: '0.5px solid #2a2f3a', color: '#c3c2b7' }} className="mt-3 pt-3 text-xs space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div><strong style={{ color: '#f4f4f3' }}>Protocolo:</strong> {d.numero || '—'}</div>
                          <div><strong style={{ color: '#f4f4f3' }}>Aberta em:</strong> {d.data_abertura ? formatDataHora(d.data_abertura) : '—'}</div>
                          <div><strong style={{ color: '#f4f4f3' }}>Concluída em:</strong> {d.data_conclusao ? formatDataHora(d.data_conclusao) : '—'}</div>
                          <div><strong style={{ color: '#f4f4f3' }}>Arquivada em:</strong> {d.arquivada_em ? formatDataHora(d.arquivada_em) : '—'}</div>
                        </div>
                        {d.descricao && <div><strong style={{ color: '#f4f4f3' }}>Descrição:</strong> {d.descricao}</div>}
                        {d.tipo && <div><strong style={{ color: '#f4f4f3' }}>Tipo:</strong> {d.tipo} {d.local_imovel && `· ${d.local_imovel}`}</div>}
                        <div><strong style={{ color: '#f4f4f3' }}>Locador:</strong> {getNome(d.locador)}</div>
                        {d.quem_paga && <div><strong style={{ color: '#f4f4f3' }}>Quem paga:</strong> {d.quem_paga}</div>}
                        {d.justificativa && <div><strong style={{ color: '#f4f4f3' }}>Justificativa:</strong> {d.justificativa}</div>}
                        {d.observacoes && <div><strong style={{ color: '#f4f4f3' }}>Obs:</strong> {d.observacoes}</div>}

                        <div style={{ borderTop: '0.5px solid #2a2f3a' }} className="pt-2">
                          <div style={{ color: '#f4f4f3' }} className="font-semibold mb-2">Histórico</div>
                          <HistoricoDemanda demandaId={d.id} />
                        </div>

                        <div className="flex gap-2 pt-2">
                          {arquivadaBool ? (
                            <button className="btn btn-sm" onClick={() => desarquivar(d)}>Desarquivar</button>
                          ) : (
                            <button className="btn btn-sm" onClick={() => arquivar(d)}><Archive size={11} />Arquivar</button>
                          )}
                          <button className="btn btn-sm" style={{ color: '#ef4444', fontSize: '11px' }} onClick={() => excluir(d.id, d.titulo)}>
                            <X size={11} />Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
