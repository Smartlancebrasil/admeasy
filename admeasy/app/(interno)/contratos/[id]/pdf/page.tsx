'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { FileDown, ArrowLeft, Plus, X, Upload, Trash2 } from 'lucide-react'
import Link from 'next/link'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

type Parte = {
  nome: string; cpf: string; rg: string; profissao: string
  estado_civil: string; endereco: string; nacionalidade: string
}

type ClienteCompleto = {
  id: string; nome: string; cpf?: string; rg?: string; profissao?: string
  estado_civil?: string; telefone?: string
  endereco?: string; bairro?: string; cidade?: string; estado?: string
}

type Contrato = {
  id: string; numero: string; tipo: string
  data_inicio: string; data_fim: string
  valor_mensal: number; valor_atual: number; valor_caucao?: number
  valor_condominio?: number; valor_iptu?: number; parcelas_caucao?: number
  valor_seguro_fianca?: number; seguradora_fianca?: string; apolice_fianca?: string
  indice_reajuste: string; tipo_garantia?: string
  imovel?: any; locatario?: any; locador?: any
  locatario_id?: string; locador_id?: string
}

type Org = {
  nome: string; cnpj?: string; creci?: string; endereco?: string
  numero?: string; bairro?: string; cidade?: string; estado?: string
  telefone?: string; email?: string; logo_url?: string
}

type Documento = { nome: string; url: string; tipo: string; created_at: string }

const ESTADO_CIVIL_LABEL: Record<string, string> = {
  solteiro: 'solteiro(a)', casado: 'casado(a)', divorciado: 'divorciado(a)',
  viuvo: 'viúvo(a)', separado: 'separado(a)', uniao_estavel: 'em união estável',
}

function partePadrao(): Parte {
  return { nome: '', cpf: '', rg: '', profissao: '', estado_civil: 'solteiro', endereco: '', nacionalidade: 'brasileiro(a)' }
}

function ModalSelecionarParte({ clientes, titulo, onSelecionar, onCadastrarManual, onFechar }: {
  clientes: ClienteCompleto[]; titulo: string; onSelecionar: (c: ClienteCompleto) => void; onCadastrarManual: () => void; onFechar: () => void
}) {
  const [busca, setBusca] = useState('')
  const termo = busca.toLowerCase()
  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(termo) ||
    (c.cpf || '').includes(termo) ||
    (c.telefone || '').includes(termo)
  )

  return (
    <div style={{ background: 'rgba(0,0,0,0.7)' }} className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onFechar}>
      <div style={{ background: '#0d1b2e', border: '0.5px solid #1e3a5f' }} className="rounded-2xl p-5 w-full max-w-lg my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">Selecionar {titulo}</h3>
          <button onClick={onFechar} style={{ color: '#8b9ab4' }}><X size={16} /></button>
        </div>
        <input
          className="input mb-3"
          autoFocus
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
        />
        <button
          type="button"
          onClick={() => { onCadastrarManual(); onFechar() }}
          style={{ background: '#1A7FFF' }}
          className="w-full py-2.5 rounded-xl text-white text-sm font-semibold mb-3 flex items-center justify-center gap-2"
        >
          <Plus size={14} />Cadastrar novo {titulo.toLowerCase()}
        </button>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }} className="space-y-1.5">
          {filtrados.length === 0 && (
            <p style={{ color: '#8b9ab4' }} className="text-sm text-center py-6">Nenhum cliente encontrado.</p>
          )}
          {filtrados.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onSelecionar(c); onFechar() }}
              style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }}
              className="w-full text-left rounded-xl p-3 hover:opacity-80 transition-opacity"
            >
              <p style={{ color: '#f4f4f3' }} className="text-sm font-medium truncate">{c.nome}</p>
              <p style={{ color: '#8b9ab4' }} className="text-xs truncate">
                {[c.cpf, c.telefone].filter(Boolean).join(' · ') || 'Sem CPF/telefone cadastrado'}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

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

const DIAS_EXTENSO = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte',
  'vinte e um', 'vinte e dois', 'vinte e três', 'vinte e quatro', 'vinte e cinco',
  'vinte e seis', 'vinte e sete', 'vinte e oito', 'vinte e nove', 'trinta', 'trinta e um',
]
const ORDINAIS_EXT = [
  '', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono', 'décimo',
  'décimo primeiro', 'décimo segundo', 'décimo terceiro', 'décimo quarto', 'décimo quinto',
  'décimo sexto', 'décimo sétimo', 'décimo oitavo', 'décimo nono', 'vigésimo',
  'vigésimo primeiro', 'vigésimo segundo', 'vigésimo terceiro', 'vigésimo quarto', 'vigésimo quinto',
  'vigésimo sexto', 'vigésimo sétimo', 'vigésimo oitavo', 'vigésimo nono', 'trigésimo', 'trigésimo primeiro',
]
function diaOrdinalExtenso(dia: number): string {
  return ORDINAIS_EXT[dia] || String(dia)
}

function diaExtenso(dia: number): string {
  return DIAS_EXTENSO[dia] || String(dia)
}

const UNIDADES_EXT = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE_EXT = ['dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZENAS_EXT = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS_EXT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function centenaExtenso(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const resto = n % 100
  if (c > 0) partes.push(CENTENAS_EXT[c])
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES_EXT[resto])
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE_EXT[resto - 10])
    else {
      const d = Math.floor(resto / 10)
      const u = resto % 10
      partes.push(u > 0 ? `${DEZENAS_EXT[d]} e ${UNIDADES_EXT[u]}` : DEZENAS_EXT[d])
    }
  }
  return partes.join(' e ')
}

function numeroExtenso(n: number): string {
  if (n === 0) return 'zero'
  const partes: string[] = []
  const milhoes = Math.floor(n / 1000000)
  const milhares = Math.floor((n % 1000000) / 1000)
  const resto = n % 1000
  if (milhoes > 0) partes.push(milhoes === 1 ? 'um milhão' : `${centenaExtenso(milhoes)} milhões`)
  if (milhares > 0) partes.push(milhares === 1 ? 'mil' : `${centenaExtenso(milhares)} mil`)
  if (resto > 0) partes.push(centenaExtenso(resto))
  return partes.join(' e ')
}

function valorExtenso(val: number): string {
  const inteiros = Math.floor(val)
  const centavos = Math.round((val - inteiros) * 100)
  const inteirosTexto = numeroExtenso(inteiros).toUpperCase()
  const reaisLabel = inteiros === 1 ? 'REAL' : 'REAIS'
  if (centavos > 0) {
    const centavosTexto = numeroExtenso(centavos).toUpperCase()
    const centavosLabel = centavos === 1 ? 'CENTAVO' : 'CENTAVOS'
    return `${inteirosTexto} ${reaisLabel} E ${centavosTexto} ${centavosLabel}`
  }
  return `${inteirosTexto} ${reaisLabel}`
}

function mesesEntre(inicio: string, fim: string): number {
  const i = new Date(inicio + 'T00:00:00')
  const f = new Date(fim + 'T00:00:00')
  return Math.round((f.getTime() - i.getTime()) / (1000 * 60 * 60 * 24 * 30))
}

function dataExtenso(dateStr: string): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
}

function mesPorExtenso(dateStr: string): string {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const d = new Date(dateStr + 'T12:00:00')
  return meses[d.getMonth()]
}

export default function ContratoPdfPage() {
  const params = useParams()
  const contratoId = params?.id as string
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [uploadando, setUploadando] = useState(false)
  const [sucesso, setSucesso] = useState('')

  // Partes
  const [locadores, setLocadores] = useState<Parte[]>([partePadrao()])
  const [locatarios, setLocatarios] = useState<Parte[]>([partePadrao()])
  const [fiadores, setFiadores] = useState<Parte[]>([partePadrao()])
  const [clientesTodos, setClientesTodos] = useState<ClienteCompleto[]>([])
  const [modalSelecionarParte, setModalSelecionarParte] = useState<{ tipo: 'Locador' | 'Locatário' | 'Fiador'; index: number } | null>(null)

  // Dados extras do contrato
  const [valorCondominio, setValorCondominio] = useState('')
  const [valorIptu, setValorIptu] = useState('')
  const [parcelasCaucao, setParcelasCaucao] = useState('1')
  const [editandoParcelamento, setEditandoParcelamento] = useState(false)
  const [pixLocador, setPixLocador] = useState('')
  const [formaRecebimento, setFormaRecebimento] = useState<'pix' | 'transferencia'>('pix')
  const [bancoLocador, setBancoLocador] = useState('')
  const [agenciaLocador, setAgenciaLocador] = useState('')
  const [contaLocador, setContaLocador] = useState('')
  const [numApoliceIncendio, setNumApoliceIncendio] = useState('')
  const [valorApoliceIncendio, setValorApoliceIncendio] = useState('')
  const [numApoliceSeguroFianca, setNumApoliceSeguroFianca] = useState('')
  const [valorApoliceSeguroFianca, setValorApoliceSeguroFianca] = useState('')
  const [descricaoImovel, setDescricaoImovel] = useState('')
  const [numeroAguaImovel, setNumeroAguaImovel] = useState('')
  const [numeroEnergiaImovel, setNumeroEnergiaImovel] = useState('')
  const [foro, setForo] = useState('Santana, São Paulo, SP')
  const [moradores, setMoradores] = useState('')

  useEffect(() => { carregar() }, [contratoId])

  async function carregar() {
    setLoading(true)
    const { data: c } = await supabase
      .from('contratos')
      .select('*, imovel:imoveis(*), locatario:clientes!contratos_locatario_id_fkey(*), locador:clientes!contratos_locador_id_fkey(*)')
      .eq('id', contratoId).single()

    if (c) {
      setContrato(c)
      const imovelDados = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
      // Condomínio e IPTU: usa o que estiver salvo no contrato; se estiver
      // zerado/vazio, cai pro que está cadastrado no imóvel (IPTU anual → mensal)
      // Condomínio e IPTU: sempre vêm do cadastro do imóvel (fonte da verdade).
      // Não usamos mais o que estiver salvo direto no contrato porque contratos
      // antigos podem ter valores legados de antes da correção do cálculo.
      if (imovelDados?.valor_condominio != null) {
        setValorCondominio(String(imovelDados.valor_condominio))
      } else if (c.valor_condominio) {
        setValorCondominio(String(c.valor_condominio))
      }
      if (imovelDados?.valor_iptu != null) {
        setValorIptu(String(imovelDados.valor_iptu))
      } else if (c.valor_iptu) {
        setValorIptu(String(c.valor_iptu))
      }
      // Apólice do seguro fiança: vem do próprio contrato, se cadastrada lá
      if (c.apolice_fianca) setNumApoliceSeguroFianca(c.apolice_fianca)
      if (c.valor_seguro_fianca) setValorApoliceSeguroFianca(String(c.valor_seguro_fianca))
      // Pré-preencher locador com dados do cliente
      const loc = Array.isArray(c.locador) ? c.locador[0] : c.locador
      const locat = Array.isArray(c.locatario) ? c.locatario[0] : c.locatario
      if (loc) {
        setLocadores([{
          nome: loc.nome || '', cpf: loc.cpf || '', rg: loc.rg || '',
          profissao: loc.profissao || '', estado_civil: loc.estado_civil || 'solteiro',
          endereco: [loc.endereco, loc.numero, loc.bairro, loc.cidade].filter(Boolean).join(', '),
          nacionalidade: loc.nacionalidade || 'brasileiro(a)',
        }])
        if (loc.chave_pix) setPixLocador(loc.chave_pix)
      }
      if (locat) setLocatarios([{
        nome: locat.nome || '', cpf: locat.cpf || '', rg: locat.rg || '',
        profissao: locat.profissao || '', estado_civil: locat.estado_civil || 'solteiro',
        endereco: [locat.endereco, locat.numero, locat.bairro, locat.cidade].filter(Boolean).join(', '),
        nacionalidade: locat.nacionalidade || 'brasileiro(a)',
      }])
      // Descrição do imóvel, sempre montada a partir do cadastro (endereço, tipo, instalações)
      const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
      if (im) {
        const tiposLabel: Record<string, string> = {
          apartamento: 'apartamento', casa: 'casa', sala_comercial: 'sala comercial', salao_comercial: 'salão comercial',
          loja: 'loja', galpao: 'galpão', terreno: 'terreno', rural: 'imóvel rural',
        }
        let desc = `${tiposLabel[im.tipo] || 'imóvel'} situado à ${im.endereco || ''}, ${im.numero || ''}${im.complemento ? `, ${im.complemento}` : ''}, ${im.bairro || ''}, CEP ${im.cep || ''}, ${im.cidade || ''}/${im.estado || ''}`
        if (im.descricao) desc += `. ${im.descricao}`
        setDescricaoImovel(desc)

        // Instalações de água/energia: sempre vêm direto do cadastro do imóvel,
        // atualizadas na hora — não ficam presas a uma descrição salva antiga
        setNumeroAguaImovel(im.numero_instalacao_agua || '')
        setNumeroEnergiaImovel(im.numero_instalacao_energia || '')
      }
      // Parcelamento da caução já escolhido no cadastro do contrato
      if (c.parcelas_caucao) setParcelasCaucao(String(c.parcelas_caucao))

      // Restaura dados de qualificação salvos anteriormente nesta tela (sobrescreve os defaults acima)
      const dq = c.dados_qualificacao
      if (dq) {
        if (dq.locadores?.length) setLocadores(dq.locadores)
        if (dq.locatarios?.length) setLocatarios(dq.locatarios)
        if (dq.fiadores?.length) setFiadores(dq.fiadores)
        if (dq.valorCondominio !== undefined) setValorCondominio(dq.valorCondominio)
        if (dq.valorIptu !== undefined) setValorIptu(dq.valorIptu)
        if (dq.parcelasCaucao !== undefined) setParcelasCaucao(dq.parcelasCaucao)
        if (dq.pixLocador !== undefined) setPixLocador(dq.pixLocador)
        if (dq.formaRecebimento !== undefined) setFormaRecebimento(dq.formaRecebimento)
        if (dq.bancoLocador !== undefined) setBancoLocador(dq.bancoLocador)
        if (dq.agenciaLocador !== undefined) setAgenciaLocador(dq.agenciaLocador)
        if (dq.contaLocador !== undefined) setContaLocador(dq.contaLocador)
        if (dq.numApoliceIncendio !== undefined) setNumApoliceIncendio(dq.numApoliceIncendio)
        if (dq.valorApoliceIncendio !== undefined) setValorApoliceIncendio(dq.valorApoliceIncendio)
        if (dq.numApoliceSeguroFianca !== undefined) setNumApoliceSeguroFianca(dq.numApoliceSeguroFianca)
        if (dq.valorApoliceSeguroFianca !== undefined) setValorApoliceSeguroFianca(dq.valorApoliceSeguroFianca)
        if (dq.descricaoImovel) setDescricaoImovel(dq.descricaoImovel)
        if (dq.foro) setForo(dq.foro)
        if (dq.moradores !== undefined) setMoradores(dq.moradores)
      }
    }

    const { data: o } = await supabase.from('organizations').select('*').eq('id', ORG_ID).single()
    if (o) setOrg(o)

    const { data: todosClientes } = await supabase
      .from('clientes')
      .select('id, nome, cpf, rg, profissao, estado_civil, telefone, endereco, bairro, cidade, estado')
      .order('nome')
    if (todosClientes) setClientesTodos(todosClientes)

    // Carregar documentos
    await carregarDocumentos()
    setLoading(false)
  }

  async function carregarDocumentos() {
    const { data } = await supabase.from('lancamentos')
      .select('id, descricao, data_lancamento')
      .eq('contrato_id', contratoId)
      .eq('categoria', 'documento')
      .order('data_lancamento', { ascending: false })
    // Buscar documentos do storage
    const { data: files } = await supabase.storage.from('documentos').list(`contratos/${contratoId}`)
    if (files) {
      const docs = files.map(f => ({
        nome: f.name,
        url: supabase.storage.from('documentos').getPublicUrl(`contratos/${contratoId}/${f.name}`).data.publicUrl,
        tipo: f.name.split('.').pop() || '',
        created_at: f.created_at || '',
      }))
      setDocumentos(docs)
    }
  }

  async function uploadDocumento(file: File) {
    setUploadando(true)
    const path = `contratos/${contratoId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (!error) {
      setSucesso('Documento enviado!')
      setTimeout(() => setSucesso(''), 3000)
      carregarDocumentos()
    }
    setUploadando(false)
  }

  async function excluirDocumento(nome: string) {
    if (!confirm('Excluir este documento?')) return
    await supabase.storage.from('documentos').remove([`contratos/${contratoId}/${nome}`])
    carregarDocumentos()
  }

  function setParte(arr: Parte[], setArr: (v: Parte[]) => void, idx: number, campo: keyof Parte, valor: string) {
    setArr(arr.map((p, i) => i === idx ? { ...p, [campo]: valor } : p))
  }

  function renderPartes(partes: Parte[], setPartes: (v: Parte[]) => void, titulo: string) {
    return (
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">{titulo}</h3>
          <button type="button" onClick={() => setModalSelecionarParte({ tipo: titulo as 'Locador' | 'Locatário' | 'Fiador', index: -1 })}
            style={{ color: '#5b9bf5', border: '0.5px solid #1e3a5f' }} className="btn btn-sm">
            <Plus size={12} />Adicionar {titulo.toLowerCase()}
          </button>
        </div>
        {partes.map((p, i) => (
          <div key={i} style={i > 0 ? { borderTop: '0.5px solid #1e3a5f', paddingTop: '1rem', marginTop: '1rem' } : {}}>
            <div className="flex items-center justify-between mb-2">
              <span style={{ color: '#8b9ab4' }} className="text-xs font-medium">{partes.length > 1 ? `${titulo} ${i + 1}` : titulo}</span>
              <div className="flex items-center gap-3">
                {!p.nome && (
                  <button type="button" onClick={() => setModalSelecionarParte({ tipo: titulo as 'Locador' | 'Locatário' | 'Fiador', index: i })}
                    style={{ color: '#5b9bf5' }} className="text-xs font-medium hover:underline">
                    Selecionar da lista
                  </button>
                )}
                {partes.length > 1 && (
                  <button onClick={() => setPartes(partes.filter((_, pi) => pi !== i))}
                    style={{ color: '#8b9ab4' }} className="hover:text-red-500"><X size={13} /></button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Nome completo *</label>
                <input className="input" value={p.nome} onChange={e => setParte(partes, setPartes, i, 'nome', e.target.value)} /></div>
              <div><label className="label">Nacionalidade</label>
                <input className="input" value={p.nacionalidade} onChange={e => setParte(partes, setPartes, i, 'nacionalidade', e.target.value)} /></div>
              <div><label className="label">Estado civil</label>
                <select className="input" value={p.estado_civil} onChange={e => setParte(partes, setPartes, i, 'estado_civil', e.target.value)}>
                  {[
                    ['solteiro', 'Solteiro(a)'], ['casado', 'Casado(a)'], ['divorciado', 'Divorciado(a)'],
                    ['viuvo', 'Viúvo(a)'], ['separado', 'Separado(a)'], ['uniao_estavel', 'União estável'],
                  ].map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
                </select></div>
              <div><label className="label">Profissão</label>
                <input className="input" value={p.profissao} onChange={e => setParte(partes, setPartes, i, 'profissao', e.target.value)} /></div>
              <div><label className="label">RG</label>
                <input className="input" value={p.rg} onChange={e => setParte(partes, setPartes, i, 'rg', e.target.value)} /></div>
              <div><label className="label">CPF</label>
                <input className="input" value={p.cpf} onChange={e => setParte(partes, setPartes, i, 'cpf', e.target.value)} /></div>
              <div className="col-span-2"><label className="label">Endereço completo</label>
                <input className="input" value={p.endereco} onChange={e => setParte(partes, setPartes, i, 'endereco', e.target.value)} placeholder="Rua, número, bairro, cidade/UF, CEP" /></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  async function gerarPdf() {
    if (!contrato || !org) return
    setGerandoPdf(true)

    // Salva os dados de qualificação editados nesta tela, para não se perderem
    const { error: erroSalvar } = await supabase.from('contratos').update({
      dados_qualificacao: {
        locadores, locatarios, fiadores,
        valorCondominio, valorIptu, parcelasCaucao, pixLocador,
        formaRecebimento, bancoLocador, agenciaLocador, contaLocador,
        numApoliceIncendio, valorApoliceIncendio, numApoliceSeguroFianca, valorApoliceSeguroFianca,
        descricaoImovel, foro, moradores,
      },
    }).eq('id', contratoId)

    if (erroSalvar) {
      alert('Não foi possível salvar a qualificação antes de gerar o PDF: ' + erroSalvar.message + '\n\nO PDF vai gerar normalmente, mas os dados desta tela não vão ficar salvos para a próxima vez. Confirme se rodou a migração SQL mais recente no Supabase (coluna dados_qualificacao).')
    }

    const tituloTipo: Record<string, string> = {
      locacao_residencial: 'LOCAÇÃO RESIDENCIAL',
      locacao_comercial: 'LOCAÇÃO COMERCIAL',
      compra_venda: 'COMPRA E VENDA',
    }
    const tituloContrato = tituloTipo[contrato.tipo] || 'LOCAÇÃO'

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const W = 210
    const ML = 20
    const MR = W - 20
    const CW = MR - ML
    let y = 20
    let pagNum = 1

    function addRodape() {
      doc.setFontSize(7).setTextColor(130)
      doc.text(`${org!.nome} — CNPJ: ${org!.cnpj || ''} — CRECI: ${org!.creci || ''}`, W / 2, 288, { align: 'center' })
      doc.text(`Página ${pagNum}`, MR, 288, { align: 'right' })
      doc.setTextColor(0)
    }

    function novaPag() {
      addRodape(); doc.addPage(); pagNum++; y = 20
    }

    function checkY(n: number) { if (y + n > 275) novaPag() }

    function titulo(texto: string) {
      checkY(12)
      doc.setFontSize(9).setFont('helvetica', 'bold')
      doc.setFillColor(240, 240, 240)
      doc.rect(ML, y - 3, CW, 7, 'F')
      doc.text(texto, W / 2, y + 1, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      y += 9
    }

    function clausula(num: string, texto: string) {
      const numLinhas = doc.splitTextToSize(texto, CW).length
      checkY(numLinhas * 5 + 8)
      doc.setFontSize(9).setFont('helvetica', 'bold')
      doc.text(`CLÁUSULA ${num} –`, ML, y)
      y += 5
      doc.setFont('helvetica', 'normal')
      doc.text(texto, ML, y, { maxWidth: CW, align: 'justify' })
      y += numLinhas * 5
      y += 2
    }

    function paragrafo(texto: string, negrito = false) {
      const numLinhas = doc.splitTextToSize(texto, CW).length
      checkY(numLinhas * 5 + 3)
      doc.setFontSize(9).setFont('helvetica', negrito ? 'bold' : 'normal')
      doc.text(texto, ML, y, { maxWidth: CW, align: negrito ? 'left' : 'justify' })
      y += numLinhas * 5
      y += 1
      doc.setFont('helvetica', 'normal')
    }

    // Negrita só o rótulo "PARÁGRAFO ... :" ou "PARÁGRAFO ... –", deixando o resto do texto normal
    function paragrafoRotulo(texto: string) {
      const match = texto.match(/^(PARÁGRAFO[^:–]*[:–])\s*(.*)$/s)
      if (!match) { paragrafo(texto, false); return }
      const [, rotulo, resto] = match
      doc.setFontSize(9).setFont('helvetica', 'bold')
      const rotuloLinhas = doc.splitTextToSize(rotulo, CW)
      const larguraRotulo = doc.getTextWidth(rotuloLinhas[0])
      doc.setFont('helvetica', 'normal')
      const restoNaMesmaLinha = doc.splitTextToSize(resto, CW - larguraRotulo - 2)[0] || ''
      const restoRestante = resto.slice(restoNaMesmaLinha.length).trim()
      const numLinhasRestante = restoRestante ? doc.splitTextToSize(restoRestante, CW).length : 0
      checkY(5 + numLinhasRestante * 5 + 3)
      doc.setFont('helvetica', 'bold')
      doc.text(rotulo, ML, y)
      doc.setFont('helvetica', 'normal')
      doc.text(restoNaMesmaLinha, ML + larguraRotulo + 1.5, y)
      y += 5
      if (restoRestante) {
        doc.text(restoRestante, ML, y, { maxWidth: CW, align: 'justify' })
        y += numLinhasRestante * 5
      }
      y += 1
    }

    // ── CABEÇALHO ──
    if (org.logo_url) {
      try {
        const ext = org.logo_url.split('.').pop()?.toLowerCase().split('?')[0]
        const formato = ext === 'png' ? 'PNG' : ext === 'webp' ? 'WEBP' : 'JPEG'
        const logoW = 30
        const logoH = 16
        doc.addImage(org.logo_url, formato, (W - logoW) / 2, y, logoW, logoH)
        y += logoH + 9
      } catch {}
    }
    doc.setFontSize(16).setFont('helvetica', 'bold')
    doc.text(`CONTRATO DE ${tituloContrato}`, W / 2, y, { align: 'center' })
    y += 10

    doc.setDrawColor(0).line(ML, y, MR, y); y += 6

    // Qualificação locadores
    titulo('DO LOCADOR')
    locadores.forEach((l, i) => {
      const qualif = `${l.nome.toUpperCase()}, ${l.nacionalidade}, ${ESTADO_CIVIL_LABEL[l.estado_civil] || l.estado_civil}, ${l.profissao}, portador(a) da Cédula de identidade RG nº ${l.rg} e inscrito(a) no CPF/MF sob nº ${l.cpf}, residente e domiciliado(a) à ${l.endereco}, doravante denominado(a) LOCADOR(A).`
      paragrafo(qualif)
    })
    y += 2

    // Qualificação locatários
    titulo('DO LOCATÁRIO')
    locatarios.forEach((l, i) => {
      const qualif = `${l.nome.toUpperCase()}, ${l.nacionalidade}, ${ESTADO_CIVIL_LABEL[l.estado_civil] || l.estado_civil}, ${l.profissao}, portador(a) da Cédula de identidade RG nº ${l.rg} e inscrito(a) no CPF sob nº ${l.cpf}, residente e domiciliado(a) à ${l.endereco}, doravante denominado(a) LOCATÁRIO(A).`
      paragrafo(qualif)
    })
    if (moradores) {
      paragrafo(`MORADORES ADICIONAIS: ${moradores}`)
    }
    y += 2

    paragrafo('Têm entre si contratado, pelo presente instrumento e na melhor forma de direito, a locação do imóvel abaixo referido, sob as cláusulas e condições seguintes:')
    y += 2

    // Imóvel
    titulo('IMÓVEL OBJETO DA LOCAÇÃO')
    paragrafo(`O imóvel objeto do presente instrumento: ${descricaoImovel}.`)
    paragrafo('Ficam os LOCATÁRIO(A) cientificados de que deverão proceder à ligação e transferência junto à SABESP (água) e ENEL (Luz) imediatamente, após assinatura deste instrumento e antes de ter posse das chaves do imóvel, sob pena de ter o fornecimento do serviço interrompido.')
    paragrafo('A NÃO TRANSFERÊNCIA SERÁ CONSIDERADA INFRAÇÃO CONTRATUAL.', true)
    paragrafo(`Instalação SABESP nº ${numeroAguaImovel || '_______________'}`)
    paragrafo(`Instalação ENEL nº ${numeroEnergiaImovel || '_______________'}`)
    y += 2

    // Prazos
    const meses = mesesEntre(contrato.data_inicio, contrato.data_fim)
    titulo('DOS PRAZOS')
    clausula('1ª', `A presente locação é pelo prazo de ${meses} (${meses === 30 ? 'trinta' : meses} meses), a contar do dia ${dataExtenso(contrato.data_inicio)} e término em ${dataExtenso(contrato.data_fim)}.`)
    clausula('2ª', `Vencido o prazo mencionado na CLÁUSULA 1ª e, pretendendo os LOCATÁRIOS entregarem as chaves do imóvel, deverão dar ciência à LOCADORA, POR ESCRITO, e com antecedência mínima de 30 (Trinta) dias de sua deliberação, ficando de qualquer modo, obrigados ao pagamento do aluguel e encargos até a efetiva rescisão do contrato.`)
    const dataInicioObj = new Date(contrato.data_inicio + 'T00:00:00')
    const diaInicioMes = dataInicioObj.getDate()
    clausula('3ª', `A locação não iniciada no ${diaInicioMes}º (${diaOrdinalExtenso(diaInicioMes)}) dia do mês terá o acerto dos dias decorridos até o final do mesmo, se houver.`)

    // Aluguel
    titulo('DO ALUGUEL')
    const valorMensal = contrato.valor_atual || contrato.valor_mensal
    const diaVencimento = new Date(contrato.data_inicio + 'T00:00:00').getDate()
    let textoAluguel = `O aluguel mensal inicial é de ${formatVal(valorMensal)} (${valorExtenso(valorMensal)}), ficando ainda a cargo dos LOCATÁRIOS os demais encargos da locação`
    if (valorCondominio) textoAluguel += `, o condomínio no valor de ${formatVal(parseFloat(valorCondominio))} (${valorExtenso(parseFloat(valorCondominio))})`
    if (valorIptu) textoAluguel += `, IPTU no valor de ${formatVal(parseFloat(valorIptu))}`
    textoAluguel += `, devendo ser pagos até o dia ${diaVencimento} (${diaExtenso(diaVencimento)}) do mês subsequente ao vencido, diretamente à ${org.nome}, na qualidade de ADMINISTRADORA, CNPJ: ${org.cnpj || ''}, CRECI ${org.creci || ''}, estabelecida à ${org.endereco || ''}, ${org.numero || ''} – ${org.bairro || ''} – ${org.cidade || ''}, através de boleto bancário, que posteriormente será repassado ao LOCADOR.`
    clausula('4ª', textoAluguel)
    paragrafoRotulo(`PARÁGRAFO PRIMEIRO: O aluguel será reajustado anualmente na exata proporção da variação acumulada do Índice ${contrato.indice_reajuste?.toUpperCase() || 'IGP-M'}.`)
    paragrafoRotulo(`PARÁGRAFO SEGUNDO: Esse mesmo critério de reajuste será sempre observado, independentemente de aviso ou interpelação, a cada período de 12 (doze) meses até quando finda ou rescinda a locação.`)
    paragrafoRotulo(`PARÁGRAFO TERCEIRO: Em caso de variação negativa do índice adotado, o valor do aluguel será mantido, não sendo aplicado qualquer decréscimo.`)
    clausula('5ª', `Os aluguéis que não forem pagos na data do vencimento terão acréscimo de 10% (DEZ POR CENTO) DE MULTA e, mais 2% (DOIS POR CENTO) AO MÊS DE JUROS DE MORA e ficarão sujeitos a correção monetária, com base na variação do IPCA do IBGE.`)
    clausula('6ª', `Os aluguéis em atraso por mais de 30 (trinta) dias serão encaminhados ao Departamento Jurídico, ficando os LOCATÁRIOS sujeitos a todas as penalidades legais e contratuais, bem como à obrigação de ressarcir integralmente o LOCADOR por quaisquer despesas judiciais ou extrajudiciais.`)

    // Garantia
    titulo('DA GARANTIA')
    const caucaoVal = contrato.valor_caucao || 0
    const parcelasNum = parseInt(parcelasCaucao) || 1
    if (contrato.tipo_garantia === 'fiador') {
      const f = fiadores[0]
      if (f?.nome) {
        const fiadoresTexto = fiadores
          .filter(fi => fi.nome)
          .map((fi, i) => `${fi.nome.toUpperCase()}, ${fi.nacionalidade}, ${ESTADO_CIVIL_LABEL[fi.estado_civil] || fi.estado_civil}, ${fi.profissao}, portador(a) do RG nº ${fi.rg} e inscrito(a) no CPF sob nº ${fi.cpf}, residente à ${fi.endereco}`)
          .join('; e ')
        clausula('7ª', `O presente contrato será garantido por fiança, prestada por ${fiadoresTexto}, doravante denominado(a) ${fiadores.length > 1 ? 'FIADORES' : 'FIADOR(A)'}, que se responsabiliza(m) solidária e integralmente por todas as obrigações assumidas pelos LOCATÁRIOS neste contrato, inclusive aluguéis, encargos, multas e demais despesas, até a efetiva entrega das chaves.`)
      } else {
        clausula('7ª', `O presente contrato será garantido por fiança, cujo(s) fiador(es) responsabiliza(m)-se solidária e integralmente por todas as obrigações assumidas pelos LOCATÁRIOS neste contrato, conforme qualificação a ser anexada a este instrumento.`)
      }
    } else if (contrato.tipo_garantia === 'titulo_capitalizacao') {
      clausula('7ª', `O presente contrato será garantido por título de capitalização, vinculado em favor do LOCADOR pelo valor correspondente a, no mínimo, ${caucaoVal > 0 ? formatVal(caucaoVal) : '3 (três) aluguéis'}, permanecendo caução até a efetiva entrega das chaves e quitação de todas as obrigações do presente contrato.`)
    } else if (contrato.tipo_garantia === 'seguro_fianca' && numApoliceSeguroFianca) {
      clausula('7ª', `O presente contrato será garantido por seguro fiança, Apólice nº ${numApoliceSeguroFianca}, no valor de ${valorApoliceSeguroFianca ? formatVal(parseFloat(valorApoliceSeguroFianca)) : 'conforme apólice'}.`)
    } else if (contrato.tipo_garantia === 'caucao' || !contrato.tipo_garantia) {
      if (caucaoVal > 0) {
        let textoCaucao = `Fica acordado que o presente contrato será garantido por meio de caução no valor de ${formatVal(caucaoVal)} (${valorExtenso(caucaoVal)})`
        if (parcelasNum > 1) {
          const parcVal = caucaoVal / parcelasNum
          textoCaucao += `, a ser pago em ${parcelasNum} (${parcelasNum === 2 ? 'duas' : parcelasNum === 3 ? 'três' : parcelasNum === 4 ? 'quatro' : 'cinco'}) parcelas de ${formatVal(parcVal)}`
          // Calcular datas das parcelas
          const datas = []
          for (let i = 0; i < parcelasNum; i++) {
            const d = new Date(contrato.data_inicio + 'T00:00:00')
            d.setMonth(d.getMonth() + i)
            datas.push(d.toLocaleDateString('pt-BR'))
          }
          textoCaucao += `, com vencimentos em: ${datas.join(', ')}`
        } else {
          textoCaucao += `, a ser pago à vista`
        }
        if (formaRecebimento === 'pix' && pixLocador) {
          textoCaucao += `, através de transferência via PIX: ${pixLocador} em nome de ${locadores[0]?.nome || 'LOCADOR'}`
        } else if (formaRecebimento === 'transferencia' && (bancoLocador || contaLocador)) {
          textoCaucao += `, através de transferência bancária para: Banco ${bancoLocador || '____'}, Agência ${agenciaLocador || '____'}, Conta ${contaLocador || '____'}, em nome de ${locadores[0]?.nome || 'LOCADOR'}`
        }
        textoCaucao += `.`
        clausula('7ª', textoCaucao)
      }
    }

    // Obrigações locatários
    titulo('DAS OBRIGAÇÕES DOS LOCATÁRIOS')
    clausula('8ª', `Os LOCATÁRIOS obrigam-se pela mais perfeita conservação do imóvel locado, mantendo-o sempre em perfeitas condições de habitabilidade, respondendo por todos os prejuízos provenientes de qualquer estrago ou má conservação.`)
    clausula('9ª', `Os LOCATÁRIOS ficam obrigados a servir-se do imóvel para o uso convencionado, qual seja sua residência e de sua família, não podendo cedê-lo ou sublocá-lo no todo ou em parte, nem transferir o presente contrato sem autorização expressa e por escrito do LOCADOR.`)
    clausula('10ª', `Os LOCATÁRIOS ficam obrigados a comunicar por escrito à ADMINISTRADORA, o surgimento de qualquer dano ou defeito que a este incumba à reparação.`)
    clausula('11ª', `Caberá aos LOCATÁRIOS o cumprimento, dentro dos prazos legais, de quaisquer multas ou intimações por infrações das leis, portarias ou regulamentos vigentes.`)

    titulo('DA UTILIZAÇÃO DO IMÓVEL')
    clausula('12ª', `A presente locação destina-se restritivamente ao uso do imóvel para fins ${contrato.tipo === 'locacao_comercial' ? 'comerciais' : 'residenciais'}, não podendo os LOCATÁRIOS transferir, sublocar, ceder ou emprestar ou usá-lo de forma diferente do previsto, salvo autorização expressa do LOCADOR.`)
    paragrafoRotulo(`PARÁGRAFO PRIMEIRO – Vistorias. Faculta ao LOCADOR a realização de vistorias esporádicas no imóvel, em dia e hora a serem combinados, a fim de averiguar o estado de conservação do imóvel.`)
    paragrafoRotulo(`PARÁGRAFO SEGUNDO – Devolução. Finda ou rescindida a locação, os LOCATÁRIOS obrigam-se a devolverem o imóvel nas mesmas condições em que recebeu.`)

    titulo('DO CONSERTO, REPARO E MANUTENÇÃO')
    clausula('13ª', `Os LOCATÁRIOS precisam comunicar previamente à ADMINISTRADORA, todo e qualquer conserto, reparo ou manutenção que o imóvel locado venha necessitar internamente.`)

    titulo('DAS BENFEITORIAS')
    clausula('14ª', `As benfeitorias necessárias e úteis serão indenizáveis, desde que autorizadas pelo LOCADOR, por escrito, e avisadas com antecedência.`)
    clausula('15ª', `Se qualquer benfeitoria ou modificação for feita sem o consentimento prévio e por escrito do LOCADOR, este poderá exigir que tudo seja reposto no seu estado primitivo.`)

    titulo('DO DIREITO DE PREFERÊNCIA')
    clausula('16ª', `O LOCADOR, em qualquer tempo, poderá alienar o imóvel, mesmo durante a vigência do contrato de locação, devendo notificar os LOCATÁRIOS para que possam exercer seu direito de preferência na aquisição do imóvel, no prazo de 30 dias.`)

    titulo('DA RESCISÃO DA LOCAÇÃO')
    clausula('17ª', `Finda a locação, caberá aos LOCATÁRIOS entregar o imóvel locado em perfeitas condições de habitabilidade.`)
    clausula('18ª', `A presente locação poderá ser rescindida, se assim convier ao LOCADOR, no caso de infração por parte dos LOCATÁRIOS de qualquer das cláusulas contratuais.`)
    clausula('19ª', `Caso ocorra a devolução do imóvel antes do prazo de ${meses} meses, seja pela entrega voluntária ou por decisão judicial, facultará ao LOCADOR cobrar dos LOCATÁRIOS o pagamento de multa compensatória, proporcionalmente ao tempo de contrato não cumprido.`)
    clausula('20ª', `Durante o prazo estipulado para a duração do contrato, não poderá o LOCADOR reaver o imóvel alugado, salvo se por mútuo acordo (Conforme art. 9º da Lei 8.245/91).`)

    titulo('DA RESTITUIÇÃO DAS CHAVES')
    clausula('21ª', `A restituição das chaves ao LOCADOR ou seus procuradores, só poderá ser feita pelos LOCATÁRIOS estando o imóvel nas condições em que foi locado.`)
    clausula('22ª', `Para entrega do imóvel, ficarão os LOCATÁRIOS obrigados a acompanhar o laudo de vistoria rescisório e apresentar todos os recibos de condomínio e IPTU devidamente quitados.`)

    titulo('DO SEGURO')
    let textoSeguro = `Os LOCATÁRIOS farão um seguro do imóvel contra incêndio em companhia de sua livre escolha, durante todo o prazo da locação, correndo por conta dos LOCATÁRIOS todas as despesas decorrentes`
    if (numApoliceIncendio) textoSeguro += `. Apólice nº ${numApoliceIncendio}${valorApoliceIncendio ? ', valor: ' + formatVal(parseFloat(valorApoliceIncendio)) : ''}`
    clausula('27ª', textoSeguro + '.')

    titulo('DAS DISPOSIÇÕES FINAIS')
    clausula('28ª', `As partes contratantes obrigam-se por si, seus herdeiros e sucessores ao fiel cumprimento de todas as cláusulas e condições ora pactuadas.`)
    clausula('29ª', `É expressamente vedado qualquer depósito em conta do LOCADOR sem prévia autorização da ADMINISTRADORA.`)
    clausula('30ª', `Os LOCATÁRIOS declaram estar cientes de que serão integralmente responsáveis pelo pagamento de quaisquer multas ou penalidades decorrentes de sua conduta durante a vigência da locação.`)
    clausula('31ª', `Não será facultativa a nenhuma das partes o direito de arrependimento, devendo ambas as partes cumprir fielmente o disposto nas cláusulas aqui avençadas.`)
    paragrafoRotulo(`PARÁGRAFO ÚNICO – FORO. Elegem a Comarca de ${foro} como foro para dirimir quaisquer questões, desistindo de qualquer outro, por mais privilegiado que seja.`)

    // Assinaturas
    checkY(80)
    y += 5
    doc.setDrawColor(200).line(ML, y, MR, y); y += 8
    doc.setFontSize(9)
    doc.text(`${org.cidade || 'São Paulo'}, ${dataExtenso(new Date().toISOString().split('T')[0])}`, MR, y, { align: 'right' })
    y += 14

    const colW = (MR - ML - 5) / 2
    const assinaturas = [
      ...locadores.map((l, i) => ({ label: i === 0 ? 'LOCADOR(A)' : `LOCADOR(A) ${i + 1}`, nome: l.nome })),
      ...locatarios.map((l, i) => ({ label: i === 0 ? 'LOCATÁRIO(A)' : `LOCATÁRIO(A) ${i + 1}`, nome: l.nome })),
      { label: 'ADMINISTRADORA', nome: org.nome },
      { label: 'TESTEMUNHA 1', nome: '' },
      { label: 'TESTEMUNHA 2', nome: '' },
    ]

    for (let i = 0; i < assinaturas.length; i += 2) {
      checkY(22)
      const a1 = assinaturas[i]; const a2 = assinaturas[i + 1]
      doc.setDrawColor(0).line(ML, y, ML + colW, y)
      if (a2) doc.line(ML + colW + 5, y, MR, y)
      y += 4
      doc.setFontSize(8)
      doc.text(a1.label, ML, y)
      doc.setFontSize(7).setTextColor(100)
      doc.text(a1.nome, ML, y + 4)
      if (a2) {
        doc.setFontSize(8).setTextColor(0)
        doc.text(a2.label, ML + colW + 5, y)
        doc.setFontSize(7).setTextColor(100)
        doc.text(a2.nome, ML + colW + 5, y + 4)
      }
      doc.setTextColor(0)
      y += 18
    }

    addRodape()
    doc.save(`contrato-${contrato.numero}-${contrato.data_inicio}.pdf`)
    setGerandoPdf(false)
  }

  if (loading) return <AppLayout><Topbar titulo="Contrato PDF" /><div style={{ color: '#8b9ab4' }} className="p-6">Carregando...</div></AppLayout>
  if (!contrato) return <AppLayout><Topbar titulo="Contrato PDF" /><div style={{ color: '#8b9ab4' }} className="p-6">Contrato não encontrado</div></AppLayout>

  const valorMensal = contrato.valor_atual || contrato.valor_mensal
  const meses = mesesEntre(contrato.data_inicio, contrato.data_fim)
  const caucaoVal = contrato.valor_caucao || 0
  const parcelasNum = parseInt(parcelasCaucao) || 1

  return (
    <AppLayout>
      <Topbar titulo={`Contrato #${contrato.numero} — Gerar PDF`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          <div className="flex items-center justify-between">
            <Link href="/contratos" style={{ color: '#8b9ab4' }} className="btn btn-sm"><ArrowLeft size={13} />Voltar</Link>
            <button onClick={gerarPdf} disabled={gerandoPdf} className="btn btn-primary">
              <FileDown size={14} />{gerandoPdf ? 'Salvando e gerando...' : 'Salvar e gerar contrato PDF'}
            </button>
          </div>

          {/* Resumo do contrato */}
          <div className="card" style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }}>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span style={{ color: '#5b9bf5' }} className="text-xs">Contrato</span><p style={{ color: '#f4f4f3' }} className="font-semibold">#{contrato.numero}</p></div>
              <div><span style={{ color: '#5b9bf5' }} className="text-xs">Período</span><p style={{ color: '#f4f4f3' }} className="font-semibold">{meses} meses</p></div>
              <div><span style={{ color: '#5b9bf5' }} className="text-xs">Aluguel</span><p style={{ color: '#f4f4f3' }} className="font-semibold">{formatVal(valorMensal)}</p></div>
            </div>
          </div>

          {/* Partes */}
          {renderPartes(locadores, setLocadores, 'Locador')}
          {renderPartes(locatarios, setLocatarios, 'Locatário')}
          {contrato.tipo_garantia === 'fiador' && renderPartes(fiadores, setFiadores, 'Fiador')}

          {modalSelecionarParte && (
            <ModalSelecionarParte
              clientes={clientesTodos}
              titulo={modalSelecionarParte.tipo}
              onFechar={() => setModalSelecionarParte(null)}
              onCadastrarManual={() => {
                const { tipo, index } = modalSelecionarParte
                const arr = tipo === 'Locador' ? locadores : tipo === 'Locatário' ? locatarios : fiadores
                const setArr = tipo === 'Locador' ? setLocadores : tipo === 'Locatário' ? setLocatarios : setFiadores
                if (index === -1) {
                  const soUmVazio = arr.length === 1 && !arr[0].nome
                  setArr(soUmVazio ? arr : [...arr, partePadrao()])
                }
                // Se for um índice existente, não faz nada — os campos já estão editáveis inline.
              }}
              onSelecionar={(cliente) => {
                const { tipo, index } = modalSelecionarParte
                const arr = tipo === 'Locador' ? locadores : tipo === 'Locatário' ? locatarios : fiadores
                const setArr = tipo === 'Locador' ? setLocadores : tipo === 'Locatário' ? setLocatarios : setFiadores
                const enderecoCompleto = [cliente.endereco, cliente.bairro, cliente.cidade].filter(Boolean).join(', ')
                const novaParte: Parte = {
                  nome: cliente.nome || '',
                  cpf: cliente.cpf || '',
                  rg: cliente.rg || '',
                  profissao: cliente.profissao || '',
                  estado_civil: cliente.estado_civil || 'solteiro',
                  endereco: enderecoCompleto,
                  nacionalidade: 'brasileiro(a)',
                }
                if (index === -1) {
                  const soUmVazio = arr.length === 1 && !arr[0].nome
                  setArr(soUmVazio ? [novaParte] : [...arr, novaParte])
                } else {
                  setArr(arr.map((p, i) => i === index ? novaParte : p))
                }
              }}
            />
          )}

          {/* Moradores adicionais */}
          <div className="card">
            <label className="label">Moradores adicionais (para cadastro/biometria)</label>
            <textarea className="input" rows={2} value={moradores} onChange={e => setMoradores(e.target.value)}
              placeholder="Nome — CPF: 000.000.000-00&#10;Nome — CPF: 000.000.000-00" />
          </div>

          {/* Dados do imóvel */}
          <div className="card">
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Descrição do imóvel</h3>
            <textarea className="input" rows={3} value={descricaoImovel} onChange={e => setDescricaoImovel(e.target.value)}
              placeholder="Ex: apartamento situado à Rua X, nº 00, Apto 00, Bairro, CEP, contendo 2 dormitórios, sala, cozinha..." />
          </div>

          {/* Encargos */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold">Encargos e valores</h3>
              <button type="button"
                onClick={() => {
                  const im = Array.isArray(contrato.imovel) ? contrato.imovel[0] : contrato.imovel
                  if (!im) return
                  if (im.valor_condominio != null) setValorCondominio(String(im.valor_condominio))
                  if (im.valor_iptu != null) setValorIptu(String(im.valor_iptu))
                }}
                style={{ color: '#5b9bf5' }} className="text-xs font-medium hover:underline">
                ↻ Buscar do cadastro do imóvel
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Valor aluguel</label>
                <input className="input" style={{ background: '#16243a', color: '#8b9ab4' }} value={formatVal(valorMensal)} disabled /></div>
              <div><label className="label">Condomínio (mensal) (R$)</label>
                <InputMoeda value={valorCondominio} onChange={setValorCondominio} />
              </div>
              <div><label className="label">IPTU (mensal) (R$)</label>
                <InputMoeda value={valorIptu} onChange={setValorIptu} />
              </div>
              <div><label className="label">Índice reajuste</label>
                <input className="input" style={{ background: '#16243a', color: '#8b9ab4' }} value={contrato.indice_reajuste?.toUpperCase()} disabled /></div>
            </div>
          </div>

          {/* Caução */}
          {caucaoVal > 0 && (
            <div className="card">
              <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Caução</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Valor do caução</label>
                  <input className="input" style={{ background: '#16243a', color: '#8b9ab4' }} value={formatVal(caucaoVal)} disabled /></div>
                <div>
                  <label className="label">Forma de recebimento pelo locador</label>
                  <div className="flex gap-2 mb-2">
                    {[['pix', 'PIX'], ['transferencia', 'Transferência bancária']].map(([valor, label]) => (
                      <button key={valor} type="button" onClick={() => setFormaRecebimento(valor as 'pix' | 'transferencia')}
                        style={formaRecebimento === valor
                          ? { background: '#2563eb', color: '#fff', border: '0.5px solid #2563eb' }
                          : { border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                        className="flex-1 py-2 rounded-lg text-xs font-medium transition-all">
                        {label}
                      </button>
                    ))}
                  </div>
                  {formaRecebimento === 'pix' ? (
                    <input className="input" value={pixLocador} onChange={e => setPixLocador(e.target.value)} placeholder="CPF, CNPJ ou chave PIX" />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <input className="input" value={bancoLocador} onChange={e => setBancoLocador(e.target.value)} placeholder="Banco" />
                      <input className="input" value={agenciaLocador} onChange={e => setAgenciaLocador(e.target.value)} placeholder="Agência" />
                      <input className="input" value={contaLocador} onChange={e => setContaLocador(e.target.value)} placeholder="Conta" />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="label" style={{ marginBottom: 0 }}>Parcelamento do caução</label>
                  {!editandoParcelamento && (
                    <button type="button" onClick={() => setEditandoParcelamento(true)}
                      style={{ color: '#5b9bf5' }} className="text-xs font-medium hover:underline">
                      Editar
                    </button>
                  )}
                </div>
                {editandoParcelamento ? (
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(p => (
                      <button key={p} type="button" onClick={() => setParcelasCaucao(String(p))}
                        style={parcelasNum === p
                          ? { background: '#2563eb', color: '#fff', border: '0.5px solid #2563eb' }
                          : { border: '0.5px solid #2a2f3a', color: '#a8aab5' }}
                        className="flex-1 py-2 rounded-lg text-sm font-medium transition-all">
                        {p === 1 ? 'À vista' : `${p}x`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#f4f4f3' }} className="rounded-lg px-3 py-2 text-sm">
                    {parcelasNum === 1 ? 'À vista' : `${parcelasNum}x de ${formatVal(caucaoVal / parcelasNum)}`}
                  </div>
                )}
                {parcelasNum > 1 && (
                  <div style={{ background: '#16243a', border: '0.5px solid #1e3a5f', color: '#5b9bf5' }} className="mt-2 rounded-lg p-3 text-xs">
                    {parcelasNum}x de {formatVal(caucaoVal / parcelasNum)} — vencimentos mensais a partir de {new Date(contrato.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Apólices */}
          <div className="card">
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Apólices e seguros</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nº Apólice — Seguro incêndio</label>
                <input className="input" value={numApoliceIncendio} onChange={e => setNumApoliceIncendio(e.target.value)} /></div>
              <div><label className="label">Valor anual — Seguro incêndio</label>
                <input className="input" type="number" step="0.01" value={valorApoliceIncendio} onChange={e => setValorApoliceIncendio(e.target.value)} placeholder="0,00" /></div>
              {contrato.tipo_garantia === 'seguro_fianca' && <>
                <div><label className="label">Nº Apólice — Seguro fiança</label>
                  <input className="input" value={numApoliceSeguroFianca} onChange={e => setNumApoliceSeguroFianca(e.target.value)} /></div>
                <div><label className="label">Valor — Seguro fiança</label>
                  <input className="input" type="number" step="0.01" value={valorApoliceSeguroFianca} onChange={e => setValorApoliceSeguroFianca(e.target.value)} placeholder="0,00" /></div>
              </>}
            </div>
          </div>

          {/* Foro */}
          <div className="card">
            <label className="label">Foro eleito</label>
            <input className="input" value={foro} onChange={e => setForo(e.target.value)} />
          </div>

          {/* Upload de documentos */}
          <div className="card">
            <h3 style={{ color: '#f4f4f3' }} className="text-sm font-semibold mb-4">Documentos do contrato</h3>
            <p style={{ color: '#8b9ab4' }} className="text-xs mb-3">Apólices, comprovantes de caução, RGs, CPFs e demais documentos.</p>

            {sucesso && <div style={{ background: '#1a2e1f', border: '0.5px solid #2d4a35', color: '#3fb950' }} className="px-3 py-2 rounded-lg mb-3 text-xs">{sucesso}</div>}

            <label style={{ border: '1.5px dashed #1e3a5f' }} className="flex flex-col items-center justify-center w-full h-24 rounded-lg cursor-pointer hover:border-blue-500 transition-all mb-4">
              <Upload size={20} style={{ color: '#8b9ab4' }} className="mb-1" />
              <span style={{ color: '#8b9ab4' }} className="text-xs">{uploadando ? 'Enviando...' : 'Clique para enviar documento (PDF, JPG, PNG)'}</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocumento(f); e.target.value = '' }} />
            </label>

            {documentos.length === 0 ? (
              <p style={{ color: '#8b9ab4' }} className="text-xs text-center py-4">Nenhum documento anexado ainda</p>
            ) : (
              <div className="space-y-2">
                {documentos.map((d, i) => (
                  <div key={i} style={{ background: '#16243a', border: '0.5px solid #1e3a5f' }} className="flex items-center justify-between p-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span style={{ background: '#0d1b2e', color: '#5b9bf5' }} className="text-xs px-1.5 py-0.5 rounded uppercase font-medium">{d.tipo}</span>
                      <span style={{ color: '#f4f4f3' }} className="text-xs">{d.nome}</span>
                    </div>
                    <div className="flex gap-2">
                      <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: '#5b9bf5' }} className="btn btn-sm text-xs">Ver</a>
                      <button onClick={() => excluirDocumento(d.nome)} style={{ color: '#ef4444' }} className="btn btn-sm">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botão final */}
          <div className="pb-6">
            <button onClick={gerarPdf} disabled={gerandoPdf} className="btn btn-primary w-full">
              <FileDown size={14} />{gerandoPdf ? 'Salvando e gerando...' : 'Salvar e gerar contrato PDF'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
