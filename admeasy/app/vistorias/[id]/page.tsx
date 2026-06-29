'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { FileDown, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Ambiente = { nome: string; estado: string; observacao: string; fotos: string[] }
type Vistoria = {
  id: string
  codigo: number
  tipo: 'entrada' | 'saida'
  data_vistoria: string
  status: string
  observacoes_gerais?: string
  ambientes: Ambiente[]
  locadores: string[]
  locatarios: string[]
  testemunha1_nome?: string
  testemunha1_cpf?: string
  testemunha2_nome?: string
  testemunha2_cpf?: string
  imovel?: { endereco: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string }
  vistoriador?: { nome: string; crea?: string; cpf?: string }
}
type Org = { nome: string; logo_url?: string; cnpj?: string; creci?: string; cidade?: string }

export default function VistoriaDetalhePage() {
  const { id } = useParams()
  const [vistoria, setVistoria] = useState<Vistoria | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    const { data } = await supabase
      .from('vistorias')
      .select('*, imovel:imoveis(endereco, numero, complemento, bairro, cidade, estado), vistoriador:vistoriadores(nome, crea, cpf)')
      .eq('id', id)
      .single()
    if (data) setVistoria(data)
    const { data: o } = await supabase.from('organizations').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single()
    if (o) setOrg(o)
  }

  function dataExtenso(dateStr: string) {
    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
    const d = new Date(dateStr + 'T12:00:00')
    return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`
  }

  async function gerarPdf() {
    if (!vistoria || !org) return
    setGerandoPdf(true)

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const W = 210
    const ML = 15
    const MR = W - 15
    let y = 15
    let pagina = 1

    function addPaginaRodape() {
      doc.setFontSize(7).setTextColor(150)
      doc.text(`Página ${pagina} de ?`, W / 2, 290, { align: 'center' })
      doc.setTextColor(0)
    }

    function novaPagina() {
      addPaginaRodape()
      doc.addPage()
      pagina++
      y = 15
    }

    function checkY(needed: number) {
      if (y + needed > 275) novaPagina()
    }

    // ── CABEÇALHO ──
    if (org.logo_url) {
      try { doc.addImage(org.logo_url, 'JPEG', ML, y, 28, 14) } catch {}
    }

    doc.setFontSize(20).setFont('helvetica', 'bold')
    doc.text('Termo de vistoria', W / 2, y + 8, { align: 'center' })

    doc.setFontSize(8).setFont('helvetica', 'normal')
    doc.text(`Código: ${vistoria.codigo || vistoria.id.slice(0, 6).toUpperCase()}`, MR, y + 3, { align: 'right' })
    doc.text(`Data: ${new Date(vistoria.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')}`, MR, y + 8, { align: 'right' })
    doc.text(`Vistoriador: ${vistoria.vistoriador?.nome || '—'}`, MR, y + 13, { align: 'right' })

    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text(org.nome, W / 2, y + 14, { align: 'center' })
    y += 20

    // ── DADOS DO IMÓVEL ──
    doc.setFillColor(230, 230, 230)
    doc.rect(ML, y, MR - ML, 6, 'F')
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(0)
    doc.text('Dados do imóvel', W / 2, y + 4, { align: 'center' })
    y += 8

    const im = vistoria.imovel
    const enderecoCompleto = `${im?.endereco || ''}, ${im?.numero || ''}${im?.complemento ? ', ' + im.complemento : ''}, ${im?.bairro || ''} - ${im?.cidade || ''} - ${im?.estado || ''}`

    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('Tipo de vistoria: ', ML, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${vistoria.tipo === 'entrada' ? 'Entrada' : 'Saída'}`, ML + 30, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.text('Imóvel: ', ML, y)
    doc.setFont('helvetica', 'normal')
    const endLines = doc.splitTextToSize(enderecoCompleto, MR - ML - 18)
    doc.text(endLines, ML + 14, y)
    y += endLines.length * 5 + 3

    if (vistoria.observacoes_gerais) {
      doc.setFont('helvetica', 'bold')
      doc.text('Observações: ', ML, y)
      doc.setFont('helvetica', 'normal')
      const obsLines = doc.splitTextToSize(vistoria.observacoes_gerais, MR - ML - 25)
      doc.text(obsLines, ML + 24, y)
      y += obsLines.length * 5 + 3
    }
    y += 2

    // ── AMBIENTES ──
    doc.setFillColor(230, 230, 230)
    doc.rect(ML, y, MR - ML, 6, 'F')
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('Ambientes', W / 2, y + 4, { align: 'center' })
    y += 10

    for (const amb of vistoria.ambientes) {
      checkY(20)

      // Nome do ambiente em negrito
      doc.setFontSize(10).setFont('helvetica', 'bold')
      doc.text(amb.nome, ML, y)
      y += 5

      // Observações como lista com travessão
      if (amb.observacao) {
        doc.setFontSize(9).setFont('helvetica', 'normal')
        const linhas = amb.observacao.split('\n').filter(l => l.trim())
        for (const linha of linhas) {
          checkY(6)
          const wrapped = doc.splitTextToSize(`- ${linha.trim()}`, MR - ML - 5)
          doc.text(wrapped, ML + 2, y)
          y += wrapped.length * 4.5
        }
      }
      y += 2

      // Fotos em linha
      if (amb.fotos?.length > 0) {
        const fotoW = 55
        const fotoH = 42
        const gap = 3
        const fotosPerRow = 3
        let fx = ML
        let row = 0

        for (let fi = 0; fi < amb.fotos.length; fi++) {
          if (fi > 0 && fi % fotosPerRow === 0) {
            row++
            fx = ML
          }
          const fy = y + row * (fotoH + gap)
          checkY(fotoH + gap)

          try {
            const resp = await fetch(amb.fotos[fi])
            const blob = await resp.blob()
            const b64 = await new Promise<string>(res => {
              const r = new FileReader()
              r.onload = () => res((r.result as string).split(',')[1])
              r.readAsDataURL(blob)
            })
            const ext = amb.fotos[fi].includes('.png') ? 'PNG' : 'JPEG'
            doc.addImage(b64, ext, fx, fy, fotoW, fotoH)
          } catch {}
          fx += fotoW + gap
        }

        const totalRows = Math.ceil(amb.fotos.length / fotosPerRow)
        y += totalRows * (fotoH + gap) + 5
      }
      y += 5
    }

    // ── ASSINATURAS ──
    checkY(80)
    y += 5

    const cidade = org.cidade || im?.cidade || 'São Paulo'
    doc.setFontSize(9).setFont('helvetica', 'normal')
    doc.text(`${cidade}, ${dataExtenso(vistoria.data_vistoria)}`, MR, y, { align: 'right' })
    y += 12

    const colW = (MR - ML - 5) / 2
    const lineY = (nome: string, label: string, x: number, yy: number) => {
      doc.setDrawColor(0).line(x, yy, x + colW, yy)
      doc.setFontSize(8).setFont('helvetica', 'normal')
      doc.text(`${label}: ${nome}`, x, yy + 4)
    }

    // Vistoriador + Locador(es) em grid
    const assinaturas: { label: string; nome: string }[] = []
    assinaturas.push({ label: 'Vistoriador(a)', nome: vistoria.vistoriador?.nome || '' })
    for (const l of (vistoria.locadores || [])) assinaturas.push({ label: 'Locador(a)', nome: l })
    for (const l of (vistoria.locatarios || [])) assinaturas.push({ label: 'Locatário(a)', nome: l })
    assinaturas.push({ label: 'Testemunha1', nome: vistoria.testemunha1_nome ? `CPF: ${vistoria.testemunha1_cpf || ''}\nNome: ${vistoria.testemunha1_nome}` : 'CPF:\nNome:' })
    assinaturas.push({ label: 'Testemunha2', nome: vistoria.testemunha2_nome ? `CPF: ${vistoria.testemunha2_cpf || ''}\nNome: ${vistoria.testemunha2_nome}` : 'CPF:\nNome:' })

    for (let i = 0; i < assinaturas.length; i += 2) {
      checkY(22)
      const a1 = assinaturas[i]
      const a2 = assinaturas[i + 1]

      lineY(a1.nome, a1.label, ML, y)
      if (a2) lineY(a2.nome, a2.label, ML + colW + 5, y)
      y += 18
    }

    // Rodapé final
    addPaginaRodape()

    // Corrige "Página X de ?" — não há como saber total de páginas em jsPDF facilmente
    doc.save(`vistoria-${vistoria.tipo}-${vistoria.data_vistoria}.pdf`)
    setGerandoPdf(false)
  }

  if (!vistoria) return (
    <AppLayout><Topbar titulo="Vistoria" />
      <div className="p-6 text-gray-400">Carregando...</div>
    </AppLayout>
  )

  const estadoCor = (e: string) => e === 'bom' ? 'badge-green' : e === 'regular' ? 'badge-yellow' : e === 'ruim' ? 'badge-red' : 'badge-gray'

  return (
    <AppLayout>
      <Topbar titulo={`Vistoria de ${vistoria.tipo === 'entrada' ? 'Entrada' : 'Saída'}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          <div className="flex items-center justify-between">
            <Link href="/vistorias" className="btn btn-sm text-gray-500">
              <ArrowLeft size={13} />Voltar
            </Link>
            <button onClick={gerarPdf} disabled={gerandoPdf} className="btn btn-primary btn-sm">
              <FileDown size={13} />{gerandoPdf ? 'Gerando PDF...' : 'Gerar PDF'}
            </button>
          </div>

          {/* Resumo */}
          <div className="card">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <span className="text-gray-400 text-xs">Imóvel</span>
                <p className="font-medium">{vistoria.imovel?.endereco}, {vistoria.imovel?.numero}</p>
                <p className="text-gray-400 text-xs">{vistoria.imovel?.bairro} — {vistoria.imovel?.cidade}/{vistoria.imovel?.estado}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Tipo</span>
                <p className="font-medium">{vistoria.tipo === 'entrada' ? 'Entrada' : 'Saída'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Data</span>
                <p className="font-medium">{new Date(vistoria.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Vistoriador</span>
                <p className="font-medium">{vistoria.vistoriador?.nome || '—'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Status</span>
                <p><span className={`badge ${vistoria.status === 'concluida' ? 'badge-green' : 'badge-yellow'}`}>{vistoria.status === 'concluida' ? 'Concluída' : 'Rascunho'}</span></p>
              </div>
              {vistoria.locadores?.length > 0 && (
                <div>
                  <span className="text-gray-400 text-xs">Locador(es)</span>
                  {vistoria.locadores.map((l, i) => <p key={i} className="font-medium">{l}</p>)}
                </div>
              )}
              {vistoria.locatarios?.length > 0 && (
                <div>
                  <span className="text-gray-400 text-xs">Locatário(s)</span>
                  {vistoria.locatarios.map((l, i) => <p key={i} className="font-medium">{l}</p>)}
                </div>
              )}
            </div>
          </div>

          {/* Ambientes */}
          {vistoria.ambientes?.map((amb, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{amb.nome}</h3>
                <span className={`badge ${estadoCor(amb.estado)}`}>{amb.estado || 'Não avaliado'}</span>
              </div>
              {amb.observacao && (
                <div className="mb-3 text-sm text-gray-600">
                  {amb.observacao.split('\n').filter(l => l.trim()).map((linha, li) => (
                    <p key={li}>- {linha.trim()}</p>
                  ))}
                </div>
              )}
              {amb.fotos?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {amb.fotos.map((url, fi) => (
                    <img key={fi} src={url} alt="" className="object-cover rounded-lg border border-gray-200"
                      style={{ width: '90px', height: '70px' }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
