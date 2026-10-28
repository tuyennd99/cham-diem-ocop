import type { ReactNode } from 'react'
import type { AppVariant } from '@/types'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app-store'

type Props = {
  children: ReactNode
  variant?: AppVariant
}

export function AppShell({ children, variant = 'sidebar' }: Props) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const isOpen = sidebarOpen

  if (variant === 'header') {
    return <div className='flex min-h-screen w-full flex-col'>{children}</div>
  }

  return <SidebarProvider defaultOpen={isOpen}>{children}</SidebarProvider>
}

