import type { ReactNode } from 'react'
import { requireInternalTester } from '@/lib/internalTesting/auth'
import { InternalTestProvider } from '@/components/internalTesting/InternalTestProvider'

export default async function InternalLayout({ children }: { children: ReactNode }) {
  await requireInternalTester()
  return <InternalTestProvider>{children}</InternalTestProvider>
}
