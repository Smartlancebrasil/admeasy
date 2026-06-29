// ============================================================
// AdmEasy — Serviço de notificações
// WhatsApp (Whapi.cloud) + E-mail (SMTP)
// ============================================================

import axios from 'axios'

// ============================================================
// WHATSAPP via Whapi.cloud
// ============================================================
export async function enviarWhatsApp(
  numero: string,     // ex: "5511999990000"
  mensagem: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const response = await axios.post(
      `${process.env.WHAPI_BASE_URL}/messages/text`,
      {
        to: numero.replace(/\D/g, ''),
        body: mensagem,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )
    return { sucesso: true }
  } catch (error: any) {
    console.error('[WhatsApp] Erro ao enviar:', error?.response?.data || error.message)
    return { sucesso: false, erro: error?.message }
  }
}

// ============================================================
// E-MAIL via SMTP (nodemailer)
// ============================================================
export async function enviarEmail(params: {
  para: string
  assunto: string
  html: string
}): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    // Importação dinâmica para evitar problemas no edge
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: params.para,
      subject: params.assunto,
      html: params.html,
    })

    return { sucesso: true }
  } catch (error: any) {
    console.error('[Email] Erro ao enviar:', error.message)
    return { sucesso: false, erro: error?.message }
  }
}

// ============================================================
// TEMPLATES DE MENSAGEM
// ============================================================
export function templateVencimentoContrato(params: {
  nomeLocatario: string
  endereco: string
  diasRestantes: number
  dataVencimento: string
  nomeImobiliaria: string
  telefoneImobiliaria: string
}): { whatsapp: string; emailHtml: string; emailAssunto: string } {
  const urgencia = params.diasRestantes <= 5 ? '🚨 URGENTE: ' : ''

  const whatsapp = `${urgencia}Olá, *${params.nomeLocatario}*! 👋

Passando para avisar que seu contrato de locação do imóvel:
📍 *${params.endereco}*

vence em *${params.diasRestantes} dia(s)* — ${params.dataVencimento}.

Para renovação ou mais informações, entre em contato:
📞 ${params.telefoneImobiliaria}
🏢 ${params.nomeImobiliaria}

_Este é um aviso automático do AdmEasy._`

  const emailAssunto = `${urgencia}Seu contrato vence em ${params.diasRestantes} dia(s) — ${params.endereco}`

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#185FA5;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">${params.nomeImobiliaria}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;padding:24px;border-radius:0 0 8px 8px">
        <p>Olá, <strong>${params.nomeLocatario}</strong>!</p>
        <div style="background:${params.diasRestantes <= 5 ? '#fcebeb' : '#faeeda'};border-left:4px solid ${params.diasRestantes <= 5 ? '#e24b4a' : '#ef9f27'};padding:16px;border-radius:4px;margin:16px 0">
          <strong>Seu contrato vence em ${params.diasRestantes} dia(s)</strong><br>
          📍 ${params.endereco}<br>
          📅 Data de vencimento: ${params.dataVencimento}
        </div>
        <p>Para tratar da renovação, entre em contato conosco:</p>
        <p>📞 <strong>${params.telefoneImobiliaria}</strong></p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:12px;color:#888">Este é um aviso automático gerado pelo AdmEasy. Não responda este e-mail.</p>
      </div>
    </div>`

  return { whatsapp, emailHtml, emailAssunto }
}

export function templateReajuste(params: {
  nomeLocatario: string
  endereco: string
  indice: string
  percentual: string
  valorAnterior: string
  valorNovo: string
  dataVigencia: string
  nomeImobiliaria: string
}): { whatsapp: string; emailHtml: string; emailAssunto: string } {
  const whatsapp = `Olá, *${params.nomeLocatario}*! 📊

Informamos que o valor do seu aluguel foi reajustado:

📍 *${params.endereco}*
📈 Índice: *${params.indice} (${params.percentual})*
💰 Valor anterior: ${params.valorAnterior}
✅ Novo valor: *${params.valorNovo}*
📅 Vigência: a partir de ${params.dataVigencia}

O aditivo contratual foi enviado para assinatura digital.

🏢 ${params.nomeImobiliaria}`

  const emailAssunto = `Reajuste de aluguel — ${params.endereco} — ${params.dataVigencia}`

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="background:#185FA5;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">${params.nomeImobiliaria}</h1>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;padding:24px;border-radius:0 0 8px 8px">
        <p>Olá, <strong>${params.nomeLocatario}</strong>!</p>
        <p>Informamos que o valor do seu aluguel foi reajustado conforme cláusula contratual:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="background:#f5f5f5"><td style="padding:10px;border:1px solid #eee">Imóvel</td><td style="padding:10px;border:1px solid #eee"><strong>${params.endereco}</strong></td></tr>
          <tr><td style="padding:10px;border:1px solid #eee">Índice</td><td style="padding:10px;border:1px solid #eee">${params.indice} — ${params.percentual}</td></tr>
          <tr style="background:#f5f5f5"><td style="padding:10px;border:1px solid #eee">Valor anterior</td><td style="padding:10px;border:1px solid #eee">${params.valorAnterior}</td></tr>
          <tr><td style="padding:10px;border:1px solid #eee"><strong>Novo valor</strong></td><td style="padding:10px;border:1px solid #eee;color:#3b6d11"><strong>${params.valorNovo}</strong></td></tr>
          <tr style="background:#f5f5f5"><td style="padding:10px;border:1px solid #eee">Vigência</td><td style="padding:10px;border:1px solid #eee">A partir de ${params.dataVigencia}</td></tr>
        </table>
        <p>Em anexo, o aditivo contratual para sua assinatura digital.</p>
      </div>
    </div>`

  return { whatsapp, emailHtml, emailAssunto }
}
