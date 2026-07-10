'use client'

import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { toPublicLocale, translate } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function PublicLanguageSwitcher({
  locale,
  className,
}: {
  locale: Locale
  className?: string
}) {
  const nextLocale: Locale = locale === 'zh-CN' ? 'en-US' : 'zh-CN'

  return (
    <Link
      href={`/${toPublicLocale(nextLocale)}`}
      onClick={() => {
        document.cookie = `forma_locale=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`
      }}
      className={cn('text-sm font-medium text-charcoal-mid hover:text-charcoal transition-colors', className)}>
      {translate(locale, 'landing.languageSwitch')}
    </Link>
  )
}
