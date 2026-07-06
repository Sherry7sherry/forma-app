import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'

const landing = readFileSync('app/page.tsx', 'utf8')
const home = readFileSync('app/(app)/home/page.tsx', 'utf8')
const sessions = readFileSync('app/(app)/sessions/SessionsClient.tsx', 'utf8')
const profile = readFileSync('app/(app)/profile/page.tsx', 'utf8')
const bottomNav = readFileSync('components/nav/BottomNav.tsx', 'utf8')

describe('AI Pilates Coach positioning', () => {
  it('uses the approved public landing hero positioning', () => {
    assert.match(landing, /AI Pilates Coach/)
    assert.match(landing, /An AI Pilates coach that learns your body\./)
    assert.match(landing, /Start with a quick body assessment/)
    assert.match(landing, /personalized Pilates sessions that adapt as your body changes/)
    assert.match(landing, /See how Forma personalizes/)
  })

  it('explains personalization through compact modules, not bottom tabs', () => {
    for (const label of ['Body assessment', 'Today’s plan', 'AI coaching', 'Body progress']) {
      assert.match(landing, new RegExp(label))
    }
    assert.doesNotMatch(bottomNav, /Body assessment|Today’s plan|AI coaching|Body progress/)
  })

  it('keeps logged-in home focused on today rather than product education', () => {
    assert.match(home, /Today’s Body/)
    assert.match(home, /Today’s Plan/)
    assert.doesNotMatch(home, /How Forma personalizes/)
  })

  it('frames sessions as a smart Pilates library', () => {
    for (const label of ['Quick Reset', 'Full Practice', 'Recovery', 'Strength', 'Mobility', 'Core']) {
      assert.match(sessions, new RegExp(label))
    }
    assert.match(sessions, /Pilates sessions matched to your body and your day\./)
  })

  it('sells Pro as personalized coaching, not only unlimited access', () => {
    assert.match(profile, /Personalized coaching/)
    assert.match(profile, /Upgrade to Forma Pro/)
    assert.match(profile, /living body report updates/)
    assert.match(profile, /body pattern insights/)
  })
})
