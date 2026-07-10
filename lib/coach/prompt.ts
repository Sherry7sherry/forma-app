import type { SessionSummaryInput } from './types'

export const summaryResponseFormat = {
  type: 'json_schema',
  name: 'forma_session_summary',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'body', 'nextFocusCueKey', 'tone'],
    properties: {
      headline: { type: 'string' },
      body: { type: 'string' },
      nextFocusCueKey: {
        type: 'string',
        enum: ['calibrate', 'exerciseStart', 'transition', 'finish', 'frameBody', 'slowDown', 'coreReset'],
      },
      tone: {
        type: 'string',
        enum: ['celebrate', 'steady', 'gentle'],
      },
    },
  },
  strict: true,
} as const

export function buildSummaryPrompt(input: SessionSummaryInput) {
  const language = input.locale === 'zh-CN' ? 'Simplified Chinese' : 'English'

  return {
    system: [
      'You write concise post-session Pilates coach recaps for Forma.',
      `Write only in ${language}. Do not mix languages.`,
      'Use only the provided derived session facts.',
      'Do not diagnose, mention treatment, claim pain relief, prescribe, or give medical advice.',
      'Do not choose exercises, change intensity, change duration, or change the plan.',
      'Use one nextFocusCueKey from the supplied schema; do not invent advice.',
    ].join('\n'),
    developer: [
      'Return valid JSON matching the schema exactly.',
      'headline: <= 12 English words or <= 18 Chinese characters.',
      'body: <= 48 English words or <= 72 Chinese characters.',
      'Be warm, direct, and non-judgmental.',
    ].join('\n'),
    user: JSON.stringify(input),
  }
}
