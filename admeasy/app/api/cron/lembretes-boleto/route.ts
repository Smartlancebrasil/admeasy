import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

function addDias(dataISO: string, dias: number) {
  const d = new Date(dataISO + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function formatVal(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}
function formatDate(d: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(d + 'T00:00:00'))
}

// Gera um pagamento (boleto ou pix) direto na API do Mercado Pago.
// Mesma lógica usada em app/api/boleto/route.ts, reaproveitada aqui para não
// depender de uma chamada HTTP interna extra.
async function gerarPagamentoMP(payload: any, metodo: 'bolbradesco' | 'pix', idemKey: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  const res = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idemKey,
    },
    body: JSON.stringify({ ...payload, payment_method_id: metodo }),
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

function corpoEmailBoleto(nome: string, mesReferencia: string, valor: number, vencimento: string, urlBoleto: string, pixCopiaCola: string, ehLembrete: boolean) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>Olá, ${nome.split(' ')[0]}!</p>
      <p>${ehLembrete
        ? `Seu aluguel referente a <strong>${mesReferencia}</strong> vence em <strong>2 dias</strong> (${formatDate(vencimento)}) e ainda não identificamos o pagamento.`
        : `Seu boleto de aluguel referente a <strong>${mesReferencia}</strong> já está disponível. Vencimento: <strong>${formatDate(vencimento)}</strong>.`
      }</p>
      <p style="font-size: 20px; font-weight: bold;">${formatVal(valor)}</p>
      ${urlBoleto ? `<p><a href="${urlBoleto}" style="background:#1A7FFF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Baixar boleto</a></p>` : ''}
      ${pixCopiaCola ? `
        <p>Ou pague via Pix, copiando o código abaixo:</p>
        <p style="word-break:break-all;background:#f4f4f4;padding:10px;border-radius:6px;font-family:monospace;font-size:11px;">${pixCopiaCola}</p>
      ` : ''}
      <p style="color:#888;font-size:12px;margin-top:24px;">Se você já pagou, pode desconsiderar este e-mail — a confirmação pode levar até algumas horas para refletir no sistema.</p>
    </div>
  `
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Cron de lembretes: CRON_SECRET não configurado — rejeitando execução.')
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
  }

  const hoje = new Date().toISOString().split('T')[0]
  const em7dias = addDias(hoje, 7)
  const em2dias = addDias(hoje, 2)

  const resultado = { boletosGerados: 0, lembretesEnviados: 0, erros: [] as string[] }
  const remetente = process.env.EMAIL_REMETENTE || 'AdmEasy <onboarding@resend.dev>'

  try {
    // ── 1) Cobranças que vencem em 7 dias, sem boleto ainda ──────────
    const { data: paraGerar, error: erroParaGerar } = await supabaseAdmin
      .from('cobrancas')
      .select('*')
      .eq('data_vencimento', em7dias)
      .neq('status_cobranca', 'pago')
      .is('boleto_url', null)

    if (erroParaGerar) throw erroParaGerar

    if (paraGerar && paraGerar.length > 0) {
      const locatarioIds = Array.from(new Set(paraGerar.map(c => c.locatario_id)))
      const { data: clientesData } = await supabaseAdmin.from('clientes').select('id, nome, email, cpf').in('id', locatarioIds)
      const clientesMap = Object.fromEntries((clientesData || []).map(c => [c.id, c]))

      for (const c of paraGerar) {
        try {
          const cliente = clientesMap[c.locatario_id]
          if (!cliente?.email) { resultado.erros.push(`Cobrança ${c.id}: locatário sem e-mail cadastrado.`); continue }

          const valor = c.valor_total > 0 ? c.valor_total : (c.valor_aluguel || 0)
          const dataVenc = new Date(c.data_vencimento + 'T00:00:00')
          const dataFinal = dataVenc > new Date() ? dataVenc : new Date(Date.now() + 86400000)
          const dataStr = dataFinal.toISOString().split('T')[0]

          const payloadBase = {
            transaction_amount: Number(valor.toFixed(2)),
            description: `Aluguel ${c.mes_referencia || c.data_vencimento}`,
            payer: {
              first_name: cliente.nome.split(' ')[0],
              last_name: cliente.nome.split(' ').slice(1).join(' ') || cliente.nome.split(' ')[0],
              email: cliente.email,
              identification: { type: 'CPF', number: (cliente.cpf || '').replace(/\D/g, '') },
            },
            date_of_expiration: `${dataStr}T23:59:59.000-03:00`,
            metadata: { cobranca_id: c.id, mes_referencia: c.mes_referencia },
          }

          // Chave determinística (sem timestamp): reprocessar a mesma cobrança
          // reaproveita o pagamento já criado em vez de duplicar.
          const [boletoRes, pixRes] = await Promise.all([
            gerarPagamentoMP(payloadBase, 'bolbradesco', `cobranca:${c.id}:boleto`),
            gerarPagamentoMP(payloadBase, 'pix', `cobranca:${c.id}:pix`),
          ])

          if (!boletoRes.ok && !pixRes.ok) {
            resultado.erros.push(`Cobrança ${c.id}: falha ao gerar boleto e pix no Mercado Pago.`)
            continue
          }

          const urlBoleto = boletoRes.ok ? (boletoRes.data.transaction_details?.external_resource_url || '') : ''
          const linhaDigitavel = boletoRes.ok ? (boletoRes.data.transaction_details?.barcode_content || '') : ''
          const pixCopiaCola = pixRes.ok ? (pixRes.data.point_of_interaction?.transaction_data?.qr_code || '') : ''
          const pixQrBase64 = pixRes.ok ? (pixRes.data.point_of_interaction?.transaction_data?.qr_code_base64 || '') : ''
          const paymentId = boletoRes.ok ? boletoRes.data.id : pixRes.data.id

          const { error: erroPersistencia } = await supabaseAdmin.from('cobrancas').update({
            mp_payment_id: paymentId,
            boleto_url: urlBoleto,
            boleto_linha_digitavel: linhaDigitavel,
            pix_qr_code: pixCopiaCola,
            pix_qr_code_base64: pixQrBase64,
            lembrete_7d_enviado_em: new Date().toISOString(),
          }).eq('id', c.id)

          if (erroPersistencia) {
            // O Mercado Pago já pode ter criado o(s) pagamento(s), mas não
            // conseguimos salvar o link na cobrança — não envia o e-mail de
            // boleto disponível com dado que não foi persistido. A chave de
            // idempotência é determinística, então a próxima execução do
            // cron recupera o mesmo pagamento; se o erro persistir, precisa
            // de reconciliação manual (nunca logar token/chaves aqui).
            console.error('Cron de lembretes: erro ao persistir boleto/pix na cobrança — pagamento pode já existir no Mercado Pago e precisar de reconciliação.', {
              cobrancaId: c.id,
              paymentId: paymentId ? String(paymentId) : null,
              erro: erroPersistencia.message,
            })
            resultado.erros.push(`Cobrança ${c.id}: pagamento gerado, mas falhou ao salvar na cobrança.`)
            continue
          }

          await resend.emails.send({
            from: remetente,
            to: cliente.email,
            subject: `Seu boleto de aluguel de ${c.mes_referencia || ''} já está disponível`,
            html: corpoEmailBoleto(cliente.nome, c.mes_referencia || '', valor, c.data_vencimento, urlBoleto, pixCopiaCola, false),
          })

          resultado.boletosGerados++
        } catch (err: any) {
          resultado.erros.push(`Cobrança ${c.id}: ${err.message}`)
        }
      }
    }

    // ── 2) Cobranças que vencem em 2 dias, já com boleto, sem lembrete ainda ──
    const { data: paraLembrar, error: erroParaLembrar } = await supabaseAdmin
      .from('cobrancas')
      .select('*')
      .eq('data_vencimento', em2dias)
      .neq('status_cobranca', 'pago')
      .not('boleto_url', 'is', null)
      .is('lembrete_2d_enviado_em', null)

    if (erroParaLembrar) throw erroParaLembrar

    if (paraLembrar && paraLembrar.length > 0) {
      const locatarioIds = Array.from(new Set(paraLembrar.map(c => c.locatario_id)))
      const { data: clientesData } = await supabaseAdmin.from('clientes').select('id, nome, email').in('id', locatarioIds)
      const clientesMap = Object.fromEntries((clientesData || []).map(c => [c.id, c]))

      for (const c of paraLembrar) {
        try {
          const cliente = clientesMap[c.locatario_id]
          if (!cliente?.email) continue

          const valor = c.valor_total > 0 ? c.valor_total : (c.valor_aluguel || 0)

          await resend.emails.send({
            from: remetente,
            to: cliente.email,
            subject: `Lembrete: seu aluguel de ${c.mes_referencia || ''} vence em 2 dias`,
            html: corpoEmailBoleto(cliente.nome, c.mes_referencia || '', valor, c.data_vencimento, c.boleto_url, c.pix_qr_code, true),
          })

          await supabaseAdmin.from('cobrancas').update({ lembrete_2d_enviado_em: new Date().toISOString() }).eq('id', c.id)
          resultado.lembretesEnviados++
        } catch (err: any) {
          resultado.erros.push(`Cobrança ${c.id}: ${err.message}`)
        }
      }
    }

    return NextResponse.json(resultado)
  } catch (err: any) {
    console.error('Erro no cron de lembretes:', err)
    return NextResponse.json({ erro: err.message || 'Erro interno no cron.' }, { status: 500 })
  }
}
