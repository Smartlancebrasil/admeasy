'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { Building2, Plus, Search, X } from 'lucide-react'

type Imovel = {
  id: string
  titulo: string
  tipo?: string
  finalidade?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  area_total?: number
  quartos?: number
  banheiros?: number
  vagas?: number
  valor_aluguel?: number
  valor_venda?: number
  valor_condominio?: number
  status: string
  publicado_portal: boolean
  created_at: string
}

const statusBadge: Record<string, string> = {
  disponivel: 'badge badge-green',
  alugado: 'badge badge-blue',
  vendido: 'badge badge-gray',
  em_analise: 'badge badge-yellow',
  inativo: 'badge badge-gray',
  rascunho: 'badge badge-gray',
}

const statusLabel: Record<string, string> = {
  disponivel: 'Disponível',
  alugado: 'Alugado',
  vendido: 'Vendido',
  em_analise: 'Em análise',
  inativo: 'Inativo',
  rascunho: 'Rascunho',
}

export default function ImoveisPage() {
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [clientes, setClientes] = useState<{id: string, nome: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const [form, setForm] = useState({
    titulo: '', tipo: 'apartamento', finalidade: 'aluguel',
    proprietario_id: '',
    endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
    area_total: '', area_util: '', quartos: '0', suites: '0', banheiros: '0', vagas: '0',
    andar: '', mobiliado: false, pet: false,
    valor_aluguel: '', valor_venda: '', valor_condominio: '', valor_iptu: '',
    status: 'disponivel', publicado_portal: false, descricao: '',
  })

  useEffect(() => {
    buscarImoveis()
    buscarProprietarios()
  }, [])

  async function buscarImoveis() {
    setLoading(true)
    const { data, error } = await supabase
      .from('imoveis')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setImoveis(data)
    setLoading(false)
  }

  async function buscarProprietarios() {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome')
      .in('tipo', ['locador', 'vendedor'])
      .order('nome')
    if (data) setClientes(data)
  }

  async function salvarImovel(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    const payload = {
      titulo: form.titulo,
      tipo: form.tipo,
      finalidade: form.finalidade,
      proprietario_id: form.proprietario_id || null,
      endereco: form.endereco,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      estado: form.estado,
      cep: form.cep,
      area_total: form.area_total ? parseFloat(form.area_total) : null,
      area_util: form.area_util ? parseFloat(form.area_util) : null,
      quartos: parseInt(form.quartos) || 0,
      suites: parseInt(form.suites) || 0,
      banheiros: parseInt(form.banheiros) || 0,
      vagas: parseInt(form.vagas) || 0,
      andar: form.andar ? parseInt(form.andar) : null,
      mobiliado: form.mobiliado,
      pet: form.pet,
      valor_aluguel: form.valor_aluguel ? parseFloat(form.valor_aluguel) : null,
      valor_venda: form.valor_venda ? parseFloat(form.valor_venda) : null,
      valor_condominio: form.valor_condominio ? parseFloat(form.valor_condominio) : null,
      valor_iptu: form.valor_iptu ? parseFloat(form.valor_iptu) : null,
      status: form.status,
      publicado_portal: form.publicado_portal,
      descricao: form.descricao,
      fotos: [],
    }

    const { error } = await supabase.from('imoveis').insert([payload])

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSucesso('Imóvel cadastrado com sucesso!')
      setShowForm(false)
      buscarImoveis()
      setTimeout(() => setSucesso(''), 3000)
    }
    setSalvando(false)
  }

  const filtrados = imoveis.filter(i =>
    i.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    i.bairro?.toLowerCase().includes(busca.toLowerCase()) ||
    i.cidade?.toLowerCase().includes(busca.toLowerCase()) ||
    i.endereco?.toLowerCase().includes(busca.toLowerCase())
  )

  function formatVal(val?: number) {
    if (!val) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  }

  return (
    <AppLayout>
      <Topbar titulo="Imóveis">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancelar' : 'Cadastrar imóvel'}
        </button>
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        {sucesso && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {sucesso}
          </div>
        )}

        {showForm && (
          <div className="card mb-6">
            <h2 className="text-sm font-semibold mb-4">Cadastrar novo imóvel</h2>
            <form onSubmit={salvarImovel}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Título do anúncio *</label>
                  <input className="input" required value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} placeholder="Ex: Apartamento 2 dormitórios com vaga — Moema" />
                </div>
                <div>
                  <label className="label">Tipo *</label>
                  <select className="input" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="studio">Studio</option>
                    <option value="sobrado">Sobrado</option>
                    <option value="terreno">Terreno</option>
                    <option value="comercial">Comercial</option>
                    <option value="galpao">Galpão</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="label">Finalidade *</label>
                  <select className="input" value={form.finalidade} onChange={e => setForm({...form, finalidade: e.target.value})}>
                    <option value="aluguel">Aluguel</option>
                    <option value="venda">Venda</option>
                    <option value="aluguel_venda">Aluguel e venda</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Proprietário</label>
                  <select className="input" value={form.proprietario_id} onChange={e => setForm({...form, proprietario_id: e.target.value})}>
                    <option value="">Selecionar proprietário</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Endereço</label>
                  <input className="input" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} placeholder="Rua, avenida..." />
                </div>
                <div>
                  <label className="label">Número</label>
                  <input className="input" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} />
                </div>
                <div>
                  <label className="label">Complemento</label>
                  <input className="input" value={form.complemento} onChange={e => setForm({...form, complemento: e.target.value})} placeholder="Apto, bloco..." />
                </div>
                <div>
                  <label className="label">Bairro</label>
                  <input className="input" value={form.bairro} onChange={e => setForm({...form, bairro: e.target.value})} />
                </div>
                <div>
                  <label className="label">Cidade</label>
                  <input className="input" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} />
                </div>
                <div>
                  <label className="label">Estado</label>
                  <select className="input" value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                    <option value="">UF</option>
                    {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">CEP</label>
                  <input className="input" value={form.cep} onChange={e => setForm({...form, cep: e.target.value})} placeholder="00000-000" />
                </div>
                <div>
                  <label className="label">Área total (m²)</label>
                  <input className="input" type="number" value={form.area_total} onChange={e => setForm({...form, area_total: e.target.value})} />
                </div>
                <div>
                  <label className="label">Área útil (m²)</label>
                  <input className="input" type="number" value={form.area_util} onChange={e => setForm({...form, area_util: e.target.value})} />
                </div>
                <div>
                  <label className="label">Dormitórios</label>
                  <select className="input" value={form.quartos} onChange={e => setForm({...form, quartos: e.target.value})}>
                    {['0','1','2','3','4','5'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Suítes</label>
                  <select className="input" value={form.suites} onChange={e => setForm({...form, suites: e.target.value})}>
                    {['0','1','2','3','4'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Banheiros</label>
                  <select className="input" value={form.banheiros} onChange={e => setForm({...form, banheiros: e.target.value})}>
                    {['0','1','2','3','4'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Vagas</label>
                  <select className="input" value={form.vagas} onChange={e => setForm({...form, vagas: e.target.value})}>
                    {['0','1','2','3','4'].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Valor aluguel (R$)</label>
                  <input className="input" type="number" value={form.valor_aluguel} onChange={e => setForm({...form, valor_aluguel: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">Valor venda (R$)</label>
                  <input className="input" type="number" value={form.valor_venda} onChange={e => setForm({...form, valor_venda: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">Condomínio (R$)</label>
                  <input className="input" type="number" value={form.valor_condominio} onChange={e => setForm({...form, valor_condominio: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">IPTU anual (R$)</label>
                  <input className="input" type="number" value={form.valor_iptu} onChange={e => setForm({...form, valor_iptu: e.target.value})} placeholder="0,00" />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="disponivel">Disponível</option>
                    <option value="alugado">Alugado</option>
                    <option value="vendido">Vendido</option>
                    <option value="em_analise">Em análise</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.mobiliado} onChange={e => setForm({...form, mobiliado: e.target.checked})} />
                    Mobiliado
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.pet} onChange={e => setForm({...form, pet: e.target.checked})} />
                    Aceita pet
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.publicado_portal} onChange={e => setForm({...form, publicado_portal: e.target.checked})} />
                    Publicar no portal
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="label">Descrição</label>
                  <textarea className="input" rows={3} value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descreva o imóvel, diferenciais, estado de conservação..." />
                </div>
              </div>
              {erro && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={salvando} className="btn btn-primary">
                  {salvando ? 'Salvando...' : 'Salvar imóvel'}
                </button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        <div className="card mb-4 py-3">
          <div className="flex items-center gap-2">
            <Search size={15} className="text-gray-400" />
            <input className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400" placeholder="Buscar por título, bairro ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando imóveis...</div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Building2 size={36} className="mx-auto mb-2 opacity-30" />
              <div className="font-medium text-gray-500">Nenhum imóvel cadastrado</div>
              <div className="text-sm mt-1">Clique em "Cadastrar imóvel" para começar</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Imóvel</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Características</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">Portal</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((i) => (
                  <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{i.titulo}</div>
                          <div className="text-xs text-gray-400">{[i.bairro, i.cidade, i.estado].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs capitalize">{i.tipo}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {[
                        i.area_total ? `${i.area_total}m²` : null,
                        i.quartos ? `${i.quartos} dorms` : null,
                        i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : null,
                      ].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">
                      {i.valor_aluguel ? formatVal(i.valor_aluguel) + '/mês' : i.valor_venda ? formatVal(i.valor_venda) : '—'}
                    </td>
                    <td className="px-4 py-3"><span className={statusBadge[i.status] || 'badge badge-gray'}>{statusLabel[i.status] || i.status}</span></td>
                    <td className="px-4 py-3"><span className={`badge ${i.publicado_portal ? 'badge-green' : 'badge-gray'}`}>{i.publicado_portal ? 'Publicado' : 'Rascunho'}</span></td>
                    <td className="px-4 py-3"><button className="btn text-xs py-1 px-2.5">Ver</button></td>
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