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

type Contrato = {
  id: string; numero: string; tipo: string
  data_inicio: string; data_fim: string
  valor_mensal: number; valor_atual: number; valor_caucao?: number
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

function partePadrao(): Parte {
  return { nome: '', cpf: '', rg: '', profissao: '', estado_civil: 'solteiro(a)', endereco: '', nacionalidade: 'brasileiro(a)' }
}

function formatVal(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function valorExtenso(val: number): string {
  // Simplificado para valores comuns
  const inteiros = Math.floor(val)
  const centavos = Math.round((val - inteiros) * 100)
  const extenso: Record<number, string> = {
    1:'UM', 2:'DOIS', 3:'TRÊS', 4:'QUATRO', 5:'CINCO', 6:'SEIS', 7:'SETE', 8:'OITO', 9:'NOVE', 10:'DEZ',
    11:'ONZE', 12:'DOZE', 13:'TREZE', 14:'QUATORZE', 15:'QUINZE', 16:'DEZESSEIS', 17:'DEZESSETE',
    18:'DEZOITO', 19:'DEZENOVE', 20:'VINTE', 30:'TRINTA', 40:'QUARENTA', 50:'CINQUENTA',
    60:'SESSENTA', 70:'SETENTA', 80:'OITENTA', 90:'NOVENTA',
    100:'CEM', 200:'DUZENTOS', 300:'TREZENTOS', 400:'QUATROCENTOS', 500:'QUINHENTOS',
    600:'SEISCENTOS', 700:'SETECENTOS', 800:'OITOCENTOS', 900:'NOVECENTOS',
    1000:'MIL', 2000:'DOIS MIL', 3000:'TRÊS MIL', 4000:'QUATRO MIL', 5000:'CINCO MIL',
  }
  if (extenso[inteiros]) {
    const base = extenso[inteiros]
    return centavos > 0 ? `${base} REAIS E ${centavos} CENTAVOS` : `${base} REAIS`
  }
  return `${inteiros} REAIS`
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

  // Dados extras do contrato
  const [valorCondominio, setValorCondominio] = useState('')
  const [valorIptu, setValorIptu] = useState('')
  const [parcelasCaucao, setParcelasCaucao] = useState('1')
  const [pixLocador, setPixLocador] = useState('')
  const [numApoliceIncendio, setNumApoliceIncendio] = useState('')
  const [valorApoliceIncendio, setValorApoliceIncendio] = useState('')
  const [numApoliceSeguroFianca, setNumApoliceSeguroFianca] = useState('')
  const [valorApoliceSeguroFianca, setValorApoliceSeguroFianca] = useState('')
  const [descricaoImovel, setDescricaoImovel] = useState('')
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
      // Pré-preencher locador com dados do cliente
      const loc = Array.isArray(c.locador) ? c.locador[0] : c.locador
      const locat = Array.isArray(c.locatario) ? c.locatario[0] : c.locatario
      if (loc) setLocadores([{
        nome: loc.nome || '', cpf: loc.cpf || '', rg: loc.rg || '',
        profissao: loc.profissao || '', estado_civil: loc.estado_civil || 'solteiro(a)',
        endereco: [loc.endereco, loc.numero, loc.bairro, loc.cidade].filter(Boolean).join(', '),
        nacionalidade: loc.nacionalidade || 'brasileiro(a)',
      }])
      if (locat) setLocatarios([{
        nome: locat.nome || '', cpf: locat.cpf || '', rg: locat.rg || '',
        profissao: locat.profissao || '', estado_civil: locat.estado_civil || 'solteiro(a)',
        endereco: [locat.endereco, locat.numero, locat.bairro, locat.cidade].filter(Boolean).join(', '),
        nacionalidade: locat.nacionalidade || 'brasileiro(a)',
      }])
      // Descrição do imóvel
      const im = Array.isArray(c.imovel) ? c.imovel[0] : c.imovel
      if (im) setDescricaoImovel(im.descricao || `${im.tipo || 'imóvel'} situado à ${im.endereco || ''}, ${im.numero || ''}, ${im.bairro || ''}, CEP ${im.cep || ''}, ${im.cidade || ''}/${im.estado || ''}`)
    }

    const { data: o } = await supabase.from('organizations').select('*').eq('id', ORG_ID).single()
    if (o) setOrg(o)

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
          <h3 className="text-sm font-semibold">{titulo}</h3>
          <button type="button" onClick={() => setPartes([...partes, partePadrao()])}
            className="btn btn-sm text-blue-600 border-blue-200">
            <Plus size={12} />Adicionar {titulo.toLowerCase()}
          </button>
        </div>
        {partes.map((p, i) => (
          <div key={i} className={`${i > 0 ? 'border-t border-gray-100 pt-4 mt-4' : ''}`}>
            {partes.length > 1 && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{titulo} {i + 1}</span>
                <button onClick={() => setPartes(partes.filter((_, pi) => pi !== i))}
                  className="text-gray-300 hover:text-red-500"><X size={13} /></button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Nome completo *</label>
                <input className="input" value={p.nome} onChange={e => setParte(partes, setPartes, i, 'nome', e.target.value)} /></div>
              <div><label className="label">Nacionalidade</label>
                <input className="input" value={p.nacionalidade} onChange={e => setParte(partes, setPartes, i, 'nacionalidade', e.target.value)} /></div>
              <div><label className="label">Estado civil</label>
                <select className="input" value={p.estado_civil} onChange={e => setParte(partes, setPartes, i, 'estado_civil', e.target.value)}>
                  {['solteiro(a)','casado(a)','divorciado(a)','viúvo(a)','separado(a)','união estável'].map(o => <option key={o} value={o}>{o}</option>)}
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
      checkY(15)
      doc.setFontSize(9).setFont('helvetica', 'bold')
      doc.text(`CLÁUSULA ${num} –`, ML, y)
      doc.setFont('helvetica', 'normal')
      const lines = doc.splitTextToSize(texto, CW)
      // Continua na mesma linha após o título da cláusula
      const headerWidth = doc.getTextWidth(`CLÁUSULA ${num} – `)
      const firstLine = doc.splitTextToSize(texto, CW - headerWidth)
      doc.text(firstLine[0] || '', ML + headerWidth, y)
      y += 5
      if (lines.length > 1) {
        const rest = doc.splitTextToSize(texto.substring(firstLine[0]?.length || 0), CW)
        for (const l of rest) {
          checkY(5)
          doc.text(l, ML, y)
          y += 5
        }
      }
      y += 2
    }

    function paragrafo(texto: string, negrito = false) {
      checkY(8)
      doc.setFontSize(9).setFont('helvetica', negrito ? 'bold' : 'normal')
      const lines = doc.splitTextToSize(texto, CW)
      for (const l of lines) { checkY(5); doc.text(l, ML, y); y += 5 }
      y += 1
      doc.setFont('helvetica', 'normal')
    }

    // ── CABEÇALHO ──
    if (org.logo_url) {
      try { doc.addImage(org.logo_url, 'JPEG', ML, y, 25, 13) } catch {}
    }
    doc.setFontSize(16).setFont('helvetica', 'bold')
    doc.text('CONTRATO DE LOCAÇÃO RESIDENCIAL', W / 2, y + 8, { align: 'center' })
    y += 18

    doc.setDrawColor(0).line(ML, y, MR, y); y += 6

    // Qualificação locadores
    titulo('DO LOCADOR')
    locadores.forEach((l, i) => {
      const qualif = `${l.nome.toUpperCase()}, ${l.nacionalidade}, ${l.estado_civil}, ${l.profissao}, portador(a) da Cédula de identidade RG nº ${l.rg} e inscrito(a) no CPF/MF sob nº ${l.cpf}, residente e domiciliado(a) à ${l.endereco}, doravante denominado(a) ${i === 0 ? 'LOCADOR(A)' : 'LOCADOR(A) ' + (i + 1)}.`
      paragrafo(qualif)
    })
    y += 2

    // Qualificação locatários
    titulo('DO LOCATÁRIO')
    locatarios.forEach((l, i) => {
      const qualif = `${l.nome.toUpperCase()}, ${l.nacionalidade}, ${l.estado_civil}, ${l.profissao}, portador(a) da Cédula de identidade RG nº ${l.rg} e inscrito(a) no CPF sob nº ${l.cpf}, residente e domiciliado(a) à ${l.endereco}, doravante denominado(a) ${i === 0 ? 'LOCATÁRIO(A)' : 'LOCATÁRIO(A) ' + (i + 1)}.`
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
    y += 2

    // Prazos
    const meses = mesesEntre(contrato.data_inicio, contrato.data_fim)
    titulo('DOS PRAZOS')
    clausula('1ª', `A presente locação é pelo prazo de ${meses} (${meses === 30 ? 'trinta' : meses} meses), a contar do dia ${dataExtenso(contrato.data_inicio)} e término em ${dataExtenso(contrato.data_fim)}.`)
    clausula('2ª', `Vencido o prazo mencionado na CLÁUSULA 1ª e, pretendendo os LOCATÁRIOS entregarem as chaves do imóvel, deverão dar ciência à LOCADORA, POR ESCRITO, e com antecedência mínima de 30 (Trinta) dias de sua deliberação, ficando de qualquer modo, obrigados ao pagamento do aluguel e encargos até a efetiva rescisão do contrato.`)
    clausula('3ª', `A locação não iniciada no 1º (primeiro) dia do mês terá o acerto dos dias decorridos até o final do mesmo, se houver.`)

    // Aluguel
    titulo('DO ALUGUEL')
    const valorMensal = contrato.valor_atual || contrato.valor_mensal
    let textoAluguel = `O aluguel mensal inicial é de ${formatVal(valorMensal)} (${valorExtenso(valorMensal)}), ficando ainda a cargo dos LOCATÁRIOS os demais encargos da locação`
    if (valorCondominio) textoAluguel += `, o condomínio no valor de ${formatVal(parseFloat(valorCondominio))} (${valorExtenso(parseFloat(valorCondominio))})`
    if (valorIptu) textoAluguel += `, IPTU no valor de ${formatVal(parseFloat(valorIptu))}`
    textoAluguel += `, devendo ser pagos até o dia 10 (dez) do mês subsequente ao vencido, diretamente à ${org.nome}, na qualidade de ADMINISTRADORA, CNPJ: ${org.cnpj || ''}, CRECI ${org.creci || ''}, estabelecida à ${org.endereco || ''}, ${org.numero || ''} – ${org.bairro || ''} – ${org.cidade || ''}, através de boleto bancário, que posteriormente será repassado ao LOCADOR.`
    clausula('4ª', textoAluguel)
    paragrafo(`PARÁGRAFO PRIMEIRO: O aluguel será reajustado anualmente na exata proporção da variação acumulada do Índice ${contrato.indice_reajuste?.toUpperCase() || 'IGP-M'}.`, true)
    paragrafo(`PARÁGRAFO SEGUNDO: Esse mesmo critério de reajuste será sempre observado, independentemente de aviso ou interpelação, a cada período de 12 (doze) meses até quando finda ou rescinda a locação.`, true)
    paragrafo(`PARÁGRAFO TERCEIRO: Em caso de variação negativa do índice adotado, o valor do aluguel será mantido, não sendo aplicado qualquer decréscimo.`, true)
    clausula('5ª', `Os aluguéis que não forem pagos na data do vencimento terão acréscimo de 10% (DEZ POR CENTO) DE MULTA e, mais 2% (DOIS POR CENTO) AO MÊS DE JUROS DE MORA e ficarão sujeitos a correção monetária, com base na variação do IPCA do IBGE.`)
    clausula('6ª', `Os aluguéis em atraso por mais de 30 (trinta) dias serão encaminhados ao Departamento Jurídico, ficando os LOCATÁRIOS sujeitos a todas as penalidades legais e contratuais, bem como à obrigação de ressarcir integralmente o LOCADOR por quaisquer despesas judiciais ou extrajudiciais.`)

    // Garantia
    titulo('DA GARANTIA')
    const caucaoVal = contrato.valor_caucao || 0
    const parcelasNum = parseInt(parcelasCaucao) || 1
    if (contrato.tipo_garantia === 'caucao' || !contrato.tipo_garantia) {
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
        if (pixLocador) textoCaucao += `, através de transferência via PIX: ${pixLocador} em nome de ${locadores[0]?.nome || 'LOCADOR'}`
        textoCaucao += `.`
        clausula('7ª', textoCaucao)
      }
    } else if (contrato.tipo_garantia === 'seguro_fianca' && numApoliceSeguroFianca) {
      clausula('7ª', `O presente contrato será garantido por seguro fiança, Apólice nº ${numApoliceSeguroFianca}, no valor de ${valorApoliceSeguroFianca ? formatVal(parseFloat(valorApoliceSeguroFianca)) : 'conforme apólice'}.`)
    }

    // Obrigações locatários
    titulo('DAS OBRIGAÇÕES DOS LOCATÁRIOS')
    clausula('8ª', `Os LOCATÁRIOS obrigam-se pela mais perfeita conservação do imóvel locado, mantendo-o sempre em perfeitas condições de habitabilidade, respondendo por todos os prejuízos provenientes de qualquer estrago ou má conservação.`)
    clausula('9ª', `Os LOCATÁRIOS ficam obrigados a servir-se do imóvel para o uso convencionado, qual seja sua residência e de sua família, não podendo cedê-lo ou sublocá-lo no todo ou em parte, nem transferir o presente contrato sem autorização expressa e por escrito do LOCADOR.`)
    clausula('10ª', `Os LOCATÁRIOS ficam obrigados a comunicar por escrito à ADMINISTRADORA, o surgimento de qualquer dano ou defeito que a este incumba à reparação.`)
    clausula('11ª', `Caberá aos LOCATÁRIOS o cumprimento, dentro dos prazos legais, de quaisquer multas ou intimações por infrações das leis, portarias ou regulamentos vigentes.`)

    titulo('DA UTILIZAÇÃO DO IMÓVEL')
    clausula('12ª', `A presente locação destina-se restritivamente ao uso do imóvel para fins residenciais, não podendo os LOCATÁRIOS transferir, sublocar, ceder ou emprestar ou usá-lo de forma diferente do previsto, salvo autorização expressa do LOCADOR.`)
    paragrafo(`PARÁGRAFO PRIMEIRO – Vistorias. Faculta ao LOCADOR a realização de vistorias esporádicas no imóvel, em dia e hora a serem combinados, a fim de averiguar o estado de conservação do imóvel.`, true)
    paragrafo(`PARÁGRAFO SEGUNDO – Devolução. Finda ou rescindida a locação, os LOCATÁRIOS obrigam-se a devolverem o imóvel nas mesmas condições em que recebeu.`, true)

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
    paragrafo(`PARÁGRAFO ÚNICO – FORO. Elegem a Comarca de ${foro} como foro para dirimir quaisquer questões, desistindo de qualquer outro, por mais privilegiado que seja.`, true)

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

  if (loading) return <AppLayout><Topbar titulo="Contrato PDF" /><div className="p-6 text-gray-400">Carregando...</div></AppLayout>
  if (!contrato) return <AppLayout><Topbar titulo="Contrato PDF" /><div className="p-6 text-gray-400">Contrato não encontrado</div></AppLayout>

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
            <Link href="/contratos" className="btn btn-sm text-gray-500"><ArrowLeft size={13} />Voltar</Link>
            <button onClick={gerarPdf} disabled={gerandoPdf} className="btn btn-primary">
              <FileDown size={14} />{gerandoPdf ? 'Gerando PDF...' : 'Gerar contrato PDF'}
            </button>
          </div>

          {/* Resumo do contrato */}
          <div className="card bg-blue-50 border-blue-200">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-xs text-blue-400">Contrato</span><p className="font-semibold text-blue-900">#{contrato.numero}</p></div>
              <div><span className="text-xs text-blue-400">Período</span><p className="font-semibold text-blue-900">{meses} meses</p></div>
              <div><span className="text-xs text-blue-400">Aluguel</span><p className="font-semibold text-blue-900">{formatVal(valorMensal)}</p></div>
            </div>
          </div>

          {/* Partes */}
          {renderPartes(locadores, setLocadores, 'Locador')}
          {renderPartes(locatarios, setLocatarios, 'Locatário')}

          {/* Moradores adicionais */}
          <div className="card">
            <label className="label">Moradores adicionais (para cadastro/biometria)</label>
            <textarea className="input" rows={2} value={moradores} onChange={e => setMoradores(e.target.value)}
              placeholder="Nome — CPF: 000.000.000-00&#10;Nome — CPF: 000.000.000-00" />
          </div>

          {/* Dados do imóvel */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4">Descrição do imóvel</h3>
            <textarea className="input" rows={3} value={descricaoImovel} onChange={e => setDescricaoImovel(e.target.value)}
              placeholder="Ex: apartamento situado à Rua X, nº 00, Apto 00, Bairro, CEP, contendo 2 dormitórios, sala, cozinha..." />
          </div>

          {/* Encargos */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4">Encargos e valores</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Valor aluguel</label>
                <input className="input bg-gray-50" value={formatVal(valorMensal)} disabled /></div>
              <div><label className="label">Condomínio (R$)</label>
                <input className="input" type="number" step="0.01" value={valorCondominio} onChange={e => setValorCondominio(e.target.value)} placeholder="0,00" /></div>
              <div><label className="label">IPTU (R$)</label>
                <input className="input" type="number" step="0.01" value={valorIptu} onChange={e => setValorIptu(e.target.value)} placeholder="0,00" /></div>
              <div><label className="label">Índice reajuste</label>
                <input className="input bg-gray-50" value={contrato.indice_reajuste?.toUpperCase()} disabled /></div>
            </div>
          </div>

          {/* Caução */}
          {caucaoVal > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold mb-4">Caução</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Valor do caução</label>
                  <input className="input bg-gray-50" value={formatVal(caucaoVal)} disabled /></div>
                <div><label className="label">PIX do locador</label>
                  <input className="input" value={pixLocador} onChange={e => setPixLocador(e.target.value)} placeholder="CPF, CNPJ ou chave PIX" /></div>
              </div>
              <div className="mt-3">
                <label className="label">Parcelamento do caução</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(p => (
                    <button key={p} type="button" onClick={() => setParcelasCaucao(String(p))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${parcelasNum === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'}`}>
                      {p === 1 ? 'À vista' : `${p}x`}
                    </button>
                  ))}
                </div>
                {parcelasNum > 1 && (
                  <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    {parcelasNum}x de {formatVal(caucaoVal / parcelasNum)} — vencimentos mensais a partir de {new Date(contrato.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Apólices */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-4">Apólices e seguros</h3>
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
            <h3 className="text-sm font-semibold mb-4">Documentos do contrato</h3>
            <p className="text-xs text-gray-400 mb-3">Apólices, comprovantes de caução, RGs, CPFs e demais documentos.</p>

            {sucesso && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg mb-3 text-xs">{sucesso}</div>}

            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all mb-4">
              <Upload size={20} className="text-gray-300 mb-1" />
              <span className="text-xs text-gray-400">{uploadando ? 'Enviando...' : 'Clique para enviar documento (PDF, JPG, PNG)'}</span>
              <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocumento(f); e.target.value = '' }} />
            </label>

            {documentos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Nenhum documento anexado ainda</p>
            ) : (
              <div className="space-y-2">
                {documentos.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase font-medium">{d.tipo}</span>
                      <span className="text-xs text-gray-700">{d.nome}</span>
                    </div>
                    <div className="flex gap-2">
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm text-xs">Ver</a>
                      <button onClick={() => excluirDocumento(d.nome)} className="btn btn-sm text-red-400 hover:text-red-600">
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
              <FileDown size={14} />{gerandoPdf ? 'Gerando PDF...' : 'Gerar contrato PDF'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
