import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const home = () => readFileSync('app/(app)/home/page.tsx', 'utf8')
const progress = () => readFileSync('app/(app)/progress/page.tsx', 'utf8')
const dimensions = () => readFileSync('components/body-mirror/BodyMirrorDimensions.tsx', 'utf8')

describe('Body Mirror screen contracts', () => {
  it('loads the same Body Mirror module on Home and Progress', () => {
    assert.match(home(), /loadBodyMirrorForUser/)
    assert.match(progress(), /loadBodyMirrorForUser/)
  })

  it('makes Today’s Body and its recommendation reason primary on Home', () => {
    assert.match(home(), /Today(?:'|’)s Body/)
    assert.match(home(), /recommendation\.reason/)
    assert.match(home(), /BodyCheckInSheet/)
  })

  it('uses the approved ink-sage treatment for the compact Home mirror', () => {
    const homeSource = home()
    const dimensionSource = dimensions()

    assert.match(homeSource, /from-\[#3F5F54\].*to-\[#527368\]/s)
    assert.doesNotMatch(homeSource, /rounded-4xl bg-charcoal/)
    assert.doesNotMatch(homeSource, /from-\[#EDF3EF\]/)
    assert.match(homeSource, /text-\[#DCE8E1\]/)
    assert.match(dimensionSource, /divide-white\/15/)
    assert.match(dimensionSource, /bg-white\/10 text-cream/)
    assert.match(dimensionSource, /COMPACT_STATE_STYLES/)
  })

  it('makes the three body dimensions primary and removes average form score from Progress', () => {
    const source = progress()

    assert.match(source, /Comfort/)
    assert.match(source, /Mobility/)
    assert.match(source, /Movement control/)
    assert.doesNotMatch(source, /form_score|Avg form score|Form score this week/i)
  })

  it('keeps partial attempts visible but outside completed activity', () => {
    assert.match(progress(), /partialAttempts/)
    assert.match(progress(), /Partial attempts are saved as evidence/)
  })
})
