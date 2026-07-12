'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { resolverUrlFoto } from '@/lib/storageUrl'
import { useOrganization } from '@/lib/OrganizationContext'
import { Save, Plus, X, Camera, ChevronDown, ChevronUp } from 'lucide-react'

const AMBIENTES_PADRAO = [
  'Sala', 'Sala de estar', 'Sala de jantar', 'Cozinha',
  'Quarto 1', 'Quarto 2', 'Quarto 3', 'Quarto 4',
  'Suíte 1', 'Suíte 2', 'Suíte 3',
  'Banheiro 1', 'Banheiro 2', 'Lavabo 1', 'Lavabo 2',
  'Área de serviço', 'Lavanderia', 'Varanda', 'Garagem',
]

const ITENS_EXTRA = [
  'Pintura', 'Armários - Quarto 1', 'Armários - Quarto 2',
  'Armários - Suíte', 'Armários - Cozinha',
]

type Foto = { path: string; previewUrl: string }
type Ambiente = {
  nome: string
  estado: 'bom' | 'regular' | 'ruim' | ''
  observacao: string
  fotos: Foto[]
  aberto: boolean
}
type Imovel = { id: string; endereco: string; numero?: string; bairro?: string; cidade?: string; estado?: string }
type Vistoriador = { id: string; nome: string }

function NovaVistoriaConteudo() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { organizacao } = useOrganization()
  const editId = searchParams.get('id')
  const [carregandoEdicao, setCarregandoEdicao] = useState(!!editId)

  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [vistoriadores, setVistoriadores] = useState<Vistoriador[]>([])
  const [salvando, setSalvando] = useState(false)

  const [imovelId, setImovelId] = useState('')
  const [vistoriadorId, setVistoriadorId] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('entrada')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [obsGerais, setObsGerais] = useState('')
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [novoAmbiente, setNovoAmbiente] = useState('')

  const [locadores, setLocadores] = useState<string[]>([''])
  const [locatarios, setLocatarios] = useState<string[]>([''])
  const [testemunha1Nome, setTestemunha1Nome] = useState('')
  const [testemunha1Cpf, setTestemunha1Cpf] = useState('')
  const [testemunha2Nome, setTestemunha2Nome] = useState('')
  const [testemunha2Cpf, setTestemunha2Cpf] = useState('')

  useEffect(() => {
    if (organizacao?.id) carregarDados(organizacao.id)
  }, [organizacao?.id])

  useEffect(() => {
    if (editId && organizacao?.id) carregarVistoriaParaEdicao(editId, organizacao.id)
  }, [editId, organizacao?.id])

  async function carregarDados(orgId: string) {
    const { data: imv } = await supabase.from('imoveis').select('id, endereco, numero, bairro, cidade, estado').eq('organization_id', orgId).order('endereco')
    if (imv) setImoveis(imv)
    const { data: vist } = await supabase.from('vistoriadores').select('id, nome').eq('organization_id', orgId).eq('ativo', true).order('nome')
    if (vist) setVistoriadores(vist)
  }

  async function carregarVistoriaParaEdicao(id: string, orgId: string) {
    // Filtra também por organização: se a vistoria pertencer a outra
    // organização, "data" vem vazio e é tratada como não encontrada (o
    // formulário simplesmente não é preenchido, igual a um id inexistente).
    const { data } = await supabase.from('vistorias').select('*').eq('id', id).eq('organization_id', orgId).single()
    if (data) {
      setImovelId(data.imovel_id || '')
      setVistoriadorId(data.vistoriador_id || '')
      setTipo(data.tipo || 'entrada')
      setData(data.data_vistoria || new Date().toISOString().split('T')[0])
      setObsGerais(data.observacoes_gerais || '')
      setLocadores(data.locadores?.length ? data.locadores : [''])
      setLocatarios(data.locatarios?.length ? data.locatarios : [''])
      setTestemunha1Nome(data.testemunha1_nome || '')
      setTestemunha1Cpf(data.testemunha1_cpf || '')
      setTestemunha2Nome(data.testemunha2_nome || '')
      setTestemunha2Cpf(data.testemunha2_cpf || '')
      const ambientesCarregados = (data.ambientes || []).map((a: any) => ({
        nome: a.nome,
        estado: a.estado || '',
        observacao: a.observacao || '',
        fotos: (a.fotos || []).map((path: string) => ({ path, previewUrl: path.startsWith('http') ? path : '' })),
        aberto: false,
      }))
      setAmbientes(ambientesCarregados)

      // Fotos guardadas como caminho (não URL legada) precisam da URL
      // assinada resolvida à parte pra pré-visualização.
      ambientesCarregados.forEach((amb: any, ai: number) => {
        amb.fotos.forEach((f: Foto, fi: number) => {
          if (f.previewUrl) return
          resolverUrlFoto(f.path).then(url => {
            setAmbientes(prev => prev.map((a, i) => i === ai
              ? { ...a, fotos: a.fotos.map((ff, ffi) => ffi === fi ? { ...ff, previewUrl: url } : ff) }
              : a))
          })
        })
      })
    }
    setCarregandoEdicao(false)
  }

  async function aoSelecionarImovel(id: string) {
    setImovelId(id)
    if (!id || editId || !organizacao?.id) return
    const { data: contrato } = await supabase
      .from('contratos')
      .select('locador_id, locatario_id, locador:clientes!locador_id(nome), locatario:clientes!locatario_id(nome)')
      .eq('imovel_id', id)
      .eq('organization_id', organizacao.id)
      .eq('status', 'ativo')
      .single()
    if (contrato) {
      const locadorNome = (contrato.locador as any)?.nome || ''
      const locatarioNome = (contrato.locatario as any)?.nome || ''
      if (locadorNome) setLocadores([locadorNome])
      if (locatarioNome) setLocatarios([locatarioNome])
    }
  }

  function adicionarAmbientePadrao(nome: string) {
    if (ambientes.find(a => a.nome === nome)) {
      setAmbientes(prev => prev.filter(a => a.nome !== nome))
      return
    }
    setAmbientes(prev => [...prev, { nome, estado: '', observacao: '', fotos: [], aberto: true }])
  }

  function adicionarAmbienteCustom() {
    if (!novoAmbiente.trim()) return
    if (ambientes.find(a => a.nome === novoAmbiente.trim())) return
    setAmbientes(prev => [...prev, { nome: novoAmbiente.trim(), estado: '', observacao: '', fotos: [], aberto: true }])
    setNovoAmbiente('')
  }

  function removerAmbiente(idx: number) {
    setAmbientes(prev => prev.filter((_, i) => i !== idx))
  }

  function toggleAmbiente(idx: number) {
    setAmbientes(prev => prev.map((a, i) => i === idx ? { ...a, aberto: !a.aberto } : a))
  }

  function setEstado(idx: number, estado: 'bom' | 'regular' | 'ruim') {
    setAmbientes(prev => prev.map((a, i) => i === idx ? { ...a, estado } : a))
  }

  function setObservacao(idx: number, observacao: string) {
    setAmbientes(prev => prev.map((a, i) => i === idx ? { ...a, observacao } : a))
  }

  async function adicionarFoto(idx: number, file: File) {
    if (ambientes[idx].fotos.length >= 5) return
    if (!organizacao?.id) return
    const ext = file.name.split('.').pop()
    const path = `vistorias/${organizacao.id}/${Date.now()}.${ext}`
    const { data: up } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (up) {
      setAmbientes(prev => prev.map((a, i) => i === idx ? { ...a, fotos: [...a.fotos, { path, previewUrl: URL.createObjectURL(file) }] } : a))
    }
  }

  function removerFoto(ambIdx: number, fotoIdx: number) {
    setAmbientes(prev => prev.map((a, i) => i === ambIdx ? { ...a, fotos: a.fotos.filter((_, fi) => fi !== fotoIdx) } : a))
  }

  async function salvar(status: string) {
    if (!imovelId) { alert('Selecione um imóvel'); return }
    if (!data) { alert('Informe a data'); return }
    if (!organizacao?.id) { alert('Organização não carregada. Recarregue a página.'); return }
    setSalvando(true)

    const payload = {
      organization_id: organizacao.id,
      imovel_id: imovelId,
      vistoriador_id: vistoriadorId || null,
      tipo,
      data_vistoria: data,
      status,
      observacoes_gerais: obsGerais,
      ambientes: ambientes.map(a => ({
        nome: a.nome,
        estado: a.estado,
        observacao: a.observacao,
        fotos: a.fotos.map(f => f.path),
      })),
      locadores: locadores.filter(l => l.trim()),
      locatarios: locatarios.filter(l => l.trim()),
      testemunha1_nome: testemunha1Nome,
      testemunha1_cpf: testemunha1Cpf,
      testemunha2_nome: testemunha2Nome,
      testemunha2_cpf: testemunha2Cpf,
    }

    if (editId) {
      const { error } = await supabase.from('vistorias').update(payload).eq('id', editId)
      setSalvando(false)
      if (error) { alert('Erro: ' + error.message); return }
      router.push(`/vistorias/${editId}`)
    } else {
      const { data: saved, error } = await supabase.from('vistorias').insert([payload]).select().single()
      setSalvando(false)
      if (error) { alert('Erro: ' + error.message); return }
      router.push(`/vistorias/${saved.id}`)
    }
  }

  const estadoCor = (e: string) => e === 'bom' ? { background: '#3fb950', color: '#fff' } : e === 'regular' ? { background: '#f59e0b', color: '#fff' } : e === 'ruim' ? { background: '#ef4444', color: '#fff' } : { background: '#1f2430', color: '#8b8d98' }

  if (carregandoEdicao) {
    return (
      <AppLayout>
        <div style={{ background: '#0d1117', minHeight: '100vh', color: '#8b8d98' }} className="flex-1 p-6">
          Carregando vistoria...
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">{editId ? 'Editar Vistoria' : 'Nova Vistoria'}</h1>

          <div className="card">
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Dados gerais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Imóvel *</label>
                <select className="input" value={imovelId} onChange={e => aoSelecionarImovel(e.target.value)}>
                  <option value="">Selecione o imóvel</option>
                  {imoveis.map(im => (
                    <option key={im.id} value={im.id}>{im.endereco}, {im.numero} — {im.bairro}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tipo de vistoria</label>
                <div className="flex gap-2">
                  {(['entrada', 'saida'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setTipo(t)}
                      style={tipo === t ? (t === 'entrada' ? { background: '#3fb950', color: '#fff', border: '0.5px solid #3fb950' } : { background: '#f59e0b', color: '#fff', border: '0.5px solid #f59e0b' }) : { background: '#161b22', color: '#a8aab5', border: '0.5px solid #2a2f3a' }}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all">
                      {t === 'entrada' ? '↓ Entrada' : '↑ Saída'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Data da vistoria</label>
                <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="label">Vistoriador</label>
                <select className="input" value={vistoriadorId} onChange={e => setVistoriadorId(e.target.value)}>
                  <option value="">Selecione o vistoriador</option>
                  {vistoriadores.map(v => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Observações gerais</label>
                <textarea className="input" rows={2} value={obsGerais} onChange={e => setObsGerais(e.target.value)} placeholder="Observações gerais da vistoria..." />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Partes</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Locador(es)</label>
                {locadores.map((l, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input className="input flex-1" value={l} placeholder="Nome completo do locador"
                      onChange={e => setLocadores(prev => prev.map((v, vi) => vi === i ? e.target.value : v))} />
                    {locadores.length > 1 && (
                      <button type="button" onClick={() => setLocadores(prev => prev.filter((_, vi) => vi !== i))}
                        style={{ color: '#5b5e6b' }} className="hover:text-red-400"><X size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setLocadores(prev => [...prev, ''])}
                  style={{ color: '#5b9bf5' }} className="text-xs hover:underline flex items-center gap-1">
                  <Plus size={11} />Adicionar locador
                </button>
              </div>

              <div>
                <label className="label">Locatário(s)</label>
                {locatarios.map((l, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input className="input flex-1" value={l} placeholder="Nome completo do locatário"
                      onChange={e => setLocatarios(prev => prev.map((v, vi) => vi === i ? e.target.value : v))} />
                    {locatarios.length > 1 && (
                      <button type="button" onClick={() => setLocatarios(prev => prev.filter((_, vi) => vi !== i))}
                        style={{ color: '#5b5e6b' }} className="hover:text-red-400"><X size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setLocatarios(prev => [...prev, ''])}
                  style={{ color: '#5b9bf5' }} className="text-xs hover:underline flex items-center gap-1">
                  <Plus size={11} />Adicionar locatário
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Testemunha 1 — Nome</label>
                  <input className="input" value={testemunha1Nome} onChange={e => setTestemunha1Nome(e.target.value)} />
                </div>
                <div>
                  <label className="label">Testemunha 1 — CPF</label>
                  <input className="input" value={testemunha1Cpf} onChange={e => setTestemunha1Cpf(e.target.value)} />
                </div>
                <div>
                  <label className="label">Testemunha 2 — Nome</label>
                  <input className="input" value={testemunha2Nome} onChange={e => setTestemunha2Nome(e.target.value)} />
                </div>
                <div>
                  <label className="label">Testemunha 2 — CPF</label>
                  <input className="input" value={testemunha2Cpf} onChange={e => setTestemunha2Cpf(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-3">Ambientes</h3>
            <div className="mb-3">
              <p style={{ color: '#8b8d98' }} className="text-xs mb-2">Clique para adicionar ou remover</p>
              <div className="flex flex-wrap gap-2">
                {[...AMBIENTES_PADRAO, ...ITENS_EXTRA].map(nome => {
                  const selecionado = !!ambientes.find(a => a.nome === nome)
                  return (
                    <button key={nome} type="button"
                      onClick={() => adicionarAmbientePadrao(nome)}
                      style={selecionado ? { background: '#16243a', border: '0.5px solid #2563eb', color: '#5b9bf5' } : { background: '#161b22', border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                      className="px-2.5 py-1 rounded-lg text-xs transition-all">
                      {selecionado ? '✓ ' : '+ '}{nome}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Outro ambiente..." value={novoAmbiente}
                onChange={e => setNovoAmbiente(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarAmbienteCustom()} />
              <button type="button" className="btn btn-primary btn-sm" onClick={adicionarAmbienteCustom}>
                <Plus size={13} />Adicionar
              </button>
            </div>
          </div>

          {ambientes.map((amb, idx) => (
            <div key={idx} className="card p-0 overflow-hidden">
              <div style={{ background: '#161b22', borderBottom: '0.5px solid #2a2f3a' }} className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => toggleAmbiente(idx)}>
                <div className="flex items-center gap-3">
                  <span style={{ color: '#f4f4f3' }} className="text-sm font-medium">{amb.nome}</span>
                  {amb.estado && (
                    <span style={estadoCor(amb.estado)} className="text-[10px] px-2 py-0.5 rounded-full font-medium">
                      {amb.estado.charAt(0).toUpperCase() + amb.estado.slice(1)}
                    </span>
                  )}
                  {amb.fotos.length > 0 && (
                    <span style={{ color: '#8b8d98' }} className="text-[10px]">{amb.fotos.length} foto{amb.fotos.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={e => { e.stopPropagation(); removerAmbiente(idx) }}
                    style={{ color: '#5b5e6b' }} className="hover:text-red-400 transition-colors">
                    <X size={13} />
                  </button>
                  {amb.aberto ? <ChevronUp size={14} style={{ color: '#8b8d98' }} /> : <ChevronDown size={14} style={{ color: '#8b8d98' }} />}
                </div>
              </div>

              {amb.aberto && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="label">Estado de conservação</label>
                    <div className="flex gap-2">
                      {(['bom', 'regular', 'ruim'] as const).map(e => (
                        <button key={e} type="button" onClick={() => setEstado(idx, e)}
                          style={amb.estado === e ? estadoCor(e) : { background: '#161b22', color: '#a8aab5', border: '0.5px solid #2a2f3a' }}
                          className="flex-1 py-2 rounded-lg text-sm font-medium transition-all">
                          {e.charAt(0).toUpperCase() + e.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">Observações</label>
                    <textarea className="input" rows={3} value={amb.observacao}
                      onChange={e => setObservacao(idx, e.target.value)}
                      placeholder="Ex: Porta de madeira em bom estado.&#10;Piso em bom estado.&#10;Parede em bom estado." />
                  </div>
                  <div>
                    <label className="label">Fotos ({amb.fotos.length}/5)</label>
                    <div className="flex gap-2 flex-wrap">
                      {amb.fotos.map((foto, fi) => (
                        <div key={fi} style={{ border: '0.5px solid #2a2f3a', height: '80px' }} className="relative w-24 rounded-lg overflow-hidden">
                          <img src={foto.previewUrl} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removerFoto(idx, fi)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {amb.fotos.length < 5 && (
                        <label style={{ border: '1.5px dashed #2a2f3a', width: '96px', height: '80px' }} className="rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-all">
                          <Camera size={16} style={{ color: '#5b5e6b' }} />
                          <span style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">Foto</span>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) adicionarFoto(idx, f); e.target.value = '' }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3 pb-6">
            <button type="button" disabled={salvando} onClick={() => salvar('rascunho')}
              className="btn">
              {salvando ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button type="button" disabled={salvando} onClick={() => salvar('concluida')}
              className="btn btn-primary">
              <Save size={14} />{salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Concluir vistoria'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default function NovaVistoriaPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div style={{ background: '#0d1117', minHeight: '100vh', color: '#8b8d98' }} className="flex-1 p-6">
          Carregando...
        </div>
      </AppLayout>
    }>
      <NovaVistoriaConteudo />
    </Suspense>
  )
}
