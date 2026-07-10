import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      valor,
      valorAtualizado,
      vencimento,
      nomeLocatario,
      emailLocatario,
      cpfLocatario,
      descricao,
      cobrancaId,
      mesReferencia,
    } = body

    if (!cobrancaId) {
      return NextResponse.json({ erro: 'cobrancaId é obrigatório.' }, { status: 400 })
    }

    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!token) {
      return NextResponse.json({ erro: 'Token do Mercado Pago não configurado.' }, { status: 500 })
    }

    // Data de vencimento: mínimo D+1
    const hoje = new Date()
    const dataVenc = new Date(vencimento + 'T00:00:00')
    const dataFinal = dataVenc > hoje ? dataVenc : new Date(hoje.getTime() + 86400000)
    const dataStr = dataFinal.toISOString().split('T')[0]

    // Evita gerar um segundo boleto/pix pra mesma cobrança (ex.: duplo clique):
    // se já existe link gerado e a cobrança ainda não foi paga, reaproveita em
    // vez de criar um novo pagamento no Mercado Pago.
    const { data: cobrancaExistente, error: erroCobranca } = await supabaseAdmin
      .from('cobrancas')
      .select('id, status_cobranca, mp_payment_id, boleto_url, boleto_linha_digitavel, pix_qr_code, pix_qr_code_base64')
      .eq('id', cobrancaId)
      .maybeSingle()

    if (erroCobranca || !cobrancaExistente) {
      return NextResponse.json({ erro: 'Cobrança não encontrada.' }, { status: 404 })
    }

    if (cobrancaExistente.status_cobranca === 'pago') {
      return NextResponse.json({ erro: 'Esta cobrança já está paga.' }, { status: 409 })
    }

    if (cobrancaExistente.boleto_url || cobrancaExistente.pix_qr_code) {
      return NextResponse.json({
        id: cobrancaExistente.mp_payment_id,
        idBoleto: cobrancaExistente.mp_payment_id,
        idPix: cobrancaExistente.mp_payment_id,
        status: 'pending',
        linhaDigitavel: cobrancaExistente.boleto_linha_digitavel || '',
        urlBoleto: cobrancaExistente.boleto_url || '',
        qrCodePix: cobrancaExistente.pix_qr_code || '',
        qrCodePixBase64: cobrancaExistente.pix_qr_code_base64 || '',
        valorFinal: Number((valorAtualizado || valor).toFixed(2)),
        vencimento: dataStr,
        erroBoleto: null,
        erroPix: null,
      })
    }

    const payloadBase = {
      transaction_amount: Number((valorAtualizado || valor).toFixed(2)),
      description: descricao || `Aluguel ${mesReferencia || vencimento}`,
      payer: {
        first_name: nomeLocatario.split(' ')[0],
        last_name: nomeLocatario.split(' ').slice(1).join(' ') || nomeLocatario.split(' ')[0],
        email: emailLocatario || 'locatario@admeasy.com.br',
        identification: {
          type: 'CPF',
          number: (cpfLocatario || '').replace(/\D/g, ''),
        },
      },
      date_of_expiration: `${dataStr}T23:59:59.000-03:00`,
      metadata: {
        cobranca_id: cobrancaId,
        mes_referencia: mesReferencia,
      },
    }

    // Chave determinística (sem timestamp): a mesma cobrança sempre gera a
    // mesma chave, então cliques repetidos ou reprocessamentos reaproveitam
    // o pagamento já criado no Mercado Pago em vez de duplicar.
    const idemKeyBoleto = `cobranca:${cobrancaId}:boleto`
    const idemKeyPix = `cobranca:${cobrancaId}:pix`

    // Gera os dois pagamentos em paralelo: um boleto (bolbradesco) e um Pix.
    // São dois pagamentos distintos no Mercado Pago para a mesma cobrança —
    // o locatário paga por qualquer um dos dois, e o webhook identifica a
    // cobrança certa em ambos os casos via metadata.cobranca_id.
    const [resBoleto, resPix] = await Promise.all([
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idemKeyBoleto,
        },
        body: JSON.stringify({ ...payloadBase, payment_method_id: 'bolbradesco' }),
      }),
      fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idemKeyPix,
        },
        body: JSON.stringify({ ...payloadBase, payment_method_id: 'pix' }),
      }),
    ])

    const [dataBoleto, dataPix] = await Promise.all([resBoleto.json(), resPix.json()])

    if (!resBoleto.ok) console.error('Erro Mercado Pago (boleto):', dataBoleto)
    if (!resPix.ok) console.error('Erro Mercado Pago (pix):', dataPix)

    // Se os dois falharem, aí sim é erro real — sem boleto e sem Pix não tem
    // como o locatário pagar nada.
    if (!resBoleto.ok && !resPix.ok) {
      return NextResponse.json({
        erro: dataBoleto.message || dataPix.message || 'Erro ao gerar boleto e Pix no Mercado Pago.',
        detalhes: { boleto: dataBoleto, pix: dataPix },
      }, { status: 500 })
    }

    const paymentId = dataBoleto?.id || dataPix?.id
    const urlBoleto = resBoleto.ok ? (dataBoleto.transaction_details?.external_resource_url || '') : ''
    const linhaDigitavel = resBoleto.ok ? (dataBoleto.transaction_details?.barcode_content || '') : ''
    const qrCodePix = resPix.ok ? (dataPix.point_of_interaction?.transaction_data?.qr_code || '') : ''
    const qrCodePixBase64 = resPix.ok ? (dataPix.point_of_interaction?.transaction_data?.qr_code_base64 || '') : ''

    // Persiste o link gerado na cobrança — é o que permite ao próximo clique
    // (ou a um reprocessamento) reaproveitar em vez de gerar outro pagamento.
    if (urlBoleto || qrCodePix) {
      const { error: erroPersistencia } = await supabaseAdmin.from('cobrancas').update({
        mp_payment_id: paymentId ? String(paymentId) : null,
        boleto_url: urlBoleto || null,
        boleto_linha_digitavel: linhaDigitavel || null,
        pix_qr_code: qrCodePix || null,
        pix_qr_code_base64: qrCodePixBase64 || null,
      }).eq('id', cobrancaId)

      if (erroPersistencia) {
        // O Mercado Pago já pode ter criado o(s) pagamento(s), mas não
        // conseguimos salvar o link na cobrança. A chave de idempotência é
        // determinística, então uma nova tentativa recupera o mesmo
        // boleto/pix — mas se o erro persistir, precisa de reconciliação
        // manual (não expor detalhes internos nem o token na resposta/log).
        console.error('Erro ao persistir boleto/pix na cobrança — pagamento pode já existir no Mercado Pago e precisar de reconciliação.', {
          cobrancaId,
          paymentId: paymentId ? String(paymentId) : null,
          erro: erroPersistencia.message,
        })
        return NextResponse.json({
          erro: 'O pagamento foi gerado, mas não foi possível salvar o link agora. Tente novamente em instantes.',
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      // "id" mantido por compatibilidade com o código atual do portal, que
      // salva esse valor em cobrancas.mp_payment_id
      id: paymentId,
      idBoleto: resBoleto.ok ? dataBoleto.id : null,
      idPix: resPix.ok ? dataPix.id : null,
      status: (resBoleto.ok ? dataBoleto.status : null) || (resPix.ok ? dataPix.status : null),
      linhaDigitavel,
      urlBoleto,
      qrCodePix,
      qrCodePixBase64,
      valorFinal: (resBoleto.ok ? dataBoleto.transaction_amount : null) ?? (resPix.ok ? dataPix.transaction_amount : null),
      vencimento: dataStr,
      erroBoleto: resBoleto.ok ? null : (dataBoleto.message || 'Falha ao gerar boleto.'),
      erroPix: resPix.ok ? null : (dataPix.message || 'Falha ao gerar Pix.'),
    })
  } catch (err: any) {
    console.error('Erro interno:', err)
    return NextResponse.json({ erro: 'Erro interno ao gerar boleto.' }, { status: 500 })
  }
}
