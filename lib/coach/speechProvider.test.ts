import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { SpeechProvider } from './speechProvider'

describe('speech provider boundary', () => {
  it('keeps locale and voice identity in the provider request contract', () => {
    const provider: SpeechProvider = { speak: async input => { assert.equal(input.locale, 'zh-CN') } }
    return provider.speak({ text: '轻轻收回肋骨。', locale: 'zh-CN', voiceId: 'future-premium-zh' })
  })
})
