// ============================================================
// AdmEasy — API: /api/notificacoes/cron
// Roda diariamente no Render (cron job)
// Verifica contratos e seguros vencendo e dispara notificações
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enviarWhatsApp, enviarEmail, templateVencimentoContrato } from '@/lib/notificacoes'
import { diasAte, formatarMoeda } from '@/lib/calculos'

// Usar service role para acesso sem RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // Verificar autorização (Render cron usa header secreto)
  const auth = request.headers.get('x-cron-secret')
  if (auth !== process.env.JWT_SECRET) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  const resultados = {
    contratosVerificados: 0,
    segurosVerificados: 0,
    notificacoesEnviadas: 0,
    erros: [] as string[],
  }

  // ============================================================
  // 1. CONTRATOS VENCENDO
  // ============================================================
  const DIAS_ALERTA = [30, 15, 5] // enviar notificação nesses dias

  const { data: contratos, error: errContratos } = await supabase
    .from('contratos')
    .select(`
      *,
      locatario:locatario_id(id, nome, email, telefone),
      locador:locador_id(id, nome, email, telefone),
      corretor:corretor_id(id, nome, email, telefone),
      imovel:imovel_id(endereco, titulo),
      organizacao:organizacao_id(nome, telefone, email)
    `)
    .in('status', ['ativo', 'vencendo'])

  if (errContratos) {
    resultados.erros.push(`Contratos: ${errContratos.message}`)
  } else {
    for (const contrato of contratos || []) {
      const dias = diasAte(contrato.data_fim)
      resultados.contratosVerificados++

      if (DIAS_ALERTA.includes(dias)) {
        // Atualizar status para 'vencendo' se necessário
        if (dias <= 30 && contrato.status === 'ativo') {
          await supabase
            .from('contratos')
            .update({ status: 'vencendo' })
            .eq('id', contrato.id)
        }

        const tmpl = templateVencimentoContrato({
          nomeLocatario: contrato.locatario?.nome || 'Locatário',
          endereco: contrato.imovel?.endereco || contrato.imovel?.titulo || '',
          diasRestantes: dias,
          dataVencimento: new Date(contrato.data_fim).toLocaleDateString('pt-BR'),
          nomeImobiliaria: contrato.organizacao?.nome || 'Imobiliária',
          telefoneImobiliaria: contrato.organizacao?.telefone || '',
        })

        // WhatsApp para o locatário
        if (contrato.locatario?.telefone) {
          const wpp = await enviarWhatsApp(contrato.locatario.telefone, tmpl.whatsapp)
          if (wpp.sucesso) {
            resultados.notificacoesEnviadas++
            await logNotificacao(supabase, {
              organizacao_id: contrato.organizacao_id,
              tipo: `vencimento_${dias}d`,
              canal: 'whatsapp',
              destinatario_id: contrato.locatario_id,
              destinatario_nome: contrato.locatario?.nome,
              destinatario_contato: contrato.locatario?.telefone,
              referencia_tipo: 'contrato',
              referencia_id: contrato.id,
              status: 'enviado',
            })
          }
        }

        // E-mail para o locatário
        if (contrato.locatario?.email) {
          const mail = await enviarEmail({
            para: contrato.locatario.email,
            assunto: tmpl.emailAssunto,
            html: tmpl.emailHtml,
          })
          if (mail.sucesso) resultados.notificacoesEnviadas++
        }

        // Notificar corretor também se 5 dias
        if (dias === 5 && contrato.corretor?.email) {
          await enviarEmail({
            para: contrato.corretor.email,
            assunto: `[AdmEasy] Contrato #${contrato.numero} vence em 5 dias!`,
            html: `<p>O contrato <strong>#${contrato.numero}</strong> — ${contrato.imovel?.endereco} vence em <strong>5 dias</strong>. Tome as providências necessárias.</p>`,
          })
        }
      }
    }
  }

  // ============================================================
  // 2. SEGUROS VENCENDO
  // ============================================================
  const { data: seguros } = await supabase
    .from('seguros')
    .select(`
      *,
      locatario:locatario_id(nome, email, telefone),
      imovel:imovel_id(endereco),
      organizacao:organizacao_id(nome, telefone)
    `)
    .eq('status', 'ativo')

  for (const seguro of seguros || []) {
    const dias = diasAte(seguro.vigencia_fim)
    resultados.segurosVerificados++

    if (dias <= seguro.dias_aviso_renovacao && dias > 0) {
      // Atualizar status
      await supabase
        .from('seguros')
        .update({ status: 'vencendo' })
        .eq('id', seguro.id)

      const tipoLabel = seguro.tipo === 'fianca' ? 'Seguro Fiança' : 'Seguro Incêndio'
      const msg = `⚠️ Atenção, *${seguro.locatario?.nome}*!\n\nSeu *${tipoLabel}* (Apólice: ${seguro.numero_apolice}) vence em *${dias} dia(s)*.\n\nProvidence a renovação com a imobiliária.\n🏢 ${seguro.organizacao?.nome}`

      if (seguro.locatario?.telefone) {
        await enviarWhatsApp(seguro.locatario.telefone, msg)
        resultados.notificacoesEnviadas++
      }
    }
  }

  return NextResponse.json({
    sucesso: true,
    executadoEm: new Date().toISOString(),
    ...resultados,
  })
}

// Helper para gravar log de notificação
async function logNotificacao(supabase: any, dados: any) {
  await supabase.from('notificacoes_log').insert(dados)
}
