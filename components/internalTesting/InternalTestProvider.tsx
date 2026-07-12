'use client'
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { DiagnosticSession } from '@/lib/internalTesting/clientSession'
import { IndexedDbQueue } from '@/lib/internalTesting/indexedQueue'

const Context=createContext<DiagnosticSession|null>(null)
export function InternalTestProvider({children}:{children:ReactNode}) { const [session]=useState(()=>new DiagnosticSession(new IndexedDbQueue())); const value=useMemo(()=>session,[session]); return <Context.Provider value={value}>{children}</Context.Provider> }
export function useInternalTestSession(){ const value=useContext(Context); if(!value) throw new Error('InternalTestProvider required'); return value }
