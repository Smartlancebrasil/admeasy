import { supabase } from './supabase'

type LogParams = {
  acao: string
  modulo: string
  registro_id?: string
  registro_nome?: string
  descricao: string
  dados_anteriores?: object
  dados_novos?: object
}

export async function registrarLog(params: LogParams) {
  try {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data: userRow } = await supabase
      .from('users')
      .select('nome, organization_id')
      .eq('id', userData.user.id)
      .single()

    await supabase.from('logs').insert([{
      usuario_id: userData.user.id,
      usuario_nome: userRow?.nome || userData.user.email,
      organization_id: userRow?.organization_id || null,
      acao: params.acao,
      modulo: params.modulo,
      registro_id: params.registro_id || null,
      registro_nome: params.registro_nome || null,
      descricao: params.descricao,
      dados_anteriores: params.dados_anteriores || null,
      dados_novos: params.dados_novos || null,
    }])
  } catch (e) {
    console.error('Erro ao registrar log:', e)
  }
}