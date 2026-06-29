'use client'

interface TopbarProps {
  titulo: string
  children?: React.ReactNode
}

export default function Topbar({ titulo, children }: TopbarProps) {
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-sm font-semibold text-gray-900">{titulo}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
