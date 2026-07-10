'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { supabase } from '@/lib/supabase'
import { useOrganization } from '@/lib/OrganizationContext'
import { Save, Plus, X, Edit2, Building2, Users, Shield, UserPlus, Mail, Trash2, ExternalLink, CheckCircle2, Clock } from 'lucide-react'

const SUPABASE_AUTH_URL = 'https://supabase.com/dashboard/project/ckhcbiuwcfnbmlloduwj/auth/users'

const UFs = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const perfis = [
  { value: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema', cor: 'badge-red' },
  { value: 'corretor', label: 'Corretor', desc: 'Clientes, imóveis e contratos', cor: 'badge-blue' },
  { value: 'assistente', label: 'Assistente', desc: 'Visualização e cadastros básicos', cor: 'badge-green' },
  { value: 'financeiro', label: 'Financeiro', desc: 'Módulo financeiro e cobranças', cor: 'badge-yellow' },
  { value: 'vistoriador', label: 'Vistoriador', desc: 'Somente laudos de vistoria', cor: 'badge-purple' },
]

type Org = Record<string, string>
type Vistoriador = { id: string; nome: string; cpf?: string; crea?: string; telefone?: string; email?: string; ativo: boolean }
type Usuario = { id: string; nome: string; email: string; perfil: string; ativo: boolean }
type Convite = { id: string; email: string; perfil: string; nome?: string; usado: boolean; created_at: string }

function FormVistoriador({ inicial, onSalvar, onCancelar }: {
  inicial: Record<string,string>
  onSalvar: (d: Record<string,string>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [salvando, setSalvando] = useState(false)
  const set = (c: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f=>({...f,[c]:e.target.value}))
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true)
    await onSalvar(form); setSalvando(false)
  }
  return (
    <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-lg p-4 mb-3">
      <form onSubmit={submit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Nome completo *</label>
            <input className="input" required value={form.nome} onChange={set('nome')} /></div>
          <div><label className="label">CPF</label>
            <input className="input" value={form.cpf} onChange={set('cpf')} placeholder="000.000.000-00" /></div>
          <div><label className="label">CREA / Registro</label>
            <input className="input" value={form.crea} onChange={set('crea')} /></div>
          <div><label className="label">Telefone</label>
            <input className="input" value={form.telefone} onChange={set('telefone')} /></div>
          <div><label className="label">E-mail</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <button type="submit" disabled={salvando} className="btn btn-primary btn-sm">
            <Save size={12} />{salvando ? 'Salvando...' : inicial.id ? 'Salvar' : 'Cadastrar'}
          </button>
          <button type="button" className="btn btn-sm" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

/**
 * Form para editar nome e perfil de um convite pendente (cadastro feito pelo admin,
 * antes de o login ser criado no Supabase Auth).
 */
function FormEditarConvite({ convite, onSalvar, onCancelar }: {
  convite: Convite
  onSalvar: (id: string, dados: { nome: string; perfil: string }) => Promise<void>
  onCancelar: () => void
}) {
  const [nome, setNome] = useState(convite.nome || '')
  const [perfil, setPerfil] = useState(convite.perfil)
  const [salvando, setSalvando] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    await onSalvar(convite.id, { nome, perfil })
    setSalvando(false)
  }

  return (
    <form onSubmit={submit} style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3 mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label">Nome</label>
          <input className="input" value={nome} onChange={e => setNome(e.target.value)} />
        </div>
        <div>
          <label className="label">Perfil</label>
          <select className="input" value={perfil} onChange={e => setPerfil(e.target.value)}>
            {perfis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="btn btn-primary btn-sm">
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}

export default function ConfiguracoesPage() {
  const { organizacao } = useOrganization()
  const [aba, setAba] = useState<'imobiliaria'|'vistoriadores'|'usuarios'>('imobiliaria')
  const [org, setOrg] = useState<Org>({})
  const [salvandoOrg, setSalvandoOrg] = useState(false)
  const [sucessoOrg, setSucessoOrg] = useState('')
  const [vistoriadores, setVistoriadores] = useState<Vistoriador[]>([])
  const [formVist, setFormVist] = useState<Record<string,string>|null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [showConvite, setShowConvite] = useState(false)
  const [conviteForm, setConviteForm] = useState({ nome: '', email: '', perfil: 'corretor' })
  const [enviandoConvite, setEnviandoConvite] = useState(false)
  const [sucessoConvite, setSucessoConvite] = useState('')
  const [editandoUsuario, setEditandoUsuario] = useState<string|null>(null)
  const [editandoConvite, setEditandoConvite] = useState<string|null>(null)

  useEffect(() => {
    if (organizacao?.id) {
      carregarOrg(organizacao.id)
      carregarVistoriadores(organizacao.id)
      carregarUsuarios(organizacao.id)
    }
  }, [organizacao?.id])

  async function carregarOrg(orgId: string) {
    const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single()
    if (data) setOrg(data)
  }

  async function carregarVistoriadores(orgId: string) {
    const { data } = await supabase.from('vistoriadores').select('*').eq('organization_id', orgId).order('nome')
    if (data) setVistoriadores(data)
  }

  async function carregarUsuarios(orgId: string) {
    const { data: us } = await supabase.from('users').select('*').eq('organization_id', orgId).order('nome')
    if (us) setUsuarios(us)
    const { data: cv } = await supabase.from('convites').select('*').eq('organization_id', orgId).order('created_at', {ascending:false})
    if (cv) setConvites(cv)
  }

  async function salvarOrg(e: React.FormEvent) {
    e.preventDefault()
    if (!organizacao?.id) return
    setSalvandoOrg(true)
    const { error } = await supabase.from('organizations').update(org).eq('id', organizacao.id)
    if (error) {
      alert('Erro: ' + error.message)
      setSalvandoOrg(false)
      return
    }
    setSucessoOrg('Dados salvos!'); setSalvandoOrg(false)
    setTimeout(() => setSucessoOrg(''), 3000)
  }

  async function salvarVistoriador(dados: Record<string,string>) {
    if (!organizacao?.id) return
    const payload = { nome: dados.nome, cpf: dados.cpf||null, crea: dados.crea||null, telefone: dados.telefone||null, email: dados.email||null, organization_id: organizacao.id, ativo: true }
    if (dados.id) { await supabase.from('vistoriadores').update(payload).eq('id', dados.id).eq('organization_id', organizacao.id) }
    else { await supabase.from('vistoriadores').insert([payload]) }
    setFormVist(null); carregarVistoriadores(organizacao.id)
  }

  async function excluirVistoriador(id: string) {
    if (!organizacao?.id) return
    if (!confirm('Excluir vistoriador?')) return
    await supabase.from('vistoriadores').delete().eq('id', id).eq('organization_id', organizacao.id)
    carregarVistoriadores(organizacao.id)
  }

  async function enviarConvite(e: React.FormEvent) {
    e.preventDefault()
    if (!organizacao?.id) return
    setEnviandoConvite(true)
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('convites').insert([{
      organization_id: organizacao.id, email: conviteForm.email,
      perfil: conviteForm.perfil, nome: conviteForm.nome,
      criado_por: userData.user?.id,
    }])
    setSucessoConvite(`Cadastro de ${conviteForm.nome || conviteForm.email} registrado! Agora crie o login no Supabase com o mesmo e-mail.`)
    setConviteForm({ nome: '', email: '', perfil: 'corretor' })
    setShowConvite(false); setEnviandoConvite(false)
    carregarUsuarios(organizacao.id)
    setTimeout(() => setSucessoConvite(''), 6000)
  }

  async function editarConvite(id: string, dados: { nome: string; perfil: string }) {
    if (!organizacao?.id) return
    await supabase.from('convites').update(dados).eq('id', id).eq('organization_id', organizacao.id)
    setEditandoConvite(null)
    carregarUsuarios(organizacao.id)
  }

  async function excluirConvite(id: string, nomeOuEmail: string) {
    if (!organizacao?.id) return
    if (!confirm(`Excluir o cadastro de "${nomeOuEmail}"? Isso não afeta um login já criado no Supabase, apenas o registro pendente aqui.`)) return
    await supabase.from('convites').delete().eq('id', id).eq('organization_id', organizacao.id)
    carregarUsuarios(organizacao.id)
  }

  async function alterarPerfil(userId: string, novoPerfil: string) {
    if (!organizacao?.id) return
    await supabase.from('users').update({ perfil: novoPerfil }).eq('id', userId).eq('organization_id', organizacao.id)
    setEditandoUsuario(null); carregarUsuarios(organizacao.id)
  }

  async function toggleAtivo(u: Usuario) {
    if (!organizacao?.id) return
    await supabase.from('users').update({ ativo: !u.ativo }).eq('id', u.id).eq('organization_id', organizacao.id)
    carregarUsuarios(organizacao.id)
  }

  async function excluirUsuario(u: Usuario) {
    if (!organizacao?.id) return
    if (!confirm(`Remover "${u.nome}" do sistema? O login dele no Supabase Auth NÃO é excluído automaticamente — você precisa removê-lo manualmente lá também, se quiser bloquear o acesso por completo.`)) return
    await supabase.from('users').delete().eq('id', u.id).eq('organization_id', organizacao.id)
    carregarUsuarios(organizacao.id)
  }

  const setOrg_ = (campo: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setOrg(o => ({...o, [campo]: e.target.value}))

  const perfilInfo = (p: string) => perfis.find(x => x.value === p)

  if (!organizacao?.id) {
    return (
      <AppLayout>
        <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6 flex items-center justify-center">
          <span style={{ color: '#8b8d98' }} className="text-sm">Carregando organização...</span>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div style={{ background: '#0d1117', minHeight: '100vh' }} className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto">

          <h1 style={{ color: '#f4f4f3' }} className="text-lg font-medium mb-5">Configurações</h1>

          <div style={{ borderBottom: '0.5px solid #2a2f3a' }} className="flex gap-0 mb-6 overflow-x-auto">
            {[
              { key: 'imobiliaria', label: 'Dados da imobiliária', icon: Building2 },
              { key: 'vistoriadores', label: 'Vistoriadores', icon: Users },
              { key: 'usuarios', label: 'Usuários e perfis', icon: Shield },
            ].map(a => (
              <button key={a.key} onClick={() => setAba(a.key as any)}
                style={aba===a.key ? { borderBottom: '2px solid #2563eb', color: '#5b9bf5' } : { borderBottom: '2px solid transparent', color: '#8b8d98' }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap">
                <a.icon size={14} />{a.label}
              </button>
            ))}
          </div>

          {/* ABA: IMOBILIÁRIA */}
          {aba === 'imobiliaria' && (
            <form onSubmit={salvarOrg}>
              {sucessoOrg && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucessoOrg}</div>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="card lg:col-span-2">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Identidade</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className="label">Nome da imobiliária *</label>
                      <input className="input" value={org.nome||''} onChange={setOrg_('nome')} placeholder="Ex: Echelli Negócios Imobiliários" /></div>
                    <div><label className="label">CNPJ</label>
                      <input className="input" value={org.cnpj||''} onChange={setOrg_('cnpj')} placeholder="00.000.000/0001-00" /></div>
                    <div><label className="label">CRECI</label>
                      <input className="input" value={org.creci||''} onChange={setOrg_('creci')} placeholder="Ex: 12345-F" /></div>
                    <div><label className="label">Responsável técnico</label>
                      <input className="input" value={org.responsavel_nome||''} onChange={setOrg_('responsavel_nome')} /></div>
                    <div><label className="label">CPF do responsável</label>
                      <input className="input" value={org.responsavel_cpf||''} onChange={setOrg_('responsavel_cpf')} /></div>
                  </div>
                </div>
                <div className="card">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Contato</h3>
                  <div className="space-y-3">
                    <div><label className="label">E-mail</label>
                      <input className="input" type="email" value={org.email||''} onChange={setOrg_('email')} /></div>
                    <div><label className="label">Telefone</label>
                      <input className="input" value={org.telefone||''} onChange={setOrg_('telefone')} /></div>
                    <div><label className="label">WhatsApp</label>
                      <input className="input" value={org.whatsapp||''} onChange={setOrg_('whatsapp')} placeholder="(11) 99999-9999" /></div>
                    <div><label className="label">Site</label>
                      <input className="input" value={org.site||''} onChange={setOrg_('site')} /></div>
                    <div><label className="label">Instagram</label>
                      <input className="input" value={org.instagram||''} onChange={setOrg_('instagram')} placeholder="@suaimobiliaria" /></div>
                  </div>
                </div>
                <div className="card">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Endereço</h3>
                  <div className="space-y-3">
                    <div><label className="label">Rua / Avenida</label>
                      <input className="input" value={org.endereco||''} onChange={setOrg_('endereco')} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Número</label>
                        <input className="input" value={org.numero||''} onChange={setOrg_('numero')} /></div>
                      <div><label className="label">Complemento</label>
                        <input className="input" value={org.complemento||''} onChange={setOrg_('complemento')} /></div>
                    </div>
                    <div><label className="label">Bairro</label>
                      <input className="input" value={org.bairro||''} onChange={setOrg_('bairro')} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Cidade</label>
                        <input className="input" value={org.cidade||''} onChange={setOrg_('cidade')} /></div>
                      <div><label className="label">UF</label>
                        <select className="input" value={org.estado||''} onChange={setOrg_('estado')}>
                          <option value="">UF</option>
                          {UFs.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select></div>
                    </div>
                    <div><label className="label">CEP</label>
                      <input className="input" value={org.cep||''} onChange={setOrg_('cep')} /></div>
                  </div>
                </div>
                <div className="card lg:col-span-2">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Logo e aparência nos documentos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="label">Cor principal</label>
                      <div className="flex items-center gap-2">
                        <input type="color" style={{ border: '0.5px solid #2a2f3a' }} className="h-9 w-14 rounded p-0.5" value={org.cor_primaria||'#185FA5'} onChange={setOrg_('cor_primaria')} />
                        <input className="input flex-1" value={org.cor_primaria||'#185FA5'} onChange={setOrg_('cor_primaria')} />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Logo da imobiliária</label>
                      <div className="flex items-center gap-3 mt-1">
                        {org.logo_url && <img src={org.logo_url} alt="Logo" style={{ border: '0.5px solid #2a2f3a' }} className="h-12 object-contain rounded px-2" />}
                        <div>
                          <input type="file" accept="image/*" style={{ color: '#8b8d98' }} className="text-xs"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]; if (!file || !organizacao?.id) return
                              const ext = file.name.split('.').pop()
                              const path = `logos/${organizacao.id}.${ext}`
                              const { data } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
                              if (data) {
                                const { data: url } = supabase.storage.from('documentos').getPublicUrl(path)
                                setOrg(o => ({...o, logo_url: url.publicUrl}))
                              }
                            }} />
                          <p style={{ color: '#5b5e6b' }} className="text-[10px] mt-1">PNG ou JPG recomendado. Aparece em todos os PDFs.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <button type="submit" disabled={salvandoOrg} className="btn btn-primary">
                  <Save size={14} />{salvandoOrg ? 'Salvando...' : 'Salvar dados da imobiliária'}
                </button>
              </div>
            </form>
          )}

          {/* ABA: VISTORIADORES */}
          {aba === 'vistoriadores' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p style={{ color: '#8b8d98' }} className="text-sm">Vistoriadores que realizam os laudos.</p>
                <button className="btn btn-primary btn-sm" onClick={() => setFormVist({id:'',nome:'',cpf:'',crea:'',telefone:'',email:''})}>
                  <Plus size={13} />Novo vistoriador
                </button>
              </div>
              {formVist && formVist.id === '' && (
                <FormVistoriador inicial={formVist} onSalvar={salvarVistoriador} onCancelar={() => setFormVist(null)} />
              )}
              <div className="card p-0 overflow-hidden overflow-x-auto">
                {vistoriadores.length === 0 ? (
                  <div style={{ color: '#8b8d98' }} className="text-center py-10 text-sm">Nenhum vistoriador cadastrado</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                        {['Nome','CPF','CREA','Telefone','E-mail','Status',''].map(h => (
                          <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vistoriadores.map(v => (
                        <tr key={v.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                          {formVist?.id === v.id ? (
                            <td colSpan={7} className="px-4 py-2">
                              <FormVistoriador inicial={formVist} onSalvar={salvarVistoriador} onCancelar={() => setFormVist(null)} />
                            </td>
                          ) : (
                            <>
                              <td style={{ color: '#f4f4f3' }} className="px-4 py-3 font-medium whitespace-nowrap">{v.nome}</td>
                              <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{v.cpf||'—'}</td>
                              <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{v.crea||'—'}</td>
                              <td style={{ color: '#8b8d98' }} className="px-4 py-3 whitespace-nowrap">{v.telefone||'—'}</td>
                              <td style={{ color: '#8b8d98' }} className="px-4 py-3">{v.email||'—'}</td>
                              <td className="px-4 py-3"><span className={`badge ${v.ativo?'badge-green':'badge-gray'}`}>{v.ativo?'Ativo':'Inativo'}</span></td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button className="btn btn-sm" onClick={() => setFormVist({id:v.id,nome:v.nome||'',cpf:v.cpf||'',crea:v.crea||'',telefone:v.telefone||'',email:v.email||''})}>
                                    <Edit2 size={12} />Editar
                                  </button>
                                  <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => excluirVistoriador(v.id)}>
                                    <X size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ABA: USUÁRIOS */}
          {aba === 'usuarios' && (
            <div>
              {sucessoConvite && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-4 py-3 rounded-lg mb-4 text-sm">{sucessoConvite}</div>}

              {/* Passo a passo de como ativar o acesso */}
              <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-xl p-4 mb-5">
                <h3 style={{ color: '#5b9bf5' }} className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Shield size={14} />Como dar acesso a um colaborador
                </h3>
                <ol style={{ color: '#c3c2b7' }} className="text-xs space-y-1.5 list-decimal list-inside">
                  <li>Cadastre o nome, e-mail e perfil dele aqui em "Adicionar usuário"</li>
                  <li>Acesse o Supabase e crie o login (e-mail + senha) com o <strong>mesmo e-mail</strong> cadastrado aqui</li>
                  <li>Informe o e-mail e a senha criada ao colaborador</li>
                  <li>O colaborador poderá depois trocar a própria senha pela tela "Esqueci minha senha" — ele não pode alterar o e-mail/usuário</li>
                </ol>
                <a href={SUPABASE_AUTH_URL} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#5b9bf5' }} className="text-xs font-medium flex items-center gap-1.5 mt-3 hover:underline">
                  <ExternalLink size={12} />Abrir Supabase → Authentication → Add User
                </a>
              </div>

              <div className="card mb-5">
                <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-3">Perfis disponíveis</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {perfis.map(p => (
                    <div key={p.value} style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="text-center p-3 rounded-lg">
                      <span className={`badge ${p.cor} text-xs`}>{p.label}</span>
                      <p style={{ color: '#8b8d98' }} className="text-[10px] mt-1.5">{p.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card mb-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">Usuários com acesso confirmado ({usuarios.length})</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowConvite(!showConvite)}>
                    <UserPlus size={13} />Adicionar usuário
                  </button>
                </div>

                {showConvite && (
                  <form onSubmit={enviarConvite} style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-4 mb-4">
                    <h4 style={{ color: '#5b9bf5' }} className="text-xs font-semibold mb-3">Cadastrar novo usuário</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><label className="label">Nome completo *</label>
                        <input className="input" required value={conviteForm.nome} onChange={e => setConviteForm(f=>({...f,nome:e.target.value}))} placeholder="Nome do usuário" /></div>
                      <div><label className="label">E-mail *</label>
                        <input className="input" type="email" required value={conviteForm.email} onChange={e => setConviteForm(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com" /></div>
                      <div><label className="label">Perfil *</label>
                        <select className="input" value={conviteForm.perfil} onChange={e => setConviteForm(f=>({...f,perfil:e.target.value}))}>
                          {perfis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select></div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button type="submit" disabled={enviandoConvite} className="btn btn-primary btn-sm">
                        <Mail size={12} />{enviandoConvite ? 'Cadastrando...' : 'Cadastrar usuário'}
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setShowConvite(false)}>Cancelar</button>
                    </div>
                  </form>
                )}

                {usuarios.length === 0 ? (
                  <div style={{ color: '#8b8d98' }} className="text-center py-8 text-sm">Nenhum usuário com login confirmado ainda</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '0.5px solid #2a2f3a' }}>
                        {['Nome','E-mail','Perfil','Status',''].map(h => (
                          <th key={h} style={{ color: '#8b8d98' }} className="text-left px-4 py-2 text-xs font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map(u => (
                        <tr key={u.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="hover:bg-[#161b22]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div style={{ background: '#16243a', color: '#5b9bf5' }} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                {u.nome?.slice(0,2).toUpperCase()}
                              </div>
                              <span style={{ color: '#f4f4f3' }} className="font-medium whitespace-nowrap">{u.nome}</span>
                            </div>
                          </td>
                          <td style={{ color: '#8b8d98' }} className="px-4 py-3">{u.email}</td>
                          <td className="px-4 py-3">
                            {editandoUsuario === u.id ? (
                              <select className="input py-1 text-xs" style={{width:'auto'}}
                                defaultValue={u.perfil}
                                onChange={e => alterarPerfil(u.id, e.target.value)}>
                                {perfis.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                              </select>
                            ) : (
                              <span className={`badge ${perfilInfo(u.perfil)?.cor||'badge-gray'}`}>{perfilInfo(u.perfil)?.label||u.perfil}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span style={u.ativo ? { color: '#3fb950' } : { color: '#8b8d98' }} className="flex items-center gap-1 text-xs font-medium whitespace-nowrap">
                              <CheckCircle2 size={12} />{u.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 flex-wrap">
                              <button className="btn btn-sm text-xs" onClick={() => setEditandoUsuario(editandoUsuario===u.id?null:u.id)}>
                                <Edit2 size={11} />Perfil
                              </button>
                              <button className="btn btn-sm text-xs" onClick={() => toggleAtivo(u)}>
                                {u.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                              <button className="btn btn-sm text-xs" style={{ color: '#ef4444' }} onClick={() => excluirUsuario(u)}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {convites.filter(c => !c.usado).length > 0 && (
                <div className="card">
                  <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-1">Cadastrados aqui, aguardando login no Supabase ({convites.filter(c => !c.usado).length})</h3>
                  <p style={{ color: '#8b8d98' }} className="text-xs mb-3">Esses usuários já têm perfil definido, mas ainda não têm e-mail/senha criados no Supabase Auth.</p>
                  <div className="space-y-1">
                    {convites.filter(c => !c.usado).map(c => (
                      <div key={c.id} style={{ borderBottom: '0.5px solid #1c2128' }} className="py-2 last:border-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock size={13} style={{ color: '#f59e0b' }} className="flex-shrink-0" />
                            <div className="min-w-0">
                              <div style={{ color: '#f4f4f3' }} className="text-sm font-medium truncate">{c.nome || c.email}</div>
                              <div style={{ color: '#8b8d98' }} className="text-xs truncate">{c.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`badge ${perfilInfo(c.perfil)?.cor||'badge-gray'}`}>{perfilInfo(c.perfil)?.label||c.perfil}</span>
                            <button className="btn btn-sm text-xs" onClick={() => setEditandoConvite(editandoConvite === c.id ? null : c.id)}>
                              <Edit2 size={11} />
                            </button>
                            <button className="btn btn-sm text-xs" style={{ color: '#ef4444' }} onClick={() => excluirConvite(c.id, c.nome || c.email)}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        {editandoConvite === c.id && (
                          <FormEditarConvite convite={c} onSalvar={editarConvite} onCancelar={() => setEditandoConvite(null)} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
