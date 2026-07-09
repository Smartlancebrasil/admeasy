'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Check, X } from 'lucide-react'

type Plano = {
  id: string
  nome: string
  limite_imoveis: number | null
  preco_mensal: number
  preco_anual_total: number
  taxa_implantacao: number
  taxa_implantacao_parcelas: number
  modulos: string[]
  permite_multiplos_usuarios: boolean
}

// Ordem em que os módulos aparecem na tabela comparativa, com o rótulo em português
const MODULOS_ORDEM: { chave: string; label: string }[] = [
  { chave: 'imoveis', label: 'Cadastro de imóveis' },
  { chave: 'contratos', label: 'Contratos' },
  { chave: 'clientes', label: 'Clientes' },
  { chave: 'financeiro', label: 'Financeiro' },
  { chave: 'portal_locatario', label: 'Portal do locatário' },
  { chave: 'reajuste', label: 'Reajuste de aluguel' },
  { chave: 'rescisao', label: 'Cálculo de rescisão' },
  { chave: 'demandas', label: 'Chamados' },
  { chave: 'dashboard_bi', label: 'Dashboard BI executivo' },
  { chave: 'fornecedores', label: 'Fornecedores' },
  { chave: 'visitas', label: 'Visitas' },
  { chave: 'vistorias', label: 'Vistorias' },
  { chave: 'analise_cadastral', label: 'Análise de locatários' },
  { chave: 'processos_judiciais', label: 'Processos judiciais' },
]

function formatVal(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function CadastroPage() {
  const router = useRouter()
  const [planos, setPlanos] = useState<Plano[]>([])
  const [planoId, setPlanoId] = useState('')
  const [ciclo, setCiclo] = useState<'mensal' | 'anual'>('mensal')
  const [nomeOrg, setNomeOrg] = useState('')
  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregarPlanos() }, [])

  async function carregarPlanos() {
    const { data } = await supabase.from('planos').select('*').order('preco_mensal')
    if (data) {
      setPlanos(data)
      if (data.length > 0) setPlanoId(data[0].id)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!planoId) { setErro('Selecione um plano.'); return }
    if (senha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmarSenha) { setErro('As senhas não coincidem.'); return }

    setEnviando(true)
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano_id: planoId,
          ciclo_cobranca: ciclo,
          nome_organizacao: nomeOrg,
          nome_responsavel: nomeResponsavel,
          email,
          telefone,
          senha,
        }),
      })
      const dados = await res.json()
      if (!res.ok) {
        setErro(dados.erro || 'Não foi possível concluir o cadastro. Tente novamente.')
        setEnviando(false)
        return
      }
      // Cadastro concluído — loga automaticamente e manda pro dashboard
      await supabase.auth.signInWithPassword({ email, password: senha })
      router.push('/dashboard')
    } catch (err: any) {
      setErro('Não foi possível concluir o cadastro. Tente novamente.')
      setEnviando(false)
    }
  }

  const planoSel = planos.find(p => p.id === planoId)

  return (
    <div style={{ background: '#0d1117' }} className="min-h-screen py-10 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <img src="/logo-admeasy.png" alt="AdmEasy" className="w-28 h-auto object-contain mx-auto mb-4" />
          <h1 style={{ color: '#f4f4f3' }} className="text-2xl font-semibold">Comece a usar o Admeasy</h1>
          <p style={{ color: '#8b8d98' }} className="text-sm mt-1">Escolha seu plano e crie sua conta em poucos minutos.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 items-start">

          {/* Coluna esquerda: formulário */}
          <div style={{ background: '#161b22', border: '0.5px solid #2a2f3a' }} className="rounded-2xl p-6 sm:sticky sm:top-10">
            <h2 style={{ color: '#f4f4f3' }} className="text-lg font-semibold mb-5">Crie sua conta</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nome da imobiliária / seu nome comercial *</label>
                <input className="input" required value={nomeOrg} onChange={e => setNomeOrg(e.target.value)} placeholder="Ex: Texas Imóveis" />
              </div>
              <div>
                <label className="label">Seu nome completo *</label>
                <input className="input" required value={nomeResponsavel} onChange={e => setNomeResponsavel(e.target.value)} />
              </div>
              <div>
                <label className="label">E-mail *</label>
                <input type="email" className="input" required value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="label">Telefone / WhatsApp</label>
                <input className="input" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Senha *</label>
                  <input type="password" className="input" required value={senha} onChange={e => setSenha(e.target.value)} />
                </div>
                <div>
                  <label className="label">Confirmar senha *</label>
                  <input type="password" className="input" required value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} />
                </div>
              </div>

              {planoSel && (
                <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a', color: '#8b9ab4' }} className="rounded-lg p-3 text-xs">
                  Você está assinando o plano <strong style={{ color: '#f4f4f3' }}>{planoSel.nome}</strong>, ciclo <strong style={{ color: '#f4f4f3' }}>{ciclo}</strong>.
                </div>
              )}

              {erro && (
                <div style={{ background: '#2e1717', border: '0.5px solid #4a2424', color: '#ef4444' }} className="text-sm px-3 py-2 rounded-lg">
                  {erro}
                </div>
              )}

              <button type="submit" disabled={enviando} className="btn btn-primary w-full justify-center py-2.5">
                {enviando ? 'Criando sua conta...' : 'Criar minha conta'}
              </button>

              <p style={{ color: '#5b5e6b' }} className="text-xs text-center">
                Já tem conta? <a href="/login" style={{ color: '#5b9bf5' }}>Entrar</a>
              </p>
            </form>
          </div>

          {/* Coluna direita: tabela comparativa dos planos, com a mesma altura do formulário */}
          <div className="card p-0 overflow-hidden flex flex-col lg:h-[642px]">
            <div className="flex justify-center py-5 flex-shrink-0">
              <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="inline-flex rounded-lg p-1">
                {(['mensal', 'anual'] as const).map(c => (
                  <button key={c} type="button" onClick={() => setCiclo(c)}
                    style={ciclo === c ? { background: '#2563eb', color: '#fff' } : { background: 'transparent', color: '#8b9ab4' }}
                    className="px-5 py-2 rounded-md text-sm font-medium transition-all">
                    {c === 'mensal' ? 'Mensal' : 'Anual (com desconto)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-auto flex-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th style={{ borderBottom: '0.5px solid #2a2f3a', background: '#161b22' }} className="text-left px-4 py-4 align-bottom w-44 sticky top-0"></th>
                    {planos.map(p => {
                      const sel = p.id === planoId
                      const precoMensalEquivalente = ciclo === 'anual' ? p.preco_anual_total / 12 : p.preco_mensal
                      return (
                        <th key={p.id}
                          className="px-3 py-4 text-center align-bottom min-w-[140px] sticky top-0"
                          style={{ borderBottom: '0.5px solid #2a2f3a', background: sel ? '#16243a' : '#161b22' }}>
                          <button type="button" onClick={() => setPlanoId(p.id)} className="w-full text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-1">
                              {sel && (
                                <span style={{ background: '#2563eb' }} className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Check size={10} color="#fff" />
                                </span>
                              )}
                              <span style={{ color: '#f4f4f3' }} className="font-semibold text-xs sm:text-sm">{p.nome}</span>
                            </div>
                            <div style={{ color: '#8b9ab4' }} className="text-[10px] mb-2">
                              {p.limite_imoveis ? `até ${p.limite_imoveis} imóveis` : 'acima de 50 imóveis'}
                            </div>
                            <div style={{ color: '#f4f4f3' }} className="text-base sm:text-lg font-bold">
                              {formatVal(precoMensalEquivalente)}<span style={{ color: '#8b8d98' }} className="text-[10px] font-normal">/mês</span>
                            </div>
                            <div style={{ color: '#3fb950' }} className="text-[10px] min-h-[14px]">
                              {ciclo === 'anual' ? `${formatVal(p.preco_anual_total)}/ano à vista` : '\u00A0'}
                            </div>
                            <div style={{ color: '#8b9ab4' }} className="text-[10px] mt-1">
                              {p.taxa_implantacao > 0 ? `+ ${formatVal(p.taxa_implantacao)} implantação` : 'Sem implantação'}
                            </div>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '0.5px solid #1c2128' }}>
                    <td style={{ color: '#c3c2b7' }} className="px-4 py-2.5 text-xs whitespace-nowrap">Limite de imóveis</td>
                    {planos.map(p => (
                      <td key={p.id} style={{ color: '#c3c2b7', background: p.id === planoId ? '#16243a' : 'transparent' }} className="px-3 py-2.5 text-xs text-center">
                        {p.limite_imoveis ? `Até ${p.limite_imoveis}` : 'Acima de 50'}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: '0.5px solid #1c2128' }}>
                    <td style={{ color: '#c3c2b7' }} className="px-4 py-2.5 text-xs whitespace-nowrap">Usuários</td>
                    {planos.map(p => (
                      <td key={p.id} style={{ color: '#c3c2b7', background: p.id === planoId ? '#16243a' : 'transparent' }} className="px-3 py-2.5 text-xs text-center">
                        {p.permite_multiplos_usuarios ? 'Vários' : 'Único'}
                      </td>
                    ))}
                  </tr>
                  {MODULOS_ORDEM.map(mod => (
                    <tr key={mod.chave} style={{ borderBottom: '0.5px solid #1c2128' }}>
                      <td style={{ color: '#c3c2b7' }} className="px-4 py-2.5 text-xs whitespace-nowrap">{mod.label}</td>
                      {planos.map(p => {
                        const tem = p.modulos.includes(mod.chave)
                        return (
                          <td key={p.id} style={{ background: p.id === planoId ? '#16243a' : 'transparent' }} className="px-3 py-2.5 text-center">
                            {tem
                              ? <Check size={14} style={{ color: '#3fb950' }} className="mx-auto" />
                              : <X size={14} style={{ color: '#3a3f4a' }} className="mx-auto" />}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
