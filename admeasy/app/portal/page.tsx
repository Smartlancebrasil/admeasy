'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getPortalUser, logoutPortal, alterarSenhaPortal, PortalUser } from '@/lib/portal-auth'
import { supabase } from '@/lib/supabase'
import { LogOut, Key, Plus, X, Upload, ChevronDown, ChevronUp, FileDown, Copy, Check, AlertCircle, QrCode } from 'lucide-react'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function formatVal(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function formatDate(d: string) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(d + 'T00:00:00'))
}
function diasAte(d: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  return Math.ceil((new Date(d + 'T00:00:00').getTime() - hoje.getTime()) / 86400000)
}
function calcularValorAtualizado(valorOriginal: number, dataVencimento: string) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const venc = new Date(dataVencimento + 'T00:00:00')
  const diasAtraso = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86400000))
  if (diasAtraso === 0) return { valorAtualizado: valorOriginal, multa: 0, juros: 0, diasAtraso: 0 }
  const multa = valorOriginal * 0.10
  const juros = valorOriginal * 0.00033 * diasAtraso
  return { valorAtualizado: valorOriginal + multa + juros, multa, juros, diasAtraso }
}

const statusDemanda: Record<string, { label: string; cor: string; bg: string; border: string }> = {
  aberta:             { label: 'Aberta',       cor: '#5b9bf5', bg: '#16243a', border: '#1e3a5f' },
  recebida:           { label: 'Recebida',     cor: '#5b9bf5', bg: '#16243a', border: '#1e3a5f' },
  aguardando_locador: { label: 'Em análise',   cor: '#f59e0b', bg: '#2e2515', border: '#4a3a1f' },
  autorizada:         { label: 'Autorizada',   cor: '#3fb950', bg: '#1a2e1f', border: '#2d4a35' },
  em_execucao:        { label: 'Em execução',  cor: '#a78bfa', bg: '#1e1a2e', border: '#3d2e5f' },
  concluida:          { label: 'Concluída',    cor: '#3fb950', bg: '#1a2e1f', border: '#2d4a35' },
  deferida:           { label: 'Deferida',     cor: '#3fb950', bg: '#1a2e1f', border: '#2d4a35' },
  indeferida:         { label: 'Indeferida',   cor: '#ef4444', bg: '#2e1717', border: '#4a2424' },
}

// ── MODAL BOLETO ──────────────────────────────────────────────────────
function ModalBoleto({ boleto, onFechar }: {
  boleto: { linhaDigitavel: string; urlBoleto: string; qrCodePix: string; qrCodePixBase64: string; valorFinal: number; vencimento: string }
  onFechar: () => void
}) {
  const [copiado, setCopiado] = useState<'boleto' | 'pix' | null>(null)
  const [aba, setAba] = useState<'boleto' | 'pix'>('boleto')

  function copiar(texto: string, tipo: 'boleto' | 'pix') {
    navigator.clipboard.writeText(texto)
    setCopiado(tipo)
    setTimeout(() => setCopiado(null), 2500)
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.8)' }} className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-2xl p-6 w-full max-w-md my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Seu boleto está pronto!</h3>
          <button onClick={onFechar} style={{ color: '#8b9ab4' }}><X size={16} /></button>
        </div>

        <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="rounded-xl p-4 mb-4 text-center">
          <p style={{ color: '#8b9ab4' }} className="text-xs mb-1">Valor a pagar</p>
          <p className="text-white font-bold text-2xl">{formatVal(boleto.valorFinal)}</p>
          <p style={{ color: '#8b9ab4' }} className="text-xs mt-1">Vencimento: {formatDate(boleto.vencimento)}</p>
        </div>

        <div style={{ borderBottom: '0.5px solid #1e3a5f' }} className="flex mb-4">
          {[['boleto', '🏦 Boleto'], ['pix', '⚡ Pix']].map(([k, l]) => (
            <button key={k} onClick={() => setAba(k as any)}
              style={aba === k ? { borderBottom: '2px solid #1A7FFF', color: '#1A7FFF' } : { borderBottom: '2px solid transparent', color: '#8b9ab4' }}
              className="flex-1 py-2 text-sm font-medium">{l}</button>
          ))}
        </div>

        {aba === 'boleto' && (
          <div className="space-y-3">
            <div>
              <p style={{ color: '#8b9ab4' }} className="text-xs mb-2">Linha digitável</p>
              <div style={{ background: '#060D1C', border: '0.5px solid #1e3a5f' }} className="rounded-lg p-3 flex items-center gap-2">
                <p style={{ color: '#f4f4f3' }} className="text-xs font-mono flex-1 break-all">{boleto.linhaDigitavel}</p>
                <button onClick={() => copiar(boleto.linhaDigitavel, 'boleto')} style={{ color: copiado === 'boleto' ? '#3fb950' : '#8b9ab4' }} className="flex-shrink-0">
                  {copiado === 'boleto' ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              {copiado === 'boleto' && <p style={{ color: '#3fb950' }} className="text-xs mt-1">Copiado!</p>}
            </div>
            {boleto.urlBoleto && (
              <a href={boleto.urlBoleto} target="_blank" rel="noopener noreferrer"
                style={{ background: '#1A7FFF' }}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2">
                <FileDown size={15} />Abrir/Imprimir boleto
              </a>
            )}
          </div>
        )}

        {aba === 'pix' && (
          <div className="space-y-3 text-center">
            {boleto.qrCodePixBase64 ? (
              <img src={`data:image/png;base64,${boleto.qrCodePixBase64}`} alt="QR Code Pix" className="w-48 h-48 mx-auto rounded-xl" />
            ) : (
              <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="w-48 h-48 mx-auto rounded-xl flex items-center justify-center">
                <QrCode size={64} style={{ color: '#5b9bf5' }} />
              </div>
            )}
            {boleto.qrCodePix && (
              <div>
                <p style={{ color: '#8b9ab4' }} className="text-xs mb-2">Ou copie o código Pix</p>
                <button onClick={() => copiar(boleto.qrCodePix, 'pix')}
                  style={{ border: '0.5px solid #1e3a5f', color: copiado === 'pix' ? '#3fb950' : '#5b9bf5' }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                  {copiado === 'pix' ? <><Check size={14} />Copiado!</> : <><Copy size={14} />Copiar código Pix</>}
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ color: '#5b5e6b' }} className="text-[10px] text-center mt-4">
          O pagamento pode levar até 3 dias úteis para ser confirmado.
        </p>
      </div>
    </div>
  )
}

// ── MODAL TROCAR SENHA ────────────────────────────────────────────────
function ModalTrocarSenha({ userId, onFechar }: { userId: string; onFechar: () => void }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [erro, setErro] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (nova !== confirma) { setErro('As senhas não coincidem.'); return }
    if (nova.length < 6) { setErro('Mínimo 6 caracteres.'); return }
    setSalvando(true); setErro('')
    const { sucesso, erro: e_ } = await alterarSenhaPortal(userId, atual, nova)
    setSalvando(false)
    if (!sucesso) { setErro(e_ || 'Erro.'); return }
    setMsg('Senha alterada!')
    setTimeout(onFechar, 2000)
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.7)' }} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onFechar}>
      <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-sm">Alterar senha</h3>
          <button onClick={onFechar} style={{ color: '#8b9ab4' }}><X size={16} /></button>
        </div>
        {msg ? <p style={{ color: '#3fb950' }} className="text-sm text-center py-4">{msg}</p> : (
          <form onSubmit={salvar} className="space-y-3">
            {([['Senha atual', atual, setAtual], ['Nova senha', nova, setNova], ['Confirmar nova senha', confirma, setConfirma]] as const).map(([label, val, setter]: any) => (
              <div key={label}>
                <label style={{ color: '#8b9ab4' }} className="block text-xs mb-1">{label}</label>
                <input type="password" required value={val} onChange={e => setter(e.target.value)}
                  style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: '#f4f4f3' }}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none" />
              </div>
            ))}
            {erro && <p style={{ color: '#ef4444' }} className="text-xs">{erro}</p>}
            <button type="submit" disabled={salvando} style={{ background: '#1A7FFF' }} className="w-full py-2 rounded-lg text-white text-sm font-medium">
              {salvando ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── FORMULÁRIO DE DEMANDA ─────────────────────────────────────────────
function FormularioDemanda({ clienteId, contratoId, onSalvar, onFechar }: {
  clienteId: string; contratoId: string; onSalvar: () => void; onFechar: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [urgencia, setUrgencia] = useState('media')
  const [anexos, setAnexos] = useState<{ url: string; nome: string; isImagem: boolean }[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function uploadAnexo(file: File) {
    if (anexos.length >= 5) return
    setUploadando(true)
    const path = `chamados/${ORG_ID}/${Date.now()}_${file.name}`
    const { data } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (data) {
      const { data: url } = supabase.storage.from('documentos').getPublicUrl(path)
      setAnexos(prev => [...prev, { url: url.publicUrl, nome: file.name, isImagem: file.type.startsWith('image/') }])
    }
    setUploadando(false)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) { setErro('Informe o assunto.'); return }
    setSalvando(true)
    const { error } = await supabase.from('demandas').insert([{
      organization_id: ORG_ID, titulo, descricao: descricao || null, urgencia,
      origem: 'locatario', status: 'aberta', contrato_id: contratoId || null,
      locatario_id: clienteId, data_abertura: new Date().toISOString(),
      fotos_chamado: anexos.map(a => a.url),
    }])
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    onSalvar(); onFechar()
  }

  return (
    <div style={{ background: 'rgba(0,0,0,0.7)' }} className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-2xl p-6 w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold">Nova solicitação</h3>
          <button onClick={onFechar} style={{ color: '#8b9ab4' }}><X size={16} /></button>
        </div>
        <form onSubmit={enviar} className="space-y-4">
          <div>
            <label style={{ color: '#8b9ab4' }} className="block text-xs mb-1.5">Assunto *</label>
            <input required value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Torneira com vazamento na cozinha"
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: '#f4f4f3' }}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-gray-600" />
          </div>
          <div>
            <label style={{ color: '#8b9ab4' }} className="block text-xs mb-1.5">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4}
              placeholder="Descreva o problema com detalhes..."
              style={{ background: '#060D1C', border: '0.5px solid #1e3a5f', color: '#f4f4f3' }}
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none placeholder-gray-600 resize-none" />
          </div>
          <div>
            <label style={{ color: '#8b9ab4' }} className="block text-xs mb-2">Urgência</label>
            <div className="flex gap-2">
              {[['baixa','Baixa','#3fb950'],['media','Média','#f59e0b'],['alta','Alta','#ef4444']].map(([v,l,c]) => (
                <button key={v} type="button" onClick={() => setUrgencia(v)}
                  style={urgencia === v ? { background: c+'22', border:`0.5px solid ${c}`, color: c } : { border:'0.5px solid #1e3a5f', color:'#8b9ab4' }}
                  className="flex-1 py-2 rounded-lg text-xs font-medium">{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ color: '#8b9ab4' }} className="block text-xs mb-2">Fotos e documentos ({anexos.length}/5)</label>
            {anexos.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {anexos.map((a, i) => (
                  <div key={i} style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="relative rounded-lg overflow-hidden">
                    {a.isImagem ? <img src={a.url} alt="" className="w-16 h-16 object-cover" />
                      : <div className="w-16 h-16 flex flex-col items-center justify-center"><span className="text-xl">📄</span></div>}
                    <button type="button" onClick={() => setAnexos(prev => prev.filter((_, fi) => fi !== i))}
                      className="absolute top-0.5 right-0.5 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center">
                      <X size={9} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {anexos.length < 5 && (
              <label style={{ border: '1.5px dashed #1e3a5f' }} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl cursor-pointer hover:border-blue-500">
                <Upload size={15} style={{ color: '#8b9ab4' }} />
                <span style={{ color: '#8b9ab4' }} className="text-xs">{uploadando ? 'Enviando...' : 'Clique para anexar'}</span>
                <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAnexo(f); e.target.value = '' }} />
              </label>
            )}
          </div>
          {erro && <p style={{ color: '#ef4444' }} className="text-xs">{erro}</p>}
          <button type="submit" disabled={salvando} style={{ background: '#1A7FFF' }}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50">
            {salvando ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── CARD DEMANDA ──────────────────────────────────────────────────────
function CardDemanda({ d }: { d: any }) {
  const [aberto, setAberto] = useState(false)
  const st = statusDemanda[d.status] || { label: d.status, cor: '#8b9ab4', bg: '#0d1b2e', border: '#1e3a5f' }
  const fotos: string[] = d.fotos_chamado || []
  return (
    <div style={{ background: st.bg, border: `0.5px solid ${st.border}` }} className="rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setAberto(!aberto)}>
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-white text-sm font-medium truncate">{d.titulo}</p>
          <p style={{ color: '#8b9ab4' }} className="text-[10px] mt-0.5">{new Date(d.created_at).toLocaleDateString('pt-BR')} · {d.urgencia}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span style={{ color: st.cor, border: `0.5px solid ${st.border}` }} className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{st.label}</span>
          {aberto ? <ChevronUp size={14} style={{ color: '#8b9ab4' }} /> : <ChevronDown size={14} style={{ color: '#8b9ab4' }} />}
        </div>
      </div>
      {aberto && (
        <div style={{ borderTop: `0.5px solid ${st.border}` }} className="px-4 pb-4 pt-3 space-y-3">
          {d.descricao && <p style={{ color: '#c3c2b7' }} className="text-sm">{d.descricao}</p>}
          {fotos.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {fotos.map((url, i) => <a key={i} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-700" /></a>)}
            </div>
          )}
          {d.resposta_imobiliaria && (
            <div style={{ background: '#0d1117', border: '0.5px solid #2a2f3a' }} className="rounded-lg p-3">
              <p style={{ color: '#8b9ab4' }} className="text-[10px] font-semibold mb-1">Resposta da imobiliária</p>
              <p style={{ color: '#f4f4f3' }} className="text-sm">{d.resposta_imobiliaria}</p>
            </div>
          )}
          {(d.status === 'deferida' || d.status === 'indeferida') && d.justificativa && (
            <div style={{ background: d.status === 'deferida' ? '#1a2e1f' : '#2e1717', border: `0.5px solid ${d.status === 'deferida' ? '#2d4a35' : '#4a2424'}` }} className="rounded-lg p-3">
              <p style={{ color: d.status === 'deferida' ? '#3fb950' : '#ef4444' }} className="text-[10px] font-semibold mb-1">
                {d.status === 'deferida' ? '✅ Deferido' : '❌ Indeferido'} — Justificativa
              </p>
              <p style={{ color: '#c3c2b7' }} className="text-sm">{d.justificativa}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── PAINEL LOCATÁRIO ──────────────────────────────────────────────────
function PainelLocatario({ user }: { user: PortalUser }) {
  const [contrato, setContrato] = useState<any>(null)
  const [cobrancas, setCobrancas] = useState<any[]>([])
  const [demandas, setDemandas] = useState<any[]>([])
  const [clienteData, setClienteData] = useState<any>(null)
  const [aba, setAba] = useState<'contrato' | 'demandas'>('contrato')
  const [modalDemanda, setModalDemanda] = useState(false)
  const [boletoGerado, setBoletoGerado] = useState<any>(null)
  const [gerandoBoleto, setGerandoBoleto] = useState<string | null>(null)
  const [erroBoleto, setErroBoleto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [cont, cob, dem, cli] = await Promise.all([
      supabase.from('contratos').select('*, imovel:imoveis(titulo, endereco, numero, bairro, cidade)').eq('locatario_id', user.cliente_id).in('status', ['ativo', 'pendente']).maybeSingle(),
      supabase.from('cobrancas').select('*').eq('locatario_id', user.cliente_id).order('data_vencimento', { ascending: false }).limit(24),
      supabase.from('demandas').select('*').eq('locatario_id', user.cliente_id).order('created_at', { ascending: false }),
      supabase.from('clientes').select('nome, cpf, email').eq('id', user.cliente_id).single(),
    ])
    if (cont.data) setContrato(cont.data)
    if (cob.data) setCobrancas(cob.data)
    if (dem.data) setDemandas(dem.data)
    if (cli.data) setClienteData(cli.data)
    setLoading(false)
  }

  const imovel = contrato?.imovel ? (Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel) : null

  const statusCor = (st: string, dataVenc: string) => {
    if (st === 'pago') return { cor: '#3fb950', bg: '#1a2e1f', border: '#2d4a35', label: 'Pago' }
    const dias = diasAte(dataVenc)
    if (dias < 0) return { cor: '#ef4444', bg: '#2e1717', border: '#4a2424', label: `Atrasado ${Math.abs(dias)}d` }
    if (dias <= 5) return { cor: '#f59e0b', bg: '#2e2515', border: '#4a3a1f', label: `Vence em ${dias}d` }
    return { cor: '#8b9ab4', bg: '#0d1b2e', border: '#1e3a5f', label: `Vence em ${dias}d` }
  }

  async function gerarBoleto(c: any) {
    setGerandoBoleto(c.id)
    setErroBoleto(null)
    const { valorAtualizado } = calcularValorAtualizado(c.valor_aluguel, c.data_vencimento)
    try {
      const res = await fetch('/api/boleto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valor: c.valor_aluguel,
          valorAtualizado,
          vencimento: c.data_vencimento,
          nomeLocatario: clienteData?.nome || user.nome,
          emailLocatario: clienteData?.email || '',
          cpfLocatario: clienteData?.cpf || '',
          descricao: `Aluguel ${c.mes_referencia || formatDate(c.data_vencimento)} — ${imovel?.titulo || ''}`,
          cobrancaId: c.id,
          mesReferencia: c.mes_referencia,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroBoleto(data.erro || 'Erro ao gerar boleto.')
      } else {
        setBoletoGerado(data)
        // Salva o ID do boleto MP na cobrança
        await supabase.from('cobrancas').update({ mp_payment_id: data.id }).eq('id', c.id)
      }
    } catch (err) {
      setErroBoleto('Erro de conexão. Tente novamente.')
    }
    setGerandoBoleto(null)
  }

  async function gerarReciboPDF(c: any) {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    const W = 210; const ML = 20; const MR = W - 20; let y = 20
    const { data: org } = await supabase.from('organizations').select('nome, cnpj, creci, logo_url').eq('id', ORG_ID).single()
    if (org?.logo_url) { try { doc.addImage(org.logo_url, 'JPEG', ML, y, 24, 12) } catch {} }
    doc.setFontSize(16).setFont('helvetica', 'bold').text('RECIBO DE PAGAMENTO DE ALUGUEL', W/2, y+8, { align: 'center' })
    doc.setFontSize(8).setFont('helvetica', 'normal').text(org?.nome || '', W/2, y+14, { align: 'center' })
    y += 24; doc.setDrawColor(200).line(ML, y, MR, y); y += 8
    const linhas: [string, string][] = [
      ['Locatário:', user.nome],
      ['Imóvel:', imovel ? `${imovel.titulo} — ${imovel.endereco}, ${imovel.numero}` : '—'],
      ['Referência:', c.mes_referencia || formatDate(c.data_vencimento)],
      ['Vencimento:', formatDate(c.data_vencimento)],
      ['Pagamento:', c.data_pagamento ? formatDate(c.data_pagamento) : '—'],
    ]
    doc.setFontSize(9)
    linhas.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold'); doc.text(label, ML, y)
      doc.setFont('helvetica', 'normal')
      const w = doc.splitTextToSize(val, MR-ML-48)
      doc.text(w, ML+46, y); y += w.length * 5.5
    })
    y += 6; doc.setDrawColor(200).line(ML, y, MR, y); y += 8
    doc.setFontSize(13).setFont('helvetica', 'bold').text('Valor recebido:', ML, y)
    doc.setTextColor(0,140,0); doc.text(formatVal(c.valor_aluguel), MR, y, { align: 'right' })
    doc.setTextColor(0)
    doc.setFontSize(7).setTextColor(150).text(`Emitido em ${new Date().toLocaleString('pt-BR')} · CNPJ: ${org?.cnpj || ''} · CRECI: ${org?.creci || ''}`, W/2, 287, { align: 'center' })
    doc.save(`recibo-${c.mes_referencia || c.data_vencimento}.pdf`)
  }

  if (loading) return <div className="text-center py-16" style={{ color: '#8b9ab4' }}>Carregando...</div>

  return (
    <div>
      <div style={{ borderBottom: '0.5px solid #1e3a5f' }} className="flex mb-5 overflow-x-auto">
        {[['contrato','📋 Meu contrato'], ['demandas',`🔧 Solicitações${demandas.length > 0 ? ` (${demandas.length})` : ''}`]].map(([k,l]) => (
          <button key={k} onClick={() => setAba(k as any)}
            style={aba === k ? { borderBottom: '2px solid #1A7FFF', color: '#1A7FFF' } : { borderBottom: '2px solid transparent', color: '#8b9ab4' }}
            className="px-4 py-2.5 text-sm font-medium flex-shrink-0 whitespace-nowrap">{l}</button>
        ))}
      </div>

      {aba === 'contrato' && (
        <div className="space-y-4">
          {contrato ? (
            <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-xl p-4">
              <p style={{ color: '#8b9ab4' }} className="text-xs font-medium mb-3">Dados do contrato</p>
              <div className="grid grid-cols-2 gap-3">
                {[['Imóvel', imovel?.titulo||'—'],['Endereço', imovel?`${imovel.endereco}, ${imovel.numero}`:'—'],['Início', formatDate(contrato.data_inicio)],['Término', formatDate(contrato.data_fim)],['Valor mensal', formatVal(contrato.valor_atual||contrato.valor_mensal)],['Reajuste',(contrato.indice_reajuste||'—').toUpperCase()]].map(([l,v]) => (
                  <div key={l}><p style={{ color: '#8b9ab4' }} className="text-[10px]">{l}</p><p className="text-white text-sm font-medium mt-0.5">{v}</p></div>
                ))}
              </div>
            </div>
          ) : <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-8">Nenhum contrato ativo.</p>}

          {erroBoleto && (
            <div style={{ background: '#2e1717', border: '0.5px solid #4a2424' }} className="rounded-xl p-3 flex items-center gap-2">
              <AlertCircle size={14} style={{ color: '#ef4444' }} />
              <p style={{ color: '#ef4444' }} className="text-sm">{erroBoleto}</p>
            </div>
          )}

          <div>
            <p style={{ color: '#8b9ab4' }} className="text-xs font-medium mb-3">Cobranças</p>
            {cobrancas.length === 0
              ? <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-6">Nenhuma cobrança.</p>
              : <div className="space-y-2">
                  {cobrancas.map(c => {
                    const st = statusCor(c.status_cobranca, c.data_vencimento)
                    const emAtraso = c.status_cobranca !== 'pago' && diasAte(c.data_vencimento) < 0
                    const { valorAtualizado, multa, juros, diasAtraso } = calcularValorAtualizado(c.valor_aluguel, c.data_vencimento)
                    return (
                      <div key={c.id} style={{ background: st.bg, border: `0.5px solid ${st.border}` }} className="rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-white text-sm font-medium">{c.mes_referencia || formatDate(c.data_vencimento)}</p>
                            <p style={{ color: '#8b9ab4' }} className="text-[10px]">Vence: {formatDate(c.data_vencimento)}</p>
                          </div>
                          <div className="text-right">
                            {emAtraso ? (
                              <div>
                                <p style={{ color: '#8b9ab4' }} className="text-[10px] line-through">{formatVal(c.valor_aluguel)}</p>
                                <p className="text-white font-bold">{formatVal(valorAtualizado)}</p>
                              </div>
                            ) : <p className="text-white font-bold">{formatVal(c.valor_aluguel)}</p>}
                            <p style={{ color: st.cor }} className="text-[10px] font-semibold">{st.label}</p>
                          </div>
                        </div>
                        {emAtraso && (
                          <div style={{ background: '#2e1717', border: '0.5px solid #4a2424' }} className="rounded-lg p-2 mb-2 text-[10px]">
                            <div style={{ color: '#f87171' }} className="flex items-center gap-1 font-semibold mb-1"><AlertCircle size={10} />Valor atualizado ({diasAtraso}d de atraso)</div>
                            <div style={{ color: '#fca5a5' }} className="space-y-0.5">
                              <div className="flex justify-between"><span>Valor original</span><span>{formatVal(c.valor_aluguel)}</span></div>
                              <div className="flex justify-between"><span>Multa (10%)</span><span>+ {formatVal(multa)}</span></div>
                              <div className="flex justify-between"><span>Juros ({diasAtraso}d × 0,033%)</span><span>+ {formatVal(juros)}</span></div>
                              <div style={{ color: '#ef4444', borderTop: '0.5px solid #4a2424' }} className="flex justify-between font-bold pt-0.5"><span>Total</span><span>{formatVal(valorAtualizado)}</span></div>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {c.status_cobranca !== 'pago' && (
                            <button onClick={() => gerarBoleto(c)} disabled={gerandoBoleto === c.id}
                              style={{ background: '#1A7FFF' }}
                              className="text-[11px] px-3 py-1.5 rounded-lg text-white flex items-center gap-1.5 disabled:opacity-50">
                              <FileDown size={11} />{gerandoBoleto === c.id ? 'Gerando...' : 'Gerar boleto + Pix'}
                            </button>
                          )}
                          {c.status_cobranca === 'pago' && (
                            <button onClick={() => gerarReciboPDF(c)}
                              style={{ border: '0.5px solid #2d4a35', color: '#3fb950' }}
                              className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                              <FileDown size={11} />Baixar recibo
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </div>
        </div>
      )}

      {aba === 'demandas' && (
        <div>
          <button onClick={() => setModalDemanda(true)} style={{ background: '#1A7FFF' }}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold mb-4 flex items-center justify-center gap-2">
            <Plus size={15} />Nova solicitação
          </button>
          {demandas.length === 0
            ? <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-10">Nenhuma solicitação enviada ainda.</p>
            : <div className="space-y-3">{demandas.map(d => <CardDemanda key={d.id} d={d} />)}</div>
          }
        </div>
      )}

      {modalDemanda && <FormularioDemanda clienteId={user.cliente_id} contratoId={contrato?.id||''} onSalvar={carregar} onFechar={() => setModalDemanda(false)} />}
      {boletoGerado && <ModalBoleto boleto={boletoGerado} onFechar={() => setBoletoGerado(null)} />}
    </div>
  )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────
export default function PortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<PortalUser | null>(null)
  const [org, setOrg] = useState<{ nome: string; logo_url?: string } | null>(null)
  const [modalSenha, setModalSenha] = useState(false)

  useEffect(() => {
    const u = getPortalUser()
    if (!u) { router.push('/portal/login'); return }
    if (u.tipo !== 'locatario') { logoutPortal(); router.push('/portal/login'); return }
    setUser(u)
    supabase.from('organizations').select('nome, logo_url').eq('id', ORG_ID).single().then(({ data }) => { if (data) setOrg(data) })
  }, [])

  if (!user) return null

  return (
    <div style={{ background: '#060D1C', minHeight: '100vh' }}>
      <div style={{ background: '#0d1b2e', borderBottom: '0.5px solid #1e3a5f' }} className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div>{org?.logo_url ? <img src={org.logo_url} alt="" className="h-8 object-contain" /> : <span className="text-white font-bold text-sm">{org?.nome}</span>}</div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div style={{ color: '#f4f4f3' }} className="text-xs font-medium">{user.nome}</div>
            <div style={{ color: '#8b9ab4' }} className="text-[10px]">Locatário</div>
          </div>
          <button onClick={() => setModalSenha(true)} style={{ color: '#8b9ab4' }} className="hover:text-blue-400 transition-colors"><Key size={16} /></button>
          <button onClick={() => { logoutPortal(); router.push('/portal/login') }} style={{ color: '#8b9ab4' }} className="hover:text-red-400 transition-colors"><LogOut size={16} /></button>
        </div>
      </div>
      <div className="max-w-xl mx-auto p-4 pb-12">
        <div className="mb-5 pt-2">
          <h1 className="text-white font-bold text-lg">Olá, {user.nome.split(' ')[0]}!</h1>
          <p style={{ color: '#8b9ab4' }} className="text-sm">Bem-vindo ao seu portal</p>
        </div>
        <PainelLocatario user={user} />
      </div>
      {modalSenha && <ModalTrocarSenha userId={user.id} onFechar={() => setModalSenha(false)} />}
    </div>
  )
}
