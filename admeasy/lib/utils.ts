import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function diasAteVencer(dataFim: string): number {
  const hoje = new Date()
  const fim = new Date(dataFim)
  const diff = fim.getTime() - hoje.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function statusContrato(dataFim: string): 'vencendo' | 'atencao' | 'ativo' | 'encerrado' {
  const dias = diasAteVencer(dataFim)
  if (dias < 0) return 'encerrado'
  if (dias <= 15) return 'vencendo'
  if (dias <= 30) return 'atencao'
  return 'ativo'
}
