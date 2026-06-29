'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Save, Plus, X, Camera, ChevronDown, ChevronUp } from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

const AMBIENTES_PADRAO = [
  'Sala de estar',
  'Sala de jantar',
  'Cozinha',
  'Quarto 1',
  'Quarto 2',
  'Quarto 3',
  'Suíte 1',
  'Suíte 2',
  'Banheiro 1',
  'Banheiro 2',
  'Lavabo',
  'Área de serviço',
  'Lavanderia',
  'Varanda',
  'Garagem',
]

const ITENS_EXTRA = [
  'Pintura',
  'Armários - Quarto 1',
  'Armários - Quarto 2',
  'Armários - Suíte',
  'Armários - Cozinha',
]

type Foto = { url: string; file?: File }
type Ambiente = {
  nome: string
  estado: 'bom' | 'regular' | 'ruim' | ''
  observacao: string
  fotos: Foto[]
  aberto: boolean
}

type Imovel = { id: string; endereco: string; numero?: string; bairro?: string; cidade?: string }
type Vistoriador = { id: string; nome: string }

export default function NovaVistoriaPage() {
  const router = useRouter()
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

  useEffect(() => {
    carregarDados()
  }, [])

  async function carregarDados() {
    const { data: imv } = await supabase.from('imoveis').select('id, endereco, numero, bairro, cidade').eq('organization_id', ORG_ID).order('endereco')
    if (imv) setImoveis(imv)
    const { data: vist } = await supabase.from('vistoriadores').select('id, nome').eq('organization_id', ORG_ID).eq('ativo', true).order('nome')
    if (vist) setVistoriadores(vist)
  }

  function adicionarAmbientePadrao(nome: string) {
    if (ambientes.find(a => a.nome === nome)) return
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
    const ext = file.name.split('.').pop()
    const path = `vistorias/${ORG_ID}/${Date.now()}.${ext}`
    const { data: up } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (up) {
      const { data: url } = supabase.storage.from('documentos').getPublicUrl(path)
      setAmbientes(prev => prev.map((a, i) => i === idx ? { ...a, fotos: [...a.fotos, { url: url.publicUrl }] } : a))
    }
  }

  function removerFoto(ambIdx: number, fotoIdx: number) {
    setAmbientes(prev => prev.map((a, i) => i === ambIdx ? { ...a, fotos: a.fotos.filter((_, fi) => fi !== fotoIdx) } : a))
  }

  async function salvar(status: 'rascunho' | 'concluida') {
    if (!imovelId) { alert('Selecione um imóvel'); return }
    if (!data) { alert('Informe a data'); return }
    setSalvando(true)

    const payload = {
      organization_id: ORG_ID,
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
        fotos: a.fotos.map(f => f.url),
      })),
    }

    const { data: saved, error } = await supabase.from('vistorias').insert([payload]).select().single()
    setSalvando(false)
    if (error) { alert('Erro: ' + error.message); return }
    router.push(`/vistorias/${saved.id}`)
  }

  const estadoCor = (e: string) => e === 'bom' ? 'bg-green-500 text-white' : e === 'regular' ? 'bg-yellow-500 text-white' : e === 'ruim' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'

  return (
    <AppLayout>
      <Topbar titulo="Nova Vistoria" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Dados gerais */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4">Dados gerais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Imóvel *</label>
                <select className="input" value={imovelId} onChange={e => setImovelId(e.target.value)}>
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
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${tipo === t ? t === 'entrada' ? 'bg-green-500 text-white border-green-500' : 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
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

          {/* Seleção de ambientes */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Ambientes</h3>
            <div className="mb-3">
              <p className="text-xs text-gray-400 mb-2">Ambientes padrão</p>
              <div className="flex flex-wrap gap-2">
                {[...AMBIENTES_PADRAO, ...ITENS_EXTRA].map(nome => (
                  <button key={nome} type="button"
                    onClick={() => adicionarAmbientePadrao(nome)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${ambientes.find(a => a.nome === nome) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                    {ambientes.find(a => a.nome === nome) ? '✓ ' : '+ '}{nome}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Outro ambiente..." value={novoAmbiente} onChange={e => setNovoAmbiente(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarAmbienteCustom()} />
              <button type="button" className="btn btn-primary btn-sm" onClick={adicionarAmbienteCustom}>
                <Plus size={13} />Adicionar
              </button>
            </div>
          </div>

          {/* Ambientes selecionados */}
          {ambientes.map((amb, idx) => (
            <div key={idx} className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={() => toggleAmbiente(idx)}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{amb.nome}</span>
                  {amb.estado && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${estadoCor(amb.estado)}`}>
                      {amb.estado.charAt(0).toUpperCase() + amb.estado.slice(1)}
                    </span>
                  )}
                  {amb.fotos.length > 0 && (
                    <span className="text-[10px] text-gray-400">{amb.fotos.length} foto{amb.fotos.length > 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={e => { e.stopPropagation(); removerAmbiente(idx) }}
                    className="text-gray-300 hover:text-red-500 transition-colors">
                    <X size={13} />
                  </button>
                  {amb.aberto ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </div>

              {amb.aberto && (
                <div className="p-4 space-y-4">
                  {/* Estado */}
                  <div>
                    <label className="label">Estado de conservação</label>
                    <div className="flex gap-2">
                      {(['bom', 'regular', 'ruim'] as const).map(e => (
                        <button key={e} type="button" onClick={() => setEstado(idx, e)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${amb.estado === e ? estadoCor(e) : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                          {e.charAt(0).toUpperCase() + e.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <label className="label">Observações</label>
                    <textarea className="input" rows={2} value={amb.observacao}
                      onChange={e => setObservacao(idx, e.target.value)}
                      placeholder="Descreva o estado do ambiente..." />
                  </div>

                  {/* Fotos */}
                  <div>
                    <label className="label">Fotos ({amb.fotos.length}/5)</label>
                    <div className="flex gap-2 flex-wrap">
                      {amb.fotos.map((foto, fi) => (
                        <div key={fi} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                          <img src={foto.url} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removerFoto(idx, fi)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      {amb.fotos.length < 5 && (
                        <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all">
                          <Camera size={16} className="text-gray-300" />
                          <span className="text-[10px] text-gray-300 mt-1">Foto</span>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) adicionarFoto(idx, f) }} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Botões */}
          <div className="flex gap-3">
            <button type="button" disabled={salvando} onClick={() => salvar('rascunho')}
              className="btn border border-gray-200 text-gray-600 hover:bg-gray-50">
              {salvando ? 'Salvando...' : 'Salvar rascunho'}
            </button>
            <button type="button" disabled={salvando} onClick={() => salvar('concluida')}
              className="btn btn-primary">
              <Save size={14} />{salvando ? 'Salvando...' : 'Concluir vistoria'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
