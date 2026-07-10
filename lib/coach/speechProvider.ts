import type { Locale } from '../i18n'

export interface SpeechProvider {
  speak(input: { text: string; locale: Locale; voiceId?: string }): Promise<void>
}
