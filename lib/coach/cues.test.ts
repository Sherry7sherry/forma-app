import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCue, getSpeechVoice } from './cues'

describe('localized coach cues', () => {
  it('returns an allow-listed Chinese cue and never an English fallback', () => {
    const cue = getCue('zh-CN', 'calibrate', 0)
    assert.equal(cue.key, 'calibrate')
    assert.match(cue.text, /身体|画面|镜头/)
  })

  it('uses a matching voice locale and returns null when none exists', () => {
    const chinese = getSpeechVoice('zh-CN', [{ lang: 'en-US', name: 'English' }, { lang: 'zh-CN', name: 'Chinese' }])
    assert.equal(chinese?.lang, 'zh-CN')
    assert.equal(getSpeechVoice('zh-CN', [{ lang: 'en-US', name: 'English' }]), null)
  })
})
