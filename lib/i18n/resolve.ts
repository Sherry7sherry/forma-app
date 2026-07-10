import type { Locale, PublicLocale } from './types'

const publicToLocale: Record<PublicLocale, Locale> = {
  en: 'en-US',
  zh: 'zh-CN',
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en-US' || value === 'zh-CN'
}

export function isPublicLocale(value: string | null | undefined): value is PublicLocale {
  return value === 'en' || value === 'zh'
}

export function resolveLocale(input: {
  accountLocale?: string | null
  publicLocale?: string | null
  cookieLocale?: string | null
}): Locale {
  if (isLocale(input.accountLocale)) return input.accountLocale
  if (isPublicLocale(input.publicLocale)) return publicToLocale[input.publicLocale]
  if (isLocale(input.cookieLocale)) return input.cookieLocale
  return 'en-US'
}

export function toPublicLocale(locale: Locale): PublicLocale {
  return locale === 'zh-CN' ? 'zh' : 'en'
}

export function publicLocalePath(locale: Locale): `/${PublicLocale}` {
  return `/${toPublicLocale(locale)}`
}

export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (token, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : token
  )
}
