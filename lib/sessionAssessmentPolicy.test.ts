import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const sessionPage = () => readFileSync('app/session/[id]/page.tsx', 'utf8')
const sessionPlayer = () => readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')

describe('Session body assessment policy integration', () => {
  it('derives the Session policy from the shared Body Mirror result', () => {
    const source = sessionPage()

    assert.match(source, /loadBodyMirrorForUser/)
    assert.match(source, /deriveSessionBodyPolicy/)
    assert.match(source, /bodyPolicy=/)
  })

  it('prompts for assessment while allowing an explicit skip', () => {
    const source = sessionPlayer()

    assert.match(source, /prompt_assessment/)
    assert.match(source, /Assess first/)
    assert.match(source, /Continue without assessment/)
    assert.match(source, /href="\/assessment"/)
  })

  it('hard-blocks session record creation when a safety hold is active', () => {
    const source = sessionPlayer()

    assert.match(source, /block_safety/)
    assert.match(source, /Movement is paused/)
    assert.match(source, /if \(bodyPolicy === 'block_safety'\) return/)
  })
})
