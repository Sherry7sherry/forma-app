import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const flowPath = 'app/body-assessment/GuestAssessmentFlow.tsx'
const choicePath = 'components/assessment/ChoiceCard.tsx'

describe('guest choice-first assessment flow', () => {
  it('uses accessible native choices and keeps six quick questions explicit', () => {
    const flow = readFileSync(flowPath, 'utf8')
    const choice = readFileSync(choicePath, 'utf8')

    assert.match(choice, /<button/)
    assert.match(choice, /aria-pressed/)
    assert.match(flow, /6 quick choices/)
    assert.match(flow, /selected\.length >= 2/)
    assert.doesNotMatch(flow, /<textarea|required=.*text/i)
  })

  it('shows human stage labels and screens safety before camera work', () => {
    const flow = readFileSync(flowPath, 'utf8')

    for (const label of ['Get to know you', 'Prepare assessment', 'Build report']) {
      assert.match(flow, new RegExp(label))
    }
    assert.match(flow, /screenAssessment\(/)
    assert.doesNotMatch(flow, /\d+% complete|question \d+ of/i)
  })

  it('keeps guest answers ephemeral and stop guidance free', () => {
    const flow = readFileSync(flowPath, 'utf8')

    assert.match(flow, /sessionStorage/)
    assert.doesNotMatch(flow, /localStorage/)
    assert.doesNotMatch(flow, /createClient|supabase/i)
    assert.doesNotMatch(flow, /checkout|upgrade|subscription|price/i)
  })
})
