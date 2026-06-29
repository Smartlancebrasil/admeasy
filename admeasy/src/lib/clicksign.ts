// ============================================================
// AdmEasy — Integração Clicksign
// Documentação: https://developers.clicksign.com
// ============================================================

import axios from 'axios'

const BASE_URL = process.env.CLICKSIGN_BASE_URL || 'https://sandbox.clicksign.com'
const API_KEY  = process.env.CLICKSIGN_API_KEY || ''

const clicksign = axios.create({
  baseURL: BASE_URL,
  params: { access_token: API_KEY },
  headers: { 'Content-Type': 'application/json' },
})

// ============================================================
// Criar documento no Clicksign a partir de base64 (PDF)
// ============================================================
export async function criarDocumento(params: {
  nomeArquivo: string       // ex: "contrato-042.pdf"
  conteudoBase64: string    // PDF em base64
  mensagem?: string
  prazoAssinaturasDias?: number
}): Promise<{ sucesso: boolean; docKey?: string; erro?: string }> {
  try {
    const response = await clicksign.post('/api/v1/documents', {
      document: {
        path: `/${params.nomeArquivo}`,
        content_base64: `data:application/pdf;base64,${params.conteudoBase64}`,
        deadline_at: prazoISO(params.prazoAssinaturasDias || 7),
        auto_close: true,
        locale: 'pt-BR',
        sequence_enabled: false,
      },
    })
    return { sucesso: true, docKey: response.data.document.key }
  } catch (error: any) {
    console.error('[Clicksign] Erro ao criar documento:', error?.response?.data)
    return { sucesso: false, erro: JSON.stringify(error?.response?.data) }
  }
}

// ============================================================
// Adicionar signatário ao documento
// ============================================================
export async function adicionarSignatario(params: {
  docKey: string
  nome: string
  email: string
  cpf?: string
  tipoAssinatura?: 'sign' | 'approve' | 'witness'  // sign = assinar, approve = aprovar
  autenticarPor?: 'email' | 'pix' | 'icp-brasil'
}): Promise<{ sucesso: boolean; signerKey?: string; erro?: string }> {
  try {
    // 1. Criar signatário
    const resSigner = await clicksign.post('/api/v1/signers', {
      signer: {
        email: params.email,
        name: params.nome,
        documentation: params.cpf?.replace(/\D/g, '') || '',
        birthday: null,
        has_documentation: !!params.cpf,
        auths: [params.autenticarPor || 'email'],
      },
    })
    const signerKey = resSigner.data.signer.key

    // 2. Vincular signatário ao documento
    await clicksign.post('/api/v1/lists', {
      list: {
        document_key: params.docKey,
        signer_key: signerKey,
        sign_as: params.tipoAssinatura || 'sign',
        refusable: false,
        message: 'Por favor, assine o documento.',
      },
    })

    return { sucesso: true, signerKey }
  } catch (error: any) {
    console.error('[Clicksign] Erro ao adicionar signatário:', error?.response?.data)
    return { sucesso: false, erro: JSON.stringify(error?.response?.data) }
  }
}

// ============================================================
// Notificar signatários (enviar e-mail com link)
// ============================================================
export async function notificarSignatarios(docKey: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    await clicksign.post(`/api/v1/notifications`, {
      document_key: docKey,
      message: 'Por favor, acesse o link abaixo para assinar o documento.',
    })
    return { sucesso: true }
  } catch (error: any) {
    console.error('[Clicksign] Erro ao notificar:', error?.response?.data)
    return { sucesso: false, erro: JSON.stringify(error?.response?.data) }
  }
}

// ============================================================
// Consultar status do documento
// ============================================================
export async function consultarDocumento(docKey: string): Promise<{
  sucesso: boolean
  status?: string
  signatarios?: Array<{ nome: string; email: string; assinou: boolean; assinadoEm?: string }>
  erro?: string
}> {
  try {
    const response = await clicksign.get(`/api/v1/documents/${docKey}`)
    const doc = response.data.document
    return {
      sucesso: true,
      status: doc.status,
      signatarios: doc.signers?.map((s: any) => ({
        nome: s.name,
        email: s.email,
        assinou: s.signed_at !== null,
        assinadoEm: s.signed_at,
      })),
    }
  } catch (error: any) {
    console.error('[Clicksign] Erro ao consultar:', error?.response?.data)
    return { sucesso: false, erro: JSON.stringify(error?.response?.data) }
  }
}

// ============================================================
// Baixar PDF assinado
// ============================================================
export async function baixarDocumentoAssinado(docKey: string): Promise<{
  sucesso: boolean
  pdfBase64?: string
  erro?: string
}> {
  try {
    const response = await clicksign.get(`/api/v1/documents/${docKey}/download`, {
      responseType: 'arraybuffer',
    })
    const base64 = Buffer.from(response.data).toString('base64')
    return { sucesso: true, pdfBase64: base64 }
  } catch (error: any) {
    return { sucesso: false, erro: error?.message }
  }
}

// Helper: data limite ISO
function prazoISO(dias: number): string {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  return data.toISOString()
}

// ============================================================
// Fluxo completo: criar contrato + adicionar partes + notificar
// ============================================================
export async function enviarContratoParaAssinatura(params: {
  nomeArquivo: string
  pdfBase64: string
  partes: Array<{ nome: string; email: string; cpf?: string; tipo: 'sign' | 'approve' }>
  mensagem?: string
}): Promise<{ sucesso: boolean; docKey?: string; erro?: string }> {
  // 1. Criar documento
  const doc = await criarDocumento({
    nomeArquivo: params.nomeArquivo,
    conteudoBase64: params.pdfBase64,
    prazoAssinaturasDias: 7,
  })
  if (!doc.sucesso || !doc.docKey) return { sucesso: false, erro: doc.erro }

  // 2. Adicionar cada parte
  for (const parte of params.partes) {
    const signer = await adicionarSignatario({
      docKey: doc.docKey,
      nome: parte.nome,
      email: parte.email,
      cpf: parte.cpf,
      tipoAssinatura: parte.tipo,
    })
    if (!signer.sucesso) {
      console.error(`[Clicksign] Falha ao adicionar ${parte.nome}`)
    }
  }

  // 3. Notificar todos
  await notificarSignatarios(doc.docKey)

  return { sucesso: true, docKey: doc.docKey }
}
