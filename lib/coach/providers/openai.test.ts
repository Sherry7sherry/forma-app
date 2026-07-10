import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseCoachResponse } from './openai'

describe('OpenAI coach adapter', () => {
  it('extracts only parsed JSON from a successful response body', () => {
    assert.deepEqual(parseCoachResponse({ output_text: '{"headline":"Nice work","body":"You moved steadily today.","nextFocusCueKey":"coreReset","tone":"steady"}' }), {
      headline: 'Nice work', body: 'You moved steadily today.', nextFocusCueKey: 'coreReset', tone: 'steady',
    })
  })
})
