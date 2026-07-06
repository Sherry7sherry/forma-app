import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const flowPath = 'app/body-assessment/GuestAssessmentFlow.tsx'
const choicePath = 'components/assessment/ChoiceCard.tsx'

describe('guest choice-first assessment flow', () => {
  it('makes the guest body assessment the primary acquisition entry', () => {
    const landing = readFileSync('app/page.tsx', 'utf8')

    assert.match(landing, /href="\/body-assessment"/)
    assert.match(landing, /Start my free body assessment/)
    assert.match(landing, /In four minutes, learn what kind of movement fits your body today/)
    assert.doesNotMatch(landing, /Pricing|\$14\.99|Start Pro free trial/)
  })

  it('keeps assessment and insight public while the durable save remains authenticated', () => {
    const proxy = readFileSync('proxy.ts', 'utf8')
    assert.match(proxy, /PUBLIC_PATHS[\s\S]*'\/body-assessment'[\s\S]*'\/body-assessment\/insight'/)
    const publicPaths = proxy.match(/const PUBLIC_PATHS = \[([^\]]+)\]/)?.[1] ?? ''
    assert.doesNotMatch(publicPaths, /body-assessment\/save/)
  })

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
    assert.match(flow, /Pause today if you currently have:/)
    assert.match(flow, /None of these apply/)
    assert.doesNotMatch(flow, /One or more applies|Select what applies/)
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
