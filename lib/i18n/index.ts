import { enUSMessages } from './messages/en-US'
import { zhCNMessages } from './messages/zh-CN'
import type { Locale, MessageKey } from './types'

export { formatMessage, isLocale, isPublicLocale, publicLocalePath, resolveLocale, toPublicLocale } from './resolve'
export { LOCALES, messageShape, PUBLIC_LOCALES } from './types'
export type { Locale, MessageCatalog, MessageKey, PublicLocale } from './types'

export const messages = {
  'en-US': enUSMessages,
  'zh-CN': zhCNMessages,
} as const

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key]
}
