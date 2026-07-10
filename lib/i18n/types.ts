export const LOCALES = ['en-US', 'zh-CN'] as const
export type Locale = (typeof LOCALES)[number]

export const PUBLIC_LOCALES = ['en', 'zh'] as const
export type PublicLocale = (typeof PUBLIC_LOCALES)[number]

export const messageShape = {
  'nav.home': '',
  'nav.sessions': '',
  'nav.progress': '',
  'nav.profile': '',
  'language.label': '',
  'language.english': '',
  'language.chinese': '',
  'onboarding.language.eyebrow': '',
  'onboarding.language.title': '',
  'onboarding.language.body': '',
  'onboarding.continue': '',
  'voice.calibrate': '',
  'voice.exerciseStart': '',
  'voice.transition': '',
  'voice.finish': '',
  'summary.loading': '',
  'summary.unavailable': '',
  'checkIn.title': '',
  'checkIn.disclaimer': '',
  'checkIn.save': '',
} as const

export type MessageKey = keyof typeof messageShape
export type MessageCatalog = Record<MessageKey, string>
