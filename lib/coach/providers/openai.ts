import { buildSummaryPrompt, summaryResponseFormat } from '../prompt'
import type { SessionSummaryInput } from '../types'

export function parseCoachResponse(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('output_text' in body)) return null
  const outputText = (body as { output_text?: unknown }).output_text
  if (typeof outputText !== 'string') return null
  return JSON.parse(outputText)
}

export async function generateCoachSummary(input: SessionSummaryInput): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_COACH_MODEL
  if (!apiKey || !model) throw new Error('Coach provider is not configured')

  const prompt = buildSummaryPrompt(input)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: prompt.system },
        { role: 'developer', content: prompt.developer },
        { role: 'user', content: prompt.user },
      ],
      text: { format: summaryResponseFormat },
    }),
    signal: AbortSignal.timeout(6_000),
  })

  if (!response.ok) throw new Error(`Coach provider returned ${response.status}`)
  return parseCoachResponse(await response.json())
}
