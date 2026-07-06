'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { Building2, Plus, Search, X, UserPlus, Edit2, Trash2 } from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

type Imovel = {
  id: string
  codigo?: string
  titulo: string
  tipo?: string
  categoria?: string
  numero_instalacao_agua?: string
  numero_instalacao_energia?: string
  taxa_administracao?: number
  finalidade?: string
  proprietario_id?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  area_total?: number
  area_util?: number
  quartos?: number
  suites?: number
  banheiros?: number
  vagas?: number
  andar?: number
  mobiliado?: boolean
  pet?: boolean
  valor_aluguel?: number
  valor_venda?: number
  valor_condominio?: number
  valor_iptu?: number
  status: string
  publicado_portal: boolean
  descricao?: string
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

const clienteFormVazio: Record<string, string> = {
  nome: '', tipo: 'locador', cpf: '', rg: '',
  estado_civil: '', profissao: '',
  email: '', telefone: '',
  endereco: '', bairro: '', cidade: '', estado: '', cep: '',
  status: 'ativo',
}

const conjugeFormVazio: Record<string, string> = {
  nome: '', cpf: '', rg: '', profissao: '',
}

function tipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    apartamento: 'Apartamento', casa: 'Casa', sala_comercial: 'Sala comercial', salao_comercial: 'Salão comercial',
    loja: 'Loja', galpao: 'Galpão', terreno: 'Terreno', rural: 'Imóvel rural',
  }
  return labels[tipo] || 'Imóvel'
}

const UFs_MODAL = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function InputMoeda({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const display = value && !isNaN(Number(value))
    ? Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : ''
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) { onChange(''); return }
    onChange(String(parseInt(digits, 10) / 100))
  }
  return (
    <input
      className="input"
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder || 'R$ 0,00'}
    />
  )
}

/**
 * Modal de cadastro de proprietário (locador) para qualificação do contrato,
 * reaproveitado do mesmo padrão usado na tela de Contratos.
 * Campos: nome, CPF, RG, estado civil, profissão, endereço completo, email, celular,
 * com opção de cadastrar o cônjuge (registro separado) quando "casado(a)".
 */
function ModalProprietario({ onSalvar, onFechar }: {
  onSalvar: (cliente: { id: string; nome: string }) => void
  onFechar: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>({ ...clienteFormVazio })
  const [cadastrarConjuge, setCadastrarConjuge] = useState(false)
  const [conjuge, setConjuge] = useState<Record<string, string>>({ ...conjugeFormVazio })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }))

  const setConj = (campo: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConjuge(c => ({ ...c, [campo]: e.target.value }))

  const ehCasado = form.estado_civil === 'casado'

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    const payloadTitular = { ...form, organization_id: ORG_ID, tem_portal: false }
    const { data: titular, error: erroTitular } = await supabase
      .from('clientes').insert([payloadTitular]).select('id, nome').single()

    if (erroTitular) { setSalvando(false); setErro('Erro: ' + erroTitular.message); return }

    if (ehCasado && cadastrarConjuge && conjuge.nome.trim()) {
      const payloadConjuge = {
        nome: conjuge.nome, cpf: conjuge.cpf || null, rg: conjuge.rg || null,
        profissao: conjuge.profissao || null,
        estado_civil: 'casado', tipo: form.tipo, status: 'ativo', tem_portal: false,
        endereco: form.endereco || null, bairro: form.bairro || null,
        cidade: form.cidade || null, estado: form.estado || null, cep: form.cep || null,
        organization_id: ORG_ID,
      }
      const { error: erroConjuge } = await supabase.from('clientes').insert([payloadConjuge])
      if (erroConjuge) { setSalvando(false); setErro('Proprietário salvo, mas erro ao salvar cônjuge: ' + erroConjuge.message); return }
    }

    setSalvando(false)
    onSalvar(titular)
  }

  return (
    <div
      style={{ background: 'rgba(0,0,0,0.6)' }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onFechar}
    >
      <div
        className="card w-full max-w-2xl my-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">
            Cadastrar proprietário — qualificação para o contrato
          </h3>
          <button onClick={onFechar} className="btn btn-sm"><X size={13} /></button>
        </div>
        <form onSubmit={salvar}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className="label">Nome completo *</label>
              <input className="input" required autoFocus value={form.nome} onChange={set('nome')} placeholder="Nome completo" /></div>
            <div><label className="label">CPF *</label>
              <input className="input" required value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
            <div><label className="label">RG *</label>
              <input className="input" required value={form.rg} onChange={set('rg')} /></div>
            <div><label className="label">Estado civil *</label>
              <select className="input" required value={form.estado_civil} onChange={e => { set('estado_civil')(e); if (e.target.value !== 'casado') setCadastrarConjuge(false) }}>
                <option value="">Selecionar</option><option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option><option value="uniao_estavel">União estável</option>
              </select></div>
            <div><label className="label">Profissão *</label>
              <input className="input" required value={form.profissao} onChange={set('profissao')} /></div>
            <div><label className="label">E-mail</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} /></div>
            <div><label className="label">Celular *</label>
              <input className="input" required value={form.telefone} onChange={set('telefone')} placeholder="(11) 99999-9999" /></div>
            <div className="sm:col-span-2"><label className="label">Endereço completo *</label>
              <input className="input" required value={form.endereco} onChange={set('endereco')} placeholder="Rua, número, complemento" /></div>
            <div><label className="label">Bairro *</label>
              <input className="input" required value={form.bairro} onChange={set('bairro')} /></div>
            <div><label className="label">Cidade *</label>
              <input className="input" required value={form.cidade} onChange={set('cidade')} /></div>
            <div><label className="label">Estado *</label>
              <select className="input" required value={form.estado} onChange={set('estado')}>
                <option value="">UF</option>{UFs_MODAL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select></div>
            <div><label className="label">CEP</label>
              <input className="input" value={form.cep} onChange={set('cep')} placeholder="00000-000" /></div>
          </div>

          {ehCasado && (
            <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3 mt-4">
              <label style={{ color: '#5b9bf5' }} className="flex items-center gap-2 text-sm cursor-pointer mb-2">
                <input type="checkbox" checked={cadastrarConjuge} onChange={e => setCadastrarConjuge(e.target.checked)} />
                Cadastrar cônjuge para constar no contrato
              </label>
              {cadastrarConjuge && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="sm:col-span-2"><label className="label">Nome completo do cônjuge *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.nome} onChange={setConj('nome')} placeholder="Nome completo" /></div>
                  <div><label className="label">CPF *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.cpf} onChange={setConj('cpf')} placeholder="000.000.000-00" /></div>
                  <div><label className="label">RG *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.rg} onChange={setConj('rg')} /></div>
                  <div className="sm:col-span-2"><label className="label">Profissão *</label>
                    <input className="input" required={cadastrarConjuge} value={conjuge.profissao} onChange={setConj('profissao')} /></div>
                </div>
              )}
              <p style={{ color: '#7daee8' }} className="text-[10px] mt-2">
                O cônjuge usará o mesmo endereço informado acima, evitando duplicidade de cadastro.
              </p>
            </div>
          )}

          {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={salvando} className="btn btn-primary flex-1">
              {salvando ? 'Salvando...' : 'Cadastrar e selecionar'}
            </button>
            <button type="button" className="btn" onClick={onFechar}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  )
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
  const [modalProprietario, setModalProprietario] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  const [form, setForm] = useState({
    codigo: '', titulo: '', tipo: 'apartamento', categoria: 'residencial', finalidade: 'aluguel',
    proprietario_id: '',
    endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
    area_total: '', area_util: '', quartos: '0', suites: '0', banheiros: '0', vagas: '0',
    andar: '', mobiliado: false, pet: false,
    valor_aluguel: '', valor_venda: '', valor_condominio: '', valor_iptu: '',
    numero_instalacao_agua: '', numero_instalacao_energia: '',
    taxa_administracao: '10',
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

  async function aoCriarProprietario(cliente: { id: string; nome: string }) {
    await buscarProprietarios()
    setForm(f => ({ ...f, proprietario_id: cliente.id }))
    setModalProprietario(false)
  }

  function abrirNovoImovel() {
    const codigosExistentes = imoveis
      .map(i => i.codigo)
      .filter(c => c && /^IM-\d+$/.test(c))
      .map(c => parseInt(c!.replace('IM-', ''), 10))
    const proximo = codigosExistentes.length > 0 ? Math.max(...codigosExistentes) + 1 : 1
    const codigoGerado = `IM-${String(proximo).padStart(3, '0')}`
    setForm(f => ({ ...f, codigo: codigoGerado }))
    setShowForm(true)
  }

  async function buscarCep(cepDigitado: string) {    const cepLimpo = cepDigitado.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setForm(f => ({
          ...f,
          endereco: data.logradouro || f.endereco,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
          titulo: f.titulo || `${tipoLabel(f.tipo)} - ${data.bairro || data.localidade || ''}`,
        }))
      }
    } catch {
      // Falha silenciosa — usuário pode preencher manualmente
    }
    setBuscandoCep(false)
  }

  function abrirEdicao(i: Imovel) {
    setEditandoId(i.id)
    setForm({
      codigo: i.codigo || '', titulo: i.titulo || '', tipo: i.tipo || 'apartamento', categoria: i.categoria || 'residencial', finalidade: i.finalidade || 'aluguel',
      proprietario_id: i.proprietario_id || '',
      endereco: i.endereco || '', numero: i.numero || '', complemento: i.complemento || '',
      bairro: i.bairro || '', cidade: i.cidade || '', estado: i.estado || '', cep: i.cep || '',
      area_total: i.area_total?.toString() || '', area_util: i.area_util?.toString() || '',
      quartos: i.quartos?.toString() || '0', suites: i.suites?.toString() || '0',
      banheiros: i.banheiros?.toString() || '0', vagas: i.vagas?.toString() || '0',
      andar: i.andar?.toString() || '', mobiliado: !!i.mobiliado, pet: !!i.pet,
      valor_aluguel: i.valor_aluguel?.toString() || '', valor_venda: i.valor_venda?.toString() || '',
      valor_condominio: i.valor_condominio?.toString() || '', valor_iptu: i.valor_iptu?.toString() || '',
      numero_instalacao_agua: i.numero_instalacao_agua || '', numero_instalacao_energia: i.numero_instalacao_energia || '',
      taxa_administracao: i.taxa_administracao?.toString() || '10',
      status: i.status || 'disponivel', publicado_portal: !!i.publicado_portal, descricao: i.descricao || '',
    })
    setErro('')
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditandoId(null)
    setErro('')
    setForm({
      codigo: '', titulo: '', tipo: 'apartamento', categoria: 'residencial', finalidade: 'aluguel',
      proprietario_id: '',
      endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
      area_total: '', area_util: '', quartos: '0', suites: '0', banheiros: '0', vagas: '0',
      andar: '', mobiliado: false, pet: false,
      valor_aluguel: '', valor_venda: '', valor_condominio: '', valor_iptu: '',
      numero_instalacao_agua: '', numero_instalacao_energia: '',
      taxa_administracao: '10',
      status: 'disponivel', publicado_portal: false, descricao: '',
    })
  }

  async function excluirImovel(id: string, titulo: string) {
    if (!confirm(`Excluir o imóvel "${titulo}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('imoveis').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    setSucesso('Imóvel excluído.')
    buscarImoveis()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function salvarImovel(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    const payload = {
      codigo: form.codigo || null,
      titulo: form.titulo || form.codigo || `${tipoLabel(form.tipo)} ${form.bairro || ''}`.trim(),
      tipo: form.tipo,
      finalidade: form.finalidade,
      categoria: form.categoria || 'residencial',
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
      numero_instalacao_agua: form.numero_instalacao_agua || null,
      numero_instalacao_energia: form.numero_instalacao_energia || null,
      taxa_administracao: form.taxa_administracao ? parseFloat(form.taxa_administracao) : 10,
      status: form.status,
      publicado_portal: form.publicado_portal,
      descricao: form.descricao,
      ...(editandoId ? {} : { fotos: [] }),
    }

    const { error } = editandoId
      ? await supabase.from('imoveis').update(payload).eq('id', editandoId)
      : await supabase.from('imoveis').insert([payload])

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSucesso(editandoId ? 'Imóvel atualizado com sucesso!' : 'Imóvel cadastrado com sucesso!')
      fecharForm()
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
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Imóveis</h1>
            <button className="btn btn-primary" onClick={() => showForm ? fecharForm() : abrirNovoImovel()}>
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? 'Cancelar' : 'Cadastrar imóvel'}
            </button>
          </div>

          {sucesso && (
            <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">
              {sucesso}
            </div>
          )}

          {showForm && (
            <div className="card mb-6">
              <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">{editandoId ? 'Editar imóvel' : 'Cadastrar novo imóvel'}</h2>
              <form onSubmit={salvarImovel}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Código</label>
                    <input className="input" style={{ background: '#16243a', color: '#5b9bf5' }} value={form.codigo} disabled />
                    <p className="text-[10px] mt-1" style={{ color: '#5b5e6b' }}>Gerado automaticamente.</p>
                  </div>
                  <div>
                    <label className="label">Título do anúncio</label>
                    <input className="input" value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} placeholder="Sugerido automaticamente após o CEP — pode editar" />
                  </div>
                  <div>
                    <label className="label">Tipo</label>
                    <select className="input" value={form.tipo} onChange={e => {
                      const novoTipo = e.target.value
                      const categoriasComerciais = ['sala_comercial', 'salao_comercial', 'loja', 'galpao']
                      const categoriasResidenciais = ['apartamento', 'casa']
                      setForm(f => ({
                        ...f,
                        tipo: novoTipo,
                        categoria: categoriasComerciais.includes(novoTipo) ? 'comercial'
                          : categoriasResidenciais.includes(novoTipo) ? 'residencial'
                          : f.categoria,
                      }))
                    }}>
                      <option value="apartamento">Apartamento</option>
                      <option value="casa">Casa</option>
                      <option value="sala_comercial">Sala comercial</option>
                      <option value="salao_comercial">Salão comercial</option>
                      <option value="loja">Loja</option>
                      <option value="galpao">Galpão</option>
                      <option value="terreno">Terreno</option>
                      <option value="rural">Rural</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Categoria</label>
                    <select className="input" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                      <option value="residencial">Residencial</option>
                      <option value="comercial">Comercial</option>
                    </select>
                    <p className="text-[10px] mt-1" style={{ color: '#5b5e6b' }}>Define se o contrato gerado será de locação residencial ou comercial.</p>
                  </div>
                  <div>
                    <label className="label">Finalidade</label>
                    <select className="input" value={form.finalidade} onChange={e => setForm({...form, finalidade: e.target.value})}>
                      <option value="aluguel">Aluguel</option>
                      <option value="venda">Venda</option>
                      <option value="ambos">Aluguel e venda</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="label" style={{ marginBottom: 0 }}>Proprietário</label>
                      <button type="button" onClick={() => setModalProprietario(true)}
                        style={{ color: '#5b9bf5' }} className="text-[11px] flex items-center gap-1 hover:underline">
                        <UserPlus size={11} />Cadastrar
                      </button>
                    </div>
                    <select className="input" value={form.proprietario_id} onChange={e => setForm({...form, proprietario_id: e.target.value})}>
                      <option value="">Selecionar proprietário</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">CEP</label>
                    <input
                      className="input"
                      value={form.cep}
                      onChange={e => setForm({ ...form, cep: e.target.value })}
                      onBlur={() => buscarCep(form.cep)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    {buscandoCep && <p className="text-[10px] mt-1" style={{ color: '#5b9bf5' }}>Buscando endereço...</p>}
                  </div>
                  <div>
                    <label className="label">Número</label>
                    <input className="input" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Complemento</label>
                    <input className="input" value={form.complemento} onChange={e => setForm({...form, complemento: e.target.value})} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Endereço</label>
                    <input className="input" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
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
                      {UFs_MODAL.map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
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
                    <InputMoeda value={form.valor_aluguel} onChange={v => setForm({...form, valor_aluguel: v})} />
                  </div>
                  <div>
                    <label className="label">Taxa de administração (%)</label>
                    <input className="input" type="number" step="0.1" value={form.taxa_administracao} onChange={e => setForm({...form, taxa_administracao: e.target.value})} placeholder="10" />
                  </div>
                  <div>
                    <label className="label">Valor venda (R$)</label>
                    <InputMoeda value={form.valor_venda} onChange={v => setForm({...form, valor_venda: v})} />
                  </div>
                  <div>
                    <label className="label">Condomínio (mensal) (R$)</label>
                    <InputMoeda value={form.valor_condominio} onChange={v => setForm({...form, valor_condominio: v})} />
                  </div>
                  <div>
                    <label className="label">IPTU (mensal) (R$)</label>
                    <InputMoeda value={form.valor_iptu} onChange={v => setForm({...form, valor_iptu: v})} />
                  </div>
                  <div>
                    <label className="label">Nº instalação água</label>
                    <input className="input" value={form.numero_instalacao_agua} onChange={e => setForm({...form, numero_instalacao_agua: e.target.value})} placeholder="Nº da matrícula/instalação (concessionária)" />
                  </div>
                  <div>
                    <label className="label">Nº instalação energia</label>
                    <input className="input" value={form.numero_instalacao_energia} onChange={e => setForm({...form, numero_instalacao_energia: e.target.value})} placeholder="Nº da instalação/UC (concessionária)" />
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
                  <div className="flex items-center gap-4 pt-5 flex-wrap">
                    <label style={{ color: '#c3c2b7' }} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.mobiliado} onChange={e => setForm({...form, mobiliado: e.target.checked})} />
                      Mobiliado
                    </label>
                    <label style={{ color: '#c3c2b7' }} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.pet} onChange={e => setForm({...form, pet: e.target.checked})} />
                      Aceita pet
                    </label>
                    <label style={{ color: '#c3c2b7' }} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.publicado_portal} onChange={e => setForm({...form, publicado_portal: e.target.checked})} />
                      Publicar no portal
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Descrição</label>
                    <textarea className="input" rows={3} value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Descreva o imóvel, diferenciais, estado de conservação..." />
                  </div>
                </div>
                {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
                <div className="flex gap-2 mt-4">
                  <button type="submit" disabled={salvando} className="btn btn-primary">
                    {salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Salvar imóvel'}
                  </button>
                  <button type="button" className="btn" onClick={fecharForm}>Cancelar</button>
                </div>
              </form>

              {modalProprietario && (
                <ModalProprietario
                  onFechar={() => setModalProprietario(false)}
                  onSalvar={aoCriarProprietario}
                />
              )}
            </div>
          )}

          <div className="card mb-4 py-3">
            <div className="flex items-center gap-2">
              <Search size={15} style={{ color: '#8b8d98' }} />
              <input
                style={{ color: '#f4f4f3' }}
                className="flex-1 text-sm outline-none bg-transparent placeholder-[#8b8d98]"
                placeholder="Buscar por título, bairro ou cidade..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="card p-0 overflow-hidden overflow-x-auto">
            {loading ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando imóveis...</div>
            ) : filtrados.length === 0 ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12">
                <Building2 size={36} className="mx-auto mb-2 opacity-30" />
                <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum imóvel cadastrado</div>
                <div className="text-sm mt-1">Clique em "Cadastrar imóvel" para começar</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                    {['Imóvel', 'Tipo', 'Características', 'Valor', 'Status', 'Portal', ''].map(h => (
                      <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((i) => (
                    <tr key={i.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div style={{ background: '#16243a', color: '#5b9bf5' }} className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Building2 size={16} />
                          </div>
                          <div>
                            <div style={{ color: '#f4f4f3' }} className="font-medium text-sm whitespace-nowrap flex items-center gap-1.5">
                              {i.codigo && <span style={{ background: '#16243a', color: '#5b9bf5', border: '0.5px solid #1e3a5f' }} className="text-[10px] font-semibold px-1.5 py-0.5 rounded">{i.codigo}</span>}
                              {i.titulo}
                            </div>
                            <div style={{ color: '#8b8d98' }} className="text-xs whitespace-nowrap">{[i.bairro, i.cidade, i.estado].filter(Boolean).join(' · ')}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs capitalize">{i.tipo}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 text-xs whitespace-nowrap">
                        {[
                          i.area_total ? `${i.area_total}m²` : null,
                          i.quartos ? `${i.quartos} dorms` : null,
                          i.vagas ? `${i.vagas} vaga${i.vagas > 1 ? 's' : ''}` : null,
                        ].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                        {i.valor_aluguel ? formatVal(i.valor_aluguel) + '/mês' : i.valor_venda ? formatVal(i.valor_venda) : '—'}
                      </td>
                      <td className="px-4 py-3"><span className={statusBadge[i.status] || 'badge badge-gray'}>{statusLabel[i.status] || i.status}</span></td>
                      <td className="px-4 py-3"><span className={`badge ${i.publicado_portal ? 'badge-green' : 'badge-gray'}`}>{i.publicado_portal ? 'Publicado' : 'Rascunho'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button className="btn btn-sm" onClick={() => abrirEdicao(i)}>
                            <Edit2 size={12} />Editar
                          </button>
                          <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => excluirImovel(i.id, i.titulo)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
