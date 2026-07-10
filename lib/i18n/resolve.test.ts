import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatMessage, messages, publicLocalePath, resolveLocale, toPublicLocale } from './index'

describe('locale resolution', () => {
  it('uses an authenticated account locale over public path and cookie values', () => {
    assert.equal(resolveLocale({ accountLocale: 'zh-CN', publicLocale: 'en', cookieLocale: 'en-US' }), 'zh-CN')
  })

  it('maps only supported public path values and falls back to English', () => {
    assert.equal(resolveLocale({ publicLocale: 'zh' }), 'zh-CN')
    assert.equal(resolveLocale({ publicLocale: 'fr' }), 'en-US')
    assert.equal(toPublicLocale('zh-CN'), 'zh')
    assert.equal(publicLocalePath('en-US'), '/en')
  })

  it('keeps the required message keys identical in both languages', () => {
    assert.deepEqual(Object.keys(messages['zh-CN']).sort(), Object.keys(messages['en-US']).sort())
  })

  it('formats only supplied named message tokens', () => {
    assert.equal(formatMessage('Hi {name}; {missing} stays.', { name: 'Sherry' }), 'Hi Sherry; {missing} stays.')
  })
})
