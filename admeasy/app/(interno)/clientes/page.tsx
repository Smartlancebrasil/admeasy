'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import { UserPlus, Search, X, Edit2, Save, KeyRound } from 'lucide-react'

type Cliente = {
  id: string
  nome: string
  tipo: string
  cpf?: string
  rg?: string
  data_nascimento?: string
  estado_civil?: string
  profissao?: string
  renda_mensal?: number
  empresa?: string
  email?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
  chave_pix?: string
  observacoes?: string
  status: string
  tem_portal: boolean
  usuario_portal_id?: string | null
  created_at: string
}

const tipoBadge: Record<string, string> = {
  locatario: 'badge badge-blue', locador: 'badge badge-green',
  comprador: 'badge badge-purple', vendedor: 'badge badge-gray', lead: 'badge badge-yellow',
}
const tipoLabel: Record<string, string> = {
  locatario: 'Locatário', locador: 'Locador', comprador: 'Comprador', vendedor: 'Vendedor', lead: 'Lead',
}
const statusBadge: Record<string, string> = {
  ativo: 'badge badge-green', lead: 'badge badge-yellow', inativo: 'badge badge-gray', bloqueado: 'badge badge-red',
}

function iniciais(nome: string) {
  return nome.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
}

function gerarSenhaAleatoria() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let senha = ''
  for (let i = 0; i < 10; i++) senha += chars[Math.floor(Math.random() * chars.length)]
  return senha
}

const UFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const formVazio: Record<string, string> = {
  nome: '', tipo: 'locatario', cpf: '', rg: '', data_nascimento: '',
  estado_civil: '', profissao: '', renda_mensal: '', empresa: '',
  email: '', telefone: '', whatsapp: '',
  cep: '', endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  chave_pix: '',
  observacoes: '', status: 'ativo',
}

/**
 * IMPORTANTE: este componente fica FORA do componente da página.
 * Definir um componente dentro do corpo de outro componente faz o React
 * recriá-lo do zero a cada render do pai, o que derruba o foco dos
 * inputs a cada tecla digitada (era a causa do bug de "uma letra por vez").
 */
function FormCliente({
  form, setForm, editando, erro, salvando, onSubmit, onCancelar,
}: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  editando: Cliente | null
  erro: string
  salvando: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancelar: () => void
}) {
  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }))

  const [buscandoCep, setBuscandoCep] = useState(false)

  // Busca o endereço automaticamente assim que o CEP tiver os 8 dígitos —
  // mesmo padrão já usado no cadastro rápido de cliente na tela de Contratos.
  async function buscarCep(cepDigitado: string) {
    const cepLimpo = cepDigitado.replace(/\D/g, '')
    if (cepLimpo.length !== 8) return
    setBuscandoCep(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const dados = await res.json()
      if (!dados.erro) {
        setForm(f => ({
          ...f,
          endereco: dados.logradouro || f.endereco,
          bairro: dados.bairro || f.bairro,
          cidade: dados.localidade || f.cidade,
          estado: dados.uf || f.estado,
        }))
      }
    } catch {
      // Sem internet ou API fora do ar: usuário preenche manualmente, sem travar o formulário.
    }
    setBuscandoCep(false)
  }

  function aoDigitarCep(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value
    setForm(f => ({ ...f, cep: valor }))
    buscarCep(valor)
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{editando ? `Editando: ${editando.nome}` : 'Cadastrar novo cliente'}</h2>
        <button onClick={onCancelar} className="btn btn-sm"><X size={13} /></button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Nome completo *</label>
            <input className="input" required value={form.nome} onChange={set('nome')} placeholder="Nome completo" /></div>
          <div><label className="label">Tipo *</label>
            <select className="input" value={form.tipo} onChange={set('tipo')}>
              <option value="locatario">Locatário</option><option value="locador">Locador (proprietário)</option>
              <option value="comprador">Comprador</option><option value="vendedor">Vendedor</option><option value="lead">Lead</option>
            </select></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={set('status')}>
              <option value="ativo">Ativo</option><option value="lead">Lead</option><option value="inativo">Inativo</option>
            </select></div>
          <div><label className="label">CPF</label>
            <input className="input" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
          <div><label className="label">RG</label>
            <input className="input" value={form.rg} onChange={set('rg')} /></div>
          <div><label className="label">Data de nascimento</label>
            <input className="input" type="date" value={form.data_nascimento} onChange={set('data_nascimento')} /></div>
          <div><label className="label">Estado civil</label>
            <select className="input" value={form.estado_civil} onChange={set('estado_civil')}>
              <option value="">Selecionar</option><option value="solteiro">Solteiro(a)</option>
              <option value="casado">Casado(a)</option><option value="divorciado">Divorciado(a)</option>
              <option value="viuvo">Viúvo(a)</option><option value="uniao_estavel">União estável</option>
            </select></div>
          <div><label className="label">Profissão</label>
            <input className="input" value={form.profissao} onChange={set('profissao')} /></div>
          <div><label className="label">Renda mensal (R$)</label>
            <input className="input" type="number" value={form.renda_mensal} onChange={set('renda_mensal')} /></div>
          <div><label className="label">Empresa</label>
            <input className="input" value={form.empresa} onChange={set('empresa')} /></div>
          <div><label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={set('telefone')} /></div>
          <div><label className="label">WhatsApp</label>
            <input className="input" value={form.whatsapp} onChange={set('whatsapp')} /></div>
          <div><label className="label">CEP</label>
            <div className="relative">
              <input className="input" value={form.cep} onChange={aoDigitarCep} placeholder="00000-000" maxLength={9} />
              {buscandoCep && <span style={{ color: '#5b9bf5' }} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">Buscando...</span>}
            </div></div>
          <div><label className="label">Estado</label>
            <select className="input" value={form.estado} onChange={set('estado')}>
              <option value="">UF</option>{UFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className="label">Endereço</label>
            <input className="input" value={form.endereco} onChange={set('endereco')} placeholder="Preenchido automaticamente pelo CEP, ou digite" /></div>
          <div><label className="label">Número</label>
            <input className="input" value={form.numero} onChange={set('numero')} placeholder="Ex: 123" /></div>
          <div><label className="label">Complemento</label>
            <input className="input" value={form.complemento} onChange={set('complemento')} placeholder="Ex: Apto 42, Bloco B" /></div>
          <div><label className="label">Bairro</label>
            <input className="input" value={form.bairro} onChange={set('bairro')} /></div>
          <div><label className="label">Cidade</label>
            <input className="input" value={form.cidade} onChange={set('cidade')} /></div>
          {form.tipo === 'locador' && (
            <div className="sm:col-span-2"><label className="label">Chave PIX (para recebimento dos repasses)</label>
              <input className="input" value={form.chave_pix} onChange={set('chave_pix')} placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória" /></div>
          )}
          <div className="sm:col-span-2"><label className="label">Observações</label>
            <textarea className="input" rows={2} value={form.observacoes} onChange={set('observacoes')} /></div>
        </div>
        {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mt-3">{erro}</div>}
        <div className="flex gap-2 mt-4">
          <button type="submit" disabled={salvando} className="btn btn-primary">
            <Save size={13} />{salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
          <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

/**
 * Também fica FORA do componente da página, pelo mesmo motivo do
 * FormCliente (evitar recriação e perda de foco a cada tecla digitada).
 */
function ModalAcessoPortal({ cliente, onFechar, onSucesso }: {
  cliente: Cliente
  onFechar: () => void
  onSucesso: () => void
}) {
  const [email, setEmail] = useState(cliente.email || '')
  const [senha, setSenha] = useState(gerarSenhaAleatoria())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function confirmar() {
    setSalvando(true)
    setErro('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Sessão expirada. Atualize a página e faça login novamente.')
      const res = await fetch('/api/portal/gerenciar-acesso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clienteId: cliente.id, email, senha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar.')
      setSucesso(true)
      onSucesso()
    } catch (e: any) {
      setErro(e.message)
    }
    setSalvando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }} className="flex items-center justify-center p-4">
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">
            {cliente.tem_portal ? 'Redefinir senha' : 'Criar acesso ao portal'} — {cliente.nome}
          </h2>
          <button onClick={onFechar} className="btn btn-sm"><X size={13} /></button>
        </div>

        {sucesso ? (
          <div>
            <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-3 text-sm">
              {cliente.tem_portal ? 'Senha redefinida com sucesso!' : 'Acesso criado com sucesso!'}
            </div>
            <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-lg p-3 mb-4">
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1">E-mail de acesso</div>
              <div style={{ color: '#f4f4f3' }} className="text-sm font-medium mb-2">{email}</div>
              <div style={{ color: '#8b8d98' }} className="text-xs mb-1">Senha</div>
              <div style={{ color: '#f4f4f3' }} className="text-sm font-medium">{senha}</div>
            </div>
            <div style={{ color: '#8b8d98' }} className="text-xs mb-4">
              Anote ou copie esses dados agora — a senha não fica visível em nenhum outro lugar depois que você fechar esta janela. Envie ao locatário por WhatsApp ou e-mail.
            </div>
            <button className="btn btn-primary" onClick={onFechar}>Fechar</button>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="label">E-mail do locatário</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="mb-3">
              <label className="label">Senha</label>
              <div className="flex gap-2">
                <input className="input" value={senha} onChange={e => setSenha(e.target.value)} />
                <button type="button" className="btn btn-sm" onClick={() => setSenha(gerarSenhaAleatoria())}>Gerar nova</button>
              </div>
            </div>
            {erro && <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg mb-3">{erro}</div>}
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={salvando || !email || senha.length < 6} onClick={confirmar}>
                {salvando ? 'Salvando...' : cliente.tem_portal ? 'Redefinir senha' : 'Criar acesso'}
              </button>
              <button className="btn" onClick={onFechar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ClientesPage() {
  const { organizacao } = useOrganization()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [form, setForm] = useState<Record<string,string>>(formVazio)
  const [clienteAcesso, setClienteAcesso] = useState<Cliente | null>(null)

  useEffect(() => {
    if (organizacao?.id) buscarClientes(organizacao.id)
  }, [organizacao?.id])

  async function buscarClientes(orgId: string) {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').eq('organization_id', orgId).order('nome')
    if (data) setClientes(data)
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(formVazio)
    setErro('')
    setShowForm(true)
  }

  function abrirEdicao(c: Cliente) {
    setEditando(c)
    setForm({
      nome: c.nome || '', tipo: c.tipo || 'locatario', cpf: c.cpf || '', rg: c.rg || '',
      data_nascimento: c.data_nascimento || '', estado_civil: c.estado_civil || '',
      profissao: c.profissao || '', renda_mensal: c.renda_mensal?.toString() || '',
      empresa: c.empresa || '', email: c.email || '', telefone: c.telefone || '',
      whatsapp: c.whatsapp || '',
      cep: c.cep || '', endereco: c.endereco || '', numero: '', complemento: '', bairro: c.bairro || '',
      cidade: c.cidade || '', estado: c.estado || '',
      chave_pix: c.chave_pix || '',
      observacoes: c.observacoes || '', status: c.status || 'ativo',
    })
    setErro('')
    setShowForm(true)
  }

  function fecharForm() {
    setShowForm(false)
    setEditando(null)
    setForm(formVazio)
    setErro('')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!organizacao?.id) { setErro('Organização ainda não carregada. Aguarde e tente novamente.'); return }
    setSalvando(true)
    setErro('')

    if (form.cpf?.trim()) {
      let consultaCpf = supabase.from('clientes').select('id').eq('organization_id', organizacao.id).eq('cpf', form.cpf.trim())
      if (editando) consultaCpf = consultaCpf.neq('id', editando.id)
      const { data: duplicados } = await consultaCpf.limit(1)
      if (duplicados && duplicados.length > 0) {
        setErro('Já existe um cliente cadastrado com esse CPF.')
        setSalvando(false)
        return
      }
    }

    // A tabela "clientes" guarda o endereço todo num campo só (endereco),
    // então juntamos rua + número + complemento aqui antes de enviar —
    // número/complemento existem só nesta tela, para facilitar o preenchimento.
    const enderecoCompleto = [form.endereco, form.numero, form.complemento].filter(Boolean).join(', ')
    const { numero, complemento, ...formSemNumeroComplemento } = form

    const payload = {
      ...formSemNumeroComplemento,
      endereco: enderecoCompleto,
      renda_mensal: form.renda_mensal ? parseFloat(form.renda_mensal) : null,
      data_nascimento: form.data_nascimento || null,
    }

    let error
    if (editando) {
      const res = await supabase.from('clientes').update(payload).eq('id', editando.id).eq('organization_id', organizacao.id)
      error = res.error
    } else {
      const res = await supabase.from('clientes').insert([{ ...payload, organization_id: organizacao.id, tem_portal: false }])
      error = res.error
    }

    if (error) {
      setErro('Erro: ' + error.message)
    } else {
      setSucesso(editando ? 'Cliente atualizado!' : 'Cliente cadastrado!')
      fecharForm()
      buscarClientes(organizacao.id)
      setTimeout(() => setSucesso(''), 3000)
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!organizacao?.id) return
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id).eq('organization_id', organizacao.id)
    buscarClientes(organizacao.id)
  }

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.cpf?.includes(busca) || c.telefone?.includes(busca) ||
    c.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">

          <div className="flex items-center justify-between mb-5">
            <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium">Clientes e proprietários</h1>
            <button className="btn btn-primary" onClick={abrirNovo} disabled={!organizacao?.id}><UserPlus size={14} />Novo cliente</button>
          </div>

          {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucesso}</div>}
          {showForm && (
            <FormCliente
              form={form}
              setForm={setForm}
              editando={editando}
              erro={erro}
              salvando={salvando}
              onSubmit={salvar}
              onCancelar={fecharForm}
            />
          )}

          {clienteAcesso && (
            <ModalAcessoPortal
              cliente={clienteAcesso}
              onFechar={() => setClienteAcesso(null)}
              onSucesso={() => { if (organizacao?.id) buscarClientes(organizacao.id) }}
            />
          )}

          <div className="card mb-4 py-3">
            <div className="flex items-center gap-2">
              <Search size={15} style={{ color: '#8b8d98' }} />
              <input
                style={{ color: '#f4f4f3' }}
                className="flex-1 text-sm outline-none bg-transparent placeholder-[#8b8d98]"
                placeholder="Buscar por nome, CPF, telefone ou e-mail..."
                value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
          </div>

          <div className="card p-0 overflow-hidden overflow-x-auto">
            {loading ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12 text-sm">Carregando...</div>
            ) : filtrados.length === 0 ? (
              <div style={{ color: '#8b8d98' }} className="text-center py-12">
                <div className="text-3xl mb-2">👥</div>
                <div style={{ color: '#c3c2b7' }} className="font-medium">Nenhum cliente cadastrado</div>
                <div className="text-sm mt-1">Clique em "Novo cliente" para começar</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                    {['Cliente','Tipo','CPF','Telefone','E-mail','Status','Portal',''].map(h => (
                      <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(c => (
                    <tr key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div style={{ background: '#16243a', color: '#5b9bf5' }} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                            {iniciais(c.nome)}
                          </div>
                          <span style={{ color: '#f4f4f3' }} className="font-medium whitespace-nowrap">{c.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={tipoBadge[c.tipo] || 'badge badge-gray'}>{tipoLabel[c.tipo] || c.tipo}</span></td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{c.cpf || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{c.telefone || '—'}</td>
                      <td style={{ color: '#8b8d98' }} className="px-4 py-3">{c.email || '—'}</td>
                      <td className="px-4 py-3"><span className={statusBadge[c.status] || 'badge badge-gray'}>{c.status}</span></td>
                      <td className="px-4 py-3">
                        {c.tipo === 'locatario' ? (
                          <span className={c.tem_portal ? 'badge badge-green' : 'badge badge-gray'}>
                            {c.tem_portal ? 'Ativo' : 'Sem acesso'}
                          </span>
                        ) : (
                          <span style={{ color: '#5b5e6b' }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {c.tipo === 'locatario' && (
                            <button className="btn btn-sm" onClick={() => setClienteAcesso(c)} title="Gerenciar acesso ao portal">
                              <KeyRound size={12} />{c.tem_portal ? 'Redefinir' : 'Gerenciar acesso'}
                            </button>
                          )}
                          <button className="btn btn-sm" onClick={() => abrirEdicao(c)}><Edit2 size={12} />Editar</button>
                          <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => excluir(c.id)}><X size={12} /></button>
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
