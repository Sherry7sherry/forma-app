'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/i18n/LocaleProvider'
import { translate, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    href: '/home', labelKey: 'nav.home' as MessageKey,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={active ? '#7A9E8E' : '#8A8A8A'} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: '/sessions', labelKey: 'nav.sessions' as MessageKey,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={active ? '#7A9E8E' : '#8A8A8A'} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="10 8 16 12 10 16 10 8"
          fill={active ? '#7A9E8E' : '#8A8A8A'} stroke="none"/>
      </svg>
    ),
  },
  {
    href: '/progress', labelKey: 'nav.progress' as MessageKey,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={active ? '#7A9E8E' : '#8A8A8A'} strokeWidth="2"
           strokeLinecap="round">
        <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
      </svg>
    ),
  },
  {
    href: '/profile', labelKey: 'nav.profile' as MessageKey,
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
           stroke={active ? '#7A9E8E' : '#8A8A8A'} strokeWidth="2"
           strokeLinecap="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const path = usePathname()
  const locale = useLocale()

  // Hide on session pages
  if (path.startsWith('/session/')) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50
                    bg-cream/94 backdrop-blur-xl border-t border-border
                    safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {NAV_ITEMS.map(item => {
          const active = path === item.href
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl flex-1',
                'transition-all duration-200 active:scale-90',
                active ? 'bg-sage/8' : ''
              )}>
              <div className="w-6 h-6 flex items-center justify-center">
                {item.icon(active)}
              </div>
              <span className={cn('text-[11px] font-medium', active ? 'text-sage' : 'text-muted')}>
                {translate(locale, item.labelKey)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
