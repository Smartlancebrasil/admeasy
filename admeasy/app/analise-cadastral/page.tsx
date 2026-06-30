'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Plus, X, Upload, Trash2, ExternalLink, CheckCircle, XCircle, Clock, Search, FileText, Eye, Copy } from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

type Cliente = { id: string; nome: string; cpf?: string; telefone?: string; email?: string }
type Contrato = { id: string; numero: string; imovel?: any }
type Documento = { nome: string; url: string; tipo: string }

type Analise = {
  id: string
  cliente_id: string
  contrato_id?: string
  status: 'pendente' | 'em_analise' | 'aprovado' | 'reprovado'
  parecer?: string
  score_smartbuscas?: string
  observacoes?: string
  created_at: string
  cliente?: any
  contrato?: any
}

const statusConfig: Record<string, { label: string; badge: string; icon: any; cor: string }> = {
  pendente:   { label: 'Pendente',    badge: 'badge-yellow', icon: Clock,         cor: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
  em_analise: { label: 'Em análise',  badge: 'badge-blue',   icon: Search,        cor: 'border-blue-200 bg-blue-50 text-blue-700' },
  aprovado:   { label: 'Aprovado',    badge: 'badge-green',  icon: CheckCircle,   cor: 'border-green-200 bg-green-50 text-green-700' },
  reprovado:  { label: 'Reprovado',   badge: 'badge-red',    icon: XCircle,       cor: 'border-red-200 bg-red-50 text-red-700' },
}

const DOCS_PADRAO = ['RG (frente e verso)', 'CPF', 'Comprovante de renda', 'Holerite', 'Extrato bancário 3 meses', 'Comprovante de endereço', 'Declaração IR', 'CTPS', 'Contrato social (PJ)']

export default function AnaliseCadastralPage() {
  const [analises, setAnalises] = useState<Analise[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [loading, setLoading] = useState(true)
  const [showNova, setShowNova] = useState(false)
  const [analiseAberta, setAnaliseAberta] = useState<Analise | null>(null)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [copiado, setCopiado] = useState(false)

  const [clienteId, setClienteId] = useState('')
  const [contratoId, setContratoId] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [status, setStatus] = useState<string>('pendente')
  const [parecer, setParecer] = useState('')
  const [score, setScore] = useState('')
  const [obsEdit, setObsEdit] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [an, cl, co] = await Promise.all([
      supabase.from('analises_cadastrais')
        .select('*, cliente:clientes(id, nome, cpf, telefone, email), contrato:contratos(id, numero, imovel:imoveis(titulo))')
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome, cpf, telefone, email').eq('organization_id', ORG_ID).order('nome'),
      supabase.from('contratos').select('id, numero, imovel:imoveis(titulo)').eq('organization_id', ORG_ID).order('numero'),
    ])
    if (an.data) setAnalises(an.data)
    if (cl.data) setClientes(cl.data)
    if (co.data) setContratos(co.data)
    setLoading(false)
  }

  async function abrirAnalise(a: Analise) {
    setAnaliseAberta(a)
    setStatus(a.status)
    setParecer(a.parecer || '')
    setScore(a.score_smartbuscas || '')
    setObsEdit(a.observacoes || '')
    await carregarDocumentos(a.id)
  }

  async function carregarDocumentos(analiseId: string) {
    const { data } = await supabase.storage.from('documentos').list(`analises/${analiseId}`)
    if (data) {
      setDocumentos(data.map(f => ({
        nome: f.name,
        url: supabase.storage.from('documentos').getPublicUrl(`analises/${analiseId}/${f.name}`).data.publicUrl,
        tipo: f.name.split('.').pop() || '',
      })))
    } else setDocumentos([])
  }

  async function criarAnalise() {
    if (!clienteId) { alert('Selecione um cliente'); return }
    setSalvando(true)
    const { error } = await supabase.from('analises_cadastrais').insert([{
      organization_id: ORG_ID,
      cliente_id: clienteId,
      contrato_id: contratoId || null,
      observacoes: observacoes || null,
      status: 'pendente',
    }])
    setSalvando(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowNova(false); setClienteId(''); setContratoId(''); setObservacoes('')
    setSucesso('Análise criada!'); setTimeout(() => setSucesso(''), 3000)
    carregar()
  }

  async function salvarAnalise() {
    if (!analiseAberta) return
    setSalvando(true)
    await supabase.from('analises_cadastrais').update({
      status, parecer: parecer || null,
      score_smartbuscas: score || null,
      observacoes: obsEdit || null,
      updated_at: new Date().toISOString(),
    }).eq('id', analiseAberta.id)
    setSalvando(false)
    setSucesso('Análise salva!'); setTimeout(() => setSucesso(''), 3000)
    carregar()
    setAnaliseAberta(prev => prev ? { ...prev, status: status as any, parecer, score_smartbuscas: score, observacoes: obsEdit } : null)
  }

  async function uploadDocumento(file: File) {
    if (!analiseAberta) return
    setUploadando(true)
    const path = `analises/${analiseAberta.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (!error) { setSucesso('Documento enviado!'); setTimeout(() => setSucesso(''), 3000); carregarDocumentos(analiseAberta.id) }
    setUploadando(false)
  }

  async function excluirDocumento(nome: string) {
    if (!analiseAberta || !confirm('Excluir documento?')) return
    await supabase.storage.from('documentos').remove([`analises/${analiseAberta.id}/${nome}`])
    carregarDocumentos(analiseAberta.id)
  }

  async function excluirAnalise(id: string) {
    if (!confirm('Excluir esta análise?')) return
    await supabase.from('analises_cadastrais').delete().eq('id', id)
    if (analiseAberta?.id === id) setAnaliseAberta(null)
    carregar()
  }

  function getVal(val: any, campo: string) {
    if (!val) return ''
    if (Array.isArray(val)) return val[0]?.[campo] || ''
    return val[campo] || ''
  }

  function copiarCpf(cpf: string) {
    navigator.clipboard.writeText(cpf)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const cpfCliente = getVal(analiseAberta?.cliente, 'cpf')
  const nomeCliente = getVal(analiseAberta?.cliente, 'nome')

  return (
    <AppLayout>
      <Topbar titulo="Análise Cadastral" />
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm flex justify-between">
            {sucesso}<button onClick={() => setSucesso('')}><X size={14} /></button>
          </div>
        )}

        <div className="flex justify-end mb-5">
          <button onClick={() => setShowNova(true)} className="btn btn-primary"><Plus size={14} />Nova análise</button>
        </div>

        {showNova && (
          <div className="card mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Nova análise cadastral</h3>
              <button onClick={() => setShowNova(false)}><X size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Cliente (locatário) *</label>
                <select className="input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
                  <option value="">Selecione o cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.cpf ? ` — ${c.cpf}` : ''}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Vincular a um contrato (opcional)</label>
                <select className="input" value={contratoId} onChange={e => setContratoId(e.target.value)}>
                  <option value="">Nenhum contrato</option>
                  {contratos.map(c => <option key={c.id} value={c.id}>#{c.numero} — {getVal(c.imovel, 'titulo')}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Observações iniciais</label>
                <textarea className="input" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações relevantes..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={criarAnalise} disabled={salvando} className="btn btn-primary">{salvando ? 'Criando...' : 'Criar análise'}</button>
              <button onClick={() => setShowNova(false)} className="btn">Cancelar</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5">
          {/* Lista */}
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
            ) : analises.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium text-gray-500">Nenhuma análise cadastrada</p>
              </div>
            ) : analises.map(a => {
              const cfg = statusConfig[a.status]
              const Icon = cfg.icon
              const ativo = analiseAberta?.id === a.id
              return (
                <div key={a.id} onClick={() => abrirAnalise(a)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-gray-50 ${ativo ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{getVal(a.cliente, 'nome')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">CPF: {getVal(a.cliente, 'cpf') || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${cfg.badge} flex items-center gap-1`}><Icon size={10} />{cfg.label}</span>
                      <button onClick={e => { e.stopPropagation(); excluirAnalise(a.id) }} className="text-gray-200 hover:text-red-400"><X size={13} /></button>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-300 mt-1">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              )
            })}
          </div>

          {/* Painel detalhes */}
          {!analiseAberta ? (
            <div className="card text-center py-16 text-gray-400">
              <Search size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">Selecione uma análise</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* Card cliente + SmartBuscas */}
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                      {nomeCliente.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{nomeCliente}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-gray-400">CPF: {cpfCliente || '—'}</p>
                        {cpfCliente && (
                          <button onClick={() => copiarCpf(cpfCliente)} className="text-gray-300 hover:text-blue-500 transition-colors" title="Copiar CPF">
                            <Copy size={11} />
                          </button>
                        )}
                        {copiado && <span className="text-[10px] text-green-500">Copiado!</span>}
                      </div>
                    </div>
                  </div>
                  <a href="https://smartbuscas.net/Logar" target="_blank" rel="noopener noreferrer"
                    className="btn btn-primary btn-sm flex items-center gap-1.5">
                    <ExternalLink size={12} />SmartBuscas
                  </a>
                </div>

                {/* Passo a passo */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
                  <p className="text-xs font-medium text-blue-700 mb-2">Como consultar:</p>
                  <div className="space-y-1.5">
                    {[
                      'Clique em "SmartBuscas" — abre numa nova aba',
                      `Consulte o CPF ${cpfCliente || 'do cliente'}`,
                      'Cole o resultado no campo "Score" abaixo',
                      'Faça upload do relatório PDF',
                    ].map((passo, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-blue-600">
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-medium flex-shrink-0 mt-0.5">{i + 1}</span>
                        {passo}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="mb-3">
                  <label className="label">Status da análise</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(statusConfig).map(([key, cfg]) => {
                      const Icon = cfg.icon
                      return (
                        <button key={key} onClick={() => setStatus(key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${status === key ? cfg.cor + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          <Icon size={11} />{cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="label">Score / resultado SmartBuscas</label>
                  <input className="input" value={score} onChange={e => setScore(e.target.value)}
                    placeholder="Ex: Score 780 — Sem restrições no SPC/Serasa" />
                </div>

                <div className="mb-3">
                  <label className="label">Parecer do analista</label>
                  <textarea className="input" rows={3} value={parecer} onChange={e => setParecer(e.target.value)}
                    placeholder="Descreva o resultado da análise cadastral..." />
                </div>

                <div className="mb-4">
                  <label className="label">Observações</label>
                  <textarea className="input" rows={2} value={obsEdit} onChange={e => setObsEdit(e.target.value)} placeholder="Observações adicionais..." />
                </div>

                <button onClick={salvarAnalise} disabled={salvando} className="btn btn-primary w-full">
                  {salvando ? 'Salvando...' : 'Salvar análise'}
                </button>
              </div>

              {/* Documentos */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-1">Documentos do locatário</h3>
                <p className="text-xs text-gray-400 mb-3">Sugeridos: {DOCS_PADRAO.slice(0, 4).join(', ')} e outros.</p>

                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all mb-3">
                  <Upload size={18} className="text-gray-300 mb-1" />
                  <span className="text-xs text-gray-400">{uploadando ? 'Enviando...' : 'Clique para enviar (PDF, JPG, PNG)'}</span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocumento(f); e.target.value = '' }} />
                </label>

                {documentos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Nenhum documento anexado</p>
                ) : (
                  <div className="space-y-2">
                    {documentos.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-medium flex-shrink-0">{d.tipo}</span>
                          <span className="text-xs text-gray-700 truncate">{d.nome.replace(/^\d+_/, '')}</span>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500"><Eye size={14} /></a>
                          <button onClick={() => excluirDocumento(d.nome)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
