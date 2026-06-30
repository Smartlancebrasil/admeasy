'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Plus, X, Upload, Trash2, ExternalLink, CheckCircle, XCircle, Clock, Search, FileText, Eye } from 'lucide-react'

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
  cliente?: Cliente
  contrato?: Contrato
}

const statusConfig: Record<string, { label: string; badge: string; icon: any }> = {
  pendente: { label: 'Pendente', badge: 'badge-yellow', icon: Clock },
  em_analise: { label: 'Em análise', badge: 'badge-blue', icon: Search },
  aprovado: { label: 'Aprovado', badge: 'badge-green', icon: CheckCircle },
  reprovado: { label: 'Reprovado', badge: 'badge-red', icon: XCircle },
}

const DOCS_PADRAO = [
  'RG (frente e verso)',
  'CPF',
  'Comprovante de renda',
  'Holerite',
  'Extrato bancário 3 meses',
  'Comprovante de endereço',
  'Declaração IR',
  'CTPS',
  'Contrato social (PJ)',
]

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

  // Form nova análise
  const [clienteId, setClienteId] = useState('')
  const [contratoId, setContratoId] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Form edição
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
    } else {
      setDocumentos([])
    }
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
    setShowNova(false)
    setClienteId('')
    setContratoId('')
    setObservacoes('')
    setSucesso('Análise criada!')
    setTimeout(() => setSucesso(''), 3000)
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
    setSucesso('Análise salva!')
    setTimeout(() => setSucesso(''), 3000)
    carregar()
    setAnaliseAberta(prev => prev ? { ...prev, status: status as any, parecer, score_smartbuscas: score, observacoes: obsEdit } : null)
  }

  async function uploadDocumento(file: File) {
    if (!analiseAberta) return
    setUploadando(true)
    const path = `analises/${analiseAberta.id}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (!error) {
      setSucesso('Documento enviado!')
      setTimeout(() => setSucesso(''), 3000)
      carregarDocumentos(analiseAberta.id)
    }
    setUploadando(false)
  }

  async function excluirDocumento(nome: string) {
    if (!analiseAberta || !confirm('Excluir documento?')) return
    await supabase.storage.from('documentos').remove([`analises/${analiseAberta.id}/${nome}`])
    carregarDocumentos(analiseAberta.id)
  }

  async function excluirAnalise(id: string) {
    if (!confirm('Excluir esta análise cadastral?')) return
    await supabase.from('analises_cadastrais').delete().eq('id', id)
    if (analiseAberta?.id === id) setAnaliseAberta(null)
    carregar()
  }

  function getNome(val: any) {
    if (!val) return '—'
    if (Array.isArray(val)) return val[0]?.nome || '—'
    return val.nome || '—'
  }

  function getTitulo(val: any) {
    if (!val) return '—'
    if (Array.isArray(val)) return val[0]?.titulo || '—'
    return val.titulo || '—'
  }

  function getCpf(val: any) {
    if (!val) return ''
    if (Array.isArray(val)) return val[0]?.cpf || ''
    return val.cpf || ''
  }

  function abrirSmartBuscas(cpf?: string) {
    window.open('https://smartbuscas.net/Logar', '_blank')
  }

  const clienteSel = clientes.find(c => c.id === clienteId)

  return (
    <AppLayout>
      <Topbar titulo="Análise Cadastral" />
      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm flex justify-between">
            {sucesso}<button onClick={() => setSucesso('')}><X size={14} /></button>
          </div>
        )}

        <div className="flex items-center justify-between mb-5">
          <div />
          <button onClick={() => setShowNova(true)} className="btn btn-primary">
            <Plus size={14} />Nova análise
          </button>
        </div>

        {/* Form nova análise */}
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
                  {contratos.map(c => <option key={c.id} value={c.id}>#{c.numero} — {getTitulo(c.imovel)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Observações iniciais</label>
                <textarea className="input" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações relevantes sobre a análise..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={criarAnalise} disabled={salvando} className="btn btn-primary">
                {salvando ? 'Criando...' : 'Criar análise'}
              </button>
              <button onClick={() => setShowNova(false)} className="btn">Cancelar</button>
            </div>
          </div>
        )}

        {/* Layout dois painéis */}
        <div className="grid grid-cols-2 gap-5">
          {/* Lista de análises */}
          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
            ) : analises.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium text-gray-500">Nenhuma análise cadastrada</p>
              </div>
            ) : (
              <div>
                {analises.map(a => {
                  const cfg = statusConfig[a.status]
                  const Icon = cfg.icon
                  const ativo = analiseAberta?.id === a.id
                  return (
                    <div key={a.id}
                      onClick={() => abrirAnalise(a)}
                      className={`p-4 border-b border-gray-100 cursor-pointer transition-all hover:bg-gray-50 ${ativo ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{getNome(a.cliente)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{getCpf(a.cliente)}</p>
                          {a.contrato && <p className="text-xs text-gray-400">#{Array.isArray(a.contrato) ? a.contrato[0]?.numero : (a.contrato as any)?.numero}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`badge ${cfg.badge} flex items-center gap-1`}>
                            <Icon size={10} />{cfg.label}
                          </span>
                          <button onClick={e => { e.stopPropagation(); excluirAnalise(a.id) }}
                            className="text-gray-200 hover:text-red-400 transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-300 mt-1">
                        {new Date(a.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Painel de detalhes */}
          {!analiseAberta ? (
            <div className="card text-center py-16 text-gray-400">
              <Search size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">Selecione uma análise</p>
              <p className="text-sm mt-1">para ver detalhes e documentos</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cabeçalho */}
              <div className="card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">{getNome(analiseAberta.cliente)}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">CPF: {getCpf(analiseAberta.cliente) || '—'}</p>
                    {analiseAberta.contrato && (
                      <p className="text-xs text-gray-400">
                        Contrato #{Array.isArray(analiseAberta.contrato) ? analiseAberta.contrato[0]?.numero : (analiseAberta.contrato as any)?.numero}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => abrirSmartBuscas(getCpf(analiseAberta.cliente))}
                    className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 border-blue-600 flex items-center gap-1.5">
                    <ExternalLink size={12} />SmartBuscas
                  </button>
                </div>

                {/* Status */}
                <div className="space-y-3">
                  <div>
                    <label className="label">Status da análise</label>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(statusConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon
                        return (
                          <button key={key} onClick={() => setStatus(key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${status === key ? key === 'aprovado' ? 'bg-green-500 text-white border-green-500' : key === 'reprovado' ? 'bg-red-500 text-white border-red-500' : key === 'em_analise' ? 'bg-blue-500 text-white border-blue-500' : 'bg-yellow-500 text-white border-yellow-500' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                            <Icon size={11} />{cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="label">Score / Resultado SmartBuscas</label>
                    <input className="input" value={score} onChange={e => setScore(e.target.value)}
                      placeholder="Ex: Score 750 — Sem restrições" />
                  </div>

                  <div>
                    <label className="label">Parecer do analista</label>
                    <textarea className="input" rows={3} value={parecer} onChange={e => setParecer(e.target.value)}
                      placeholder="Descreva o parecer da análise cadastral..." />
                  </div>

                  <div>
                    <label className="label">Observações</label>
                    <textarea className="input" rows={2} value={obsEdit} onChange={e => setObsEdit(e.target.value)}
                      placeholder="Observações adicionais..." />
                  </div>

                  <button onClick={salvarAnalise} disabled={salvando} className="btn btn-primary w-full">
                    {salvando ? 'Salvando...' : 'Salvar análise'}
                  </button>
                </div>
              </div>

              {/* Documentos */}
              <div className="card">
                <h3 className="text-sm font-semibold mb-3">Documentos do locatário</h3>
                <p className="text-xs text-gray-400 mb-3">Documentos sugeridos: {DOCS_PADRAO.join(', ')}</p>

                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all mb-3">
                  <Upload size={18} className="text-gray-300 mb-1" />
                  <span className="text-xs text-gray-400">
                    {uploadando ? 'Enviando...' : 'Clique para enviar documento'}
                  </span>
                  <input type="file" className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocumento(f); e.target.value = '' }} />
                </label>

                {documentos.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Nenhum documento anexado</p>
                ) : (
                  <div className="space-y-2">
                    {documentos.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-medium flex-shrink-0">{d.tipo}</span>
                          <span className="text-xs text-gray-700 truncate">{d.nome.replace(/^\d+_/, '')}</span>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <a href={d.url} target="_blank" rel="noopener noreferrer"
                            className="btn btn-sm text-xs"><Eye size={11} /></a>
                          <button onClick={() => excluirDocumento(d.nome)}
                            className="btn btn-sm text-red-400 hover:text-red-600"><Trash2 size={11} /></button>
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
