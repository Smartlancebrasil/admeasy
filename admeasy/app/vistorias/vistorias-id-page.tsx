'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import Topbar from '@/components/layout/Topbar'
import { supabase } from '@/lib/supabase'
import { FileDown, ArrowLeft, Edit2 } from 'lucide-react'
import Link from 'next/link'

type Ambiente = {
  nome: string
  estado: string
  observacao: string
  fotos: string[]
}

type Vistoria = {
  id: string
  tipo: 'entrada' | 'saida'
  data_vistoria: string
  status: string
  observacoes_gerais?: string
  ambientes: Ambiente[]
  imovel?: { endereco: string; numero?: string; bairro?: string; cidade?: string; estado?: string }
  vistoriador?: { nome: string; crea?: string; cpf?: string }
}

type Org = { nome: string; logo_url?: string; cnpj?: string; creci?: string; endereco?: string; cidade?: string; telefone?: string }

export default function VistoriaDetalhePage() {
  const { id } = useParams()
  const router = useRouter()
  const [vistoria, setVistoria] = useState<Vistoria | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    const { data } = await supabase
      .from('vistorias')
      .select('*, imovel:imoveis(endereco, numero, bairro, cidade, estado), vistoriador:vistoriadores(nome, crea, cpf)')
      .eq('id', id)
      .single()
    if (data) setVistoria(data)

    const { data: o } = await supabase.from('organizations').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single()
    if (o) setOrg(o)
  }

  async function gerarPdf() {
    if (!vistoria || !org) return
    setGerandoPdf(true)

    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    const W = 210
    let y = 15

    // Cabeçalho
    if (org.logo_url) {
      try {
        doc.addImage(org.logo_url, 'JPEG', 15, y, 30, 15)
      } catch {}
    }
    doc.setFontSize(14).setFont('helvetica', 'bold')
    doc.text('LAUDO DE VISTORIA', W / 2, y + 5, { align: 'center' })
    doc.setFontSize(10).setFont('helvetica', 'normal')
    doc.text(vistoria.tipo === 'entrada' ? 'VISTORIA DE ENTRADA' : 'VISTORIA DE SAÍDA', W / 2, y + 12, { align: 'center' })
    y += 25

    // Linha
    doc.setDrawColor(200).line(15, y, W - 15, y)
    y += 6

    // Dados
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('DADOS DO IMÓVEL', 15, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.text(`Endereço: ${vistoria.imovel?.endereco || ''}, ${vistoria.imovel?.numero || ''} — ${vistoria.imovel?.bairro || ''}, ${vistoria.imovel?.cidade || ''}`, 15, y)
    y += 5
    doc.text(`Data da vistoria: ${new Date(vistoria.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')}`, 15, y)
    doc.text(`Vistoriador: ${vistoria.vistoriador?.nome || '—'}`, 110, y)
    y += 5
    if (vistoria.observacoes_gerais) {
      doc.text(`Observações gerais: ${vistoria.observacoes_gerais}`, 15, y)
      y += 5
    }
    y += 3
    doc.setDrawColor(200).line(15, y, W - 15, y)
    y += 6

    // Ambientes
    for (const amb of vistoria.ambientes) {
      if (y > 240) { doc.addPage(); y = 15 }

      doc.setFontSize(10).setFont('helvetica', 'bold')
      const corEstado = amb.estado === 'bom' ? [34, 197, 94] : amb.estado === 'regular' ? [234, 179, 8] : [239, 68, 68]
      doc.setFillColor(corEstado[0], corEstado[1], corEstado[2])
      doc.roundedRect(15, y - 4, W - 30, 7, 1, 1, 'F')
      doc.setTextColor(255, 255, 255)
      doc.text(`${amb.nome}  •  ${amb.estado?.toUpperCase() || 'NÃO AVALIADO'}`, 18, y)
      doc.setTextColor(0, 0, 0)
      y += 7

      if (amb.observacao) {
        doc.setFontSize(8).setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(amb.observacao, W - 35)
        doc.text(lines, 18, y)
        y += lines.length * 4 + 2
      }

      // Fotos
      if (amb.fotos?.length > 0) {
        const fotoW = 35
        const fotoH = 26
        let fx = 18
        for (const fotoUrl of amb.fotos.slice(0, 5)) {
          if (fx + fotoW > W - 15) { fx = 18; y += fotoH + 3 }
          if (y + fotoH > 270) { doc.addPage(); y = 15; fx = 18 }
          try {
            const resp = await fetch(fotoUrl)
            const blob = await resp.blob()
            const b64 = await new Promise<string>(res => {
              const r = new FileReader()
              r.onload = () => res((r.result as string).split(',')[1])
              r.readAsDataURL(blob)
            })
            doc.addImage(b64, 'JPEG', fx, y, fotoW, fotoH)
          } catch {}
          fx += fotoW + 3
        }
        y += fotoH + 5
      }
      y += 4
    }

    // Assinaturas
    if (y > 220) { doc.addPage(); y = 15 }
    y += 5
    doc.setDrawColor(200).line(15, y, W - 15, y)
    y += 8
    doc.setFontSize(9).setFont('helvetica', 'bold')
    doc.text('ASSINATURAS', 15, y)
    y += 8

    const assinaturas = ['Vistoriador', 'Administradora', 'Locador', 'Locatário']
    const colW = (W - 30) / 2
    for (let i = 0; i < assinaturas.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 15 + col * (colW + 5)
      const yy = y + row * 25
      doc.setDrawColor(150).line(x, yy + 12, x + colW - 5, yy + 12)
      doc.setFontSize(8).setFont('helvetica', 'normal')
      doc.text(assinaturas[i], x + (colW - 5) / 2, yy + 16, { align: 'center' })
    }

    // Rodapé
    doc.setFontSize(7).setTextColor(150)
    doc.text(`${org.nome} — ${org.cnpj || ''} — CRECI: ${org.creci || ''}`, W / 2, 285, { align: 'center' })

    doc.save(`vistoria-${vistoria.tipo}-${vistoria.data_vistoria}.pdf`)
    setGerandoPdf(false)
  }

  if (!vistoria) return <AppLayout><Topbar titulo="Vistoria" /><div className="p-6 text-gray-400">Carregando...</div></AppLayout>

  const estadoCor = (e: string) => e === 'bom' ? 'badge-green' : e === 'regular' ? 'badge-yellow' : e === 'ruim' ? 'badge-red' : 'badge-gray'

  return (
    <AppLayout>
      <Topbar titulo={`Vistoria de ${vistoria.tipo === 'entrada' ? 'Entrada' : 'Saída'}`} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Ações */}
          <div className="flex items-center justify-between">
            <Link href="/vistorias" className="btn btn-sm text-gray-500">
              <ArrowLeft size={13} />Voltar
            </Link>
            <div className="flex gap-2">
              <Link href={`/vistorias/${vistoria.id}/editar`} className="btn btn-sm">
                <Edit2 size={13} />Editar
              </Link>
              <button onClick={gerarPdf} disabled={gerandoPdf} className="btn btn-primary btn-sm">
                <FileDown size={13} />{gerandoPdf ? 'Gerando...' : 'Gerar PDF'}
              </button>
            </div>
          </div>

          {/* Resumo */}
          <div className="card">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-400 text-xs">Imóvel</span>
                <p className="font-medium">{vistoria.imovel?.endereco}, {vistoria.imovel?.numero}</p>
                <p className="text-gray-400 text-xs">{vistoria.imovel?.bairro} — {vistoria.imovel?.cidade}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Vistoriador</span>
                <p className="font-medium">{vistoria.vistoriador?.nome || '—'}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Data</span>
                <p className="font-medium">{new Date(vistoria.data_vistoria + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Status</span>
                <p><span className={`badge ${vistoria.status === 'concluida' ? 'badge-green' : 'badge-yellow'}`}>{vistoria.status === 'concluida' ? 'Concluída' : 'Rascunho'}</span></p>
              </div>
              {vistoria.observacoes_gerais && (
                <div className="col-span-2">
                  <span className="text-gray-400 text-xs">Observações gerais</span>
                  <p className="text-gray-700">{vistoria.observacoes_gerais}</p>
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
              {amb.observacao && <p className="text-sm text-gray-600 mb-3">{amb.observacao}</p>}
              {amb.fotos?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {amb.fotos.map((url, fi) => (
                    <img key={fi} src={url} alt="" className="w-24 h-18 object-cover rounded-lg border border-gray-200" style={{ height: '72px' }} />
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
