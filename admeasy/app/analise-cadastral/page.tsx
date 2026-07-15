'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import { Plus, X, Upload, Trash2, ExternalLink, CheckCircle, XCircle, Clock, Search, FileText, Eye, Copy } from 'lucide-react'
import { resolverUrlExibicao } from '@/lib/documentosSignedUrl'
import { uploadDocumentoAdministrativo, excluirDocumentoAdministrativo } from '@/lib/documentosAdmin'

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

const statusConfig: Record<string, { label: string; badge: string; icon: any; bg: string; border: string; color: string }> = {
  pendente:   { label: 'Pendente',    badge: 'badge-yellow', icon: Clock,       bg: '#2e2515', border: '#4a3a1f', color: '#f59e0b' },
  em_analise: { label: 'Em análise',  badge: 'badge-blue',   icon: Search,      bg: '#16243a', border: '#1e3a5f', color: '#5b9bf5' },
  aprovado:   { label: 'Aprovado',    badge: 'badge-green',  icon: CheckCircle, bg: '#1a2e1f', border: '#2d4a35', color: '#3fb950' },
  reprovado:  { label: 'Reprovado',   badge: 'badge-red',    icon: XCircle,     bg: '#2e1717', border: '#4a2424', color: '#ef4444' },
}

const DOCS_PADRAO = ['RG (frente e verso)', 'CPF', 'Comprovante de renda', 'Holerite', 'Extrato bancário 3 meses', 'Comprovante de endereço', 'Declaração IR', 'CTPS', 'Contrato social (PJ)']

export default function AnaliseCadastralPage() {
  const { organizacao } = useOrganization()
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

  useEffect(() => {
    if (organizacao?.id) carregar(organizacao.id)
  }, [organizacao?.id])

  async function carregar(orgId: string) {
    setLoading(true)
    const [an, cl, co] = await Promise.all([
      supabase.from('analises_cadastrais')
        .select('*, cliente:clientes(id, nome, cpf, telefone, email), contrato:contratos(id, numero, imovel:imoveis(titulo))')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false }),
      supabase.from('clientes').select('id, nome, cpf, telefone, email').eq('organization_id', orgId).order('nome'),
      supabase.from('contratos').select('id, numero, imovel:imoveis(titulo)').eq('organization_id', orgId).order('numero'),
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
      setDocumentos(await Promise.all(data.map(async f => {
        const path = `analises/${analiseId}/${f.name}`
        return {
          nome: f.name,
          url: (await resolverUrlExibicao(path)) || '',
          tipo: f.name.split('.').pop() || '',
        }
      })))
    } else setDocumentos([])
  }

  async function criarAnalise() {
    if (!organizacao?.id) return
    if (!clienteId) { alert('Selecione um cliente'); return }
    setSalvando(true)
    const { error } = await supabase.from('analises_cadastrais').insert([{
      organization_id: organizacao.id,
      cliente_id: clienteId,
      contrato_id: contratoId || null,
      observacoes: observacoes || null,
      status: 'pendente',
    }])
    setSalvando(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowNova(false); setClienteId(''); setContratoId(''); setObservacoes('')
    setSucesso('Análise criada!'); setTimeout(() => setSucesso(''), 3000)
    carregar(organizacao.id)
  }

  async function salvarAnalise() {
    if (!analiseAberta || !organizacao?.id) return
    setSalvando(true)
    await supabase.from('analises_cadastrais').update({
      status, parecer: parecer || null,
      score_smartbuscas: score || null,
      observacoes: obsEdit || null,
      updated_at: new Date().toISOString(),
    }).eq('id', analiseAberta.id).eq('organization_id', organizacao.id)
    setSalvando(false)
    setSucesso('Análise salva!'); setTimeout(() => setSucesso(''), 3000)
    carregar(organizacao.id)
    setAnaliseAberta(prev => prev ? { ...prev, status: status as any, parecer, score_smartbuscas: score, observacoes: obsEdit } : null)
  }

  async function uploadDocumento(file: File) {
    if (!analiseAberta) return
    setUploadando(true)
    const resultado = await uploadDocumentoAdministrativo({ file, prefixo: 'analises', analiseId: analiseAberta.id })
    if ('erro' in resultado) {
      alert('Erro ao enviar: ' + resultado.erro)
    } else {
      setSucesso('Documento enviado!'); setTimeout(() => setSucesso(''), 3000); carregarDocumentos(analiseAberta.id)
    }
    setUploadando(false)
  }

  async function excluirDocumento(nome: string) {
    if (!analiseAberta || !confirm('Excluir documento?')) return
    const resultado = await excluirDocumentoAdministrativo(`analises/${analiseAberta.id}/${nome}`)
    if ('erro' in resultado) alert('Erro ao excluir: ' + resultado.erro)
    carregarDocumentos(analiseAberta.id)
  }

  async function excluirAnalise(id: string) {
    if (!organizacao?.id) return
    if (!confirm('Excluir esta análise?')) return
    await supabase.from('analises_cadastrais').delete().eq('id', id).eq('organization_id', organizacao.id)
    if (analiseAberta?.id === id) setAnaliseAberta(null)
    carregar(organizacao.id)
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
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-[1600px] mx-auto">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Análise Cadastral</h1>

          {sucesso && (
            <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm flex justify-between">
              {sucesso}<button onClick={() => setSucesso('')}><X size={14} /></button>
            </div>
          )}

          <div className="flex justify-end mb-5">
            <button onClick={() => setShowNova(true)} className="btn btn-primary"><Plus size={14} />Nova análise</button>
          </div>

          {showNova && (
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">Nova análise cadastral</h3>
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
            <div className="card p-0 overflow-hidden">
              {loading ? (
                <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
              ) : analises.length === 0 ? (
                <div style={{ color: '#8b8d98' }} className="text-center py-12">
                  <FileText size={36} className="mx-auto mb-2 opacity-30" />
                  <p style={{ color: '#c3c2b7' }} className="font-medium">Nenhuma análise cadastrada</p>
                </div>
              ) : analises.map(a => {
                const cfg = statusConfig[a.status]
                const Icon = cfg.icon
                const ativo = analiseAberta?.id === a.id
                return (
                  <div key={a.id} onClick={() => abrirAnalise(a)}
                    style={{ borderBottom: '0.5px solid #1c2128', ...(ativo ? { background: '#16243a', borderLeft: '4px solid #2563eb' } : {}) }}
                    className="p-4 cursor-pointer transition-all hover:bg-[#161b22]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p style={{ color: '#f4f4f3' }} className="text-sm font-medium">{getVal(a.cliente, 'nome')}</p>
                        <p style={{ color: '#8b8d98' }} className="text-xs mt-0.5">CPF: {getVal(a.cliente, 'cpf') || '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${cfg.badge} flex items-center gap-1`}><Icon size={10} />{cfg.label}</span>
                        <button onClick={e => { e.stopPropagation(); excluirAnalise(a.id) }} style={{ color: '#5b5e6b' }} className="hover:text-red-400"><X size={13} /></button>
                      </div>
                    </div>
                    <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">{new Date(a.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                )
              })}
            </div>

            {!analiseAberta ? (
              <div className="card text-center py-16" style={{ color: '#8b8d98' }}>
                <Search size={36} className="mx-auto mb-3 opacity-30" />
                <p style={{ color: '#c3c2b7' }} className="font-medium">Selecione uma análise</p>
              </div>
            ) : (
              <div className="space-y-4">

                <div className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div style={{ background: '#16243a', color: '#5b9bf5' }} className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium">
                        {nomeCliente.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{nomeCliente}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p style={{ color: '#8b8d98' }} className="text-xs">CPF: {cpfCliente || '—'}</p>
                          {cpfCliente && (
                            <button onClick={() => copiarCpf(cpfCliente)} style={{ color: '#5b5e6b' }} className="hover:text-blue-400 transition-colors" title="Copiar CPF">
                              <Copy size={11} />
                            </button>
                          )}
                          {copiado && <span style={{ color: '#3fb950' }} className="text-[10px]">Copiado!</span>}
                        </div>
                      </div>
                    </div>
                    <a href="https://smartbuscas.net/Logar" target="_blank" rel="noopener noreferrer"
                      className="btn btn-primary btn-sm flex items-center gap-1.5">
                      <ExternalLink size={12} />SmartBuscas
                    </a>
                  </div>

                  <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3 mb-4">
                    <p style={{ color: '#5b9bf5' }} className="text-xs font-medium mb-2">Como consultar:</p>
                    <div className="space-y-1.5">
                      {[
                        'Clique em "SmartBuscas" — abre numa nova aba',
                        `Consulte o CPF ${cpfCliente || 'do cliente'}`,
                        'Cole o resultado no campo "Score" abaixo',
                        'Faça upload do relatório PDF',
                      ].map((passo, i) => (
                        <div key={i} style={{ color: '#7daee8' }} className="flex items-start gap-2 text-xs">
                          <span style={{ background: '#2563eb' }} className="w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] font-medium flex-shrink-0 mt-0.5">{i + 1}</span>
                          {passo}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="label">Status da análise</label>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(statusConfig).map(([key, cfg]) => {
                        const Icon = cfg.icon
                        return (
                          <button key={key} onClick={() => setStatus(key)}
                            style={status === key ? { background: cfg.bg, border: `0.5px solid ${cfg.border}`, color: cfg.color } : { border: '0.5px solid #2a2f3a', color: '#8b8d98' }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
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

                <div className="card">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-1">Documentos do locatário</h3>
                  <p style={{ color: '#8b8d98' }} className="text-xs mb-3">Sugeridos: {DOCS_PADRAO.slice(0, 4).join(', ')} e outros.</p>

                  <label style={{ border: '1.5px dashed #2a2f3a' }} className="flex flex-col items-center justify-center w-full h-20 rounded-lg cursor-pointer hover:border-blue-400 transition-all mb-3">
                    <Upload size={18} style={{ color: '#5b5e6b' }} className="mb-1" />
                    <span style={{ color: '#8b8d98' }} className="text-xs">{uploadando ? 'Enviando...' : 'Clique para enviar (PDF, JPG, PNG)'}</span>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocumento(f); e.target.value = '' }} />
                  </label>

                  {documentos.length === 0 ? (
                    <p style={{ color: '#8b8d98' }} className="text-xs text-center py-3">Nenhum documento anexado</p>
                  ) : (
                    <div className="space-y-2">
                      {documentos.map((d, i) => (
                        <div key={i} style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="flex items-center justify-between p-2 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <span style={{ background: '#16243a', color: '#5b9bf5' }} className="text-[10px] px-1.5 py-0.5 rounded uppercase font-medium flex-shrink-0">{d.tipo}</span>
                            <span style={{ color: '#c3c2b7' }} className="text-xs truncate">{d.nome.replace(/^\d+_/, '')}</span>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: '#8b8d98' }} className="hover:text-blue-400"><Eye size={14} /></a>
                            <button onClick={() => excluirDocumento(d.nome)} style={{ color: '#5b5e6b' }} className="hover:text-red-400"><Trash2 size={14} /></button>
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
      </div>
    </AppLayout>
  )
}
