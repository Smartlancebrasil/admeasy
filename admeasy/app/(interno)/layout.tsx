import { OrganizationProvider } from '@/lib/OrganizationContext'

export default function InternoLayout({ children }: { children: React.ReactNode }) {
  return <OrganizationProvider>{children}</OrganizationProvider>
}