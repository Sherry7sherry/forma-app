import type { ReactNode } from 'react'
import { requireInternalTester } from '@/lib/internalTesting/auth'

export default async function InternalLayout({ children }: { children: ReactNode }) {
  await requireInternalTester()
  return children
}
