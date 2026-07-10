import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fallbackSummary } from './fallbacks'
import { buildSummaryInput } from './summaryInput'
import { validateSummary } from './validate'

describe('coach session recap', () => {
  const input = buildSummaryInput({ locale: 'zh-CN', formScore: 83, durationSeconds: 1200, exercisesCompleted: 4, skippedExercises: 0 })

  it('keeps the model payload to derived session facts', () => {
    assert.deepEqual(Object.keys(input).sort(), ['durationMinutes', 'exercisesCompleted', 'formBand', 'locale', 'skippedExercises'])
  })

  it('returns a Chinese fallback with an allowed next-focus cue', () => {
    const summary = fallbackSummary(input)
    assert.equal(summary.locale, 'zh-CN')
    assert.match(summary.headline, /完成|训练|练习/)
    assert.equal(summary.nextFocusCueKey, 'coreReset')
  })

  it('rejects advice that invents treatment or changes the plan', () => {
    assert.equal(validateSummary(input, { headline: 'Great', body: 'Take medication and train for 45 minutes tomorrow.', nextFocusCueKey: 'coreReset', tone: 'steady' }), null)
  })
})
