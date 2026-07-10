import type { SessionSummary, SessionSummaryInput } from './types'

export function fallbackSummary(input: SessionSummaryInput): SessionSummary {
  if (input.locale === 'zh-CN') {
    const copy = {
      building: {
        headline: '完成一次练习',
        body: '今天先把动作做完整就很好。下一次继续放慢节奏，先找回核心支撑，再继续。',
        tone: 'gentle' as const,
      },
      steady: {
        headline: '稳定完成训练',
        body: '这次训练整体很稳定。下一次继续关注肋骨和核心，让动作保持轻柔、清楚。',
        tone: 'steady' as const,
      },
      strong: {
        headline: '训练完成得很稳',
        body: '这次动作控制很清楚。下一次继续保持呼吸和核心连接，让节奏稳稳推进。',
        tone: 'celebrate' as const,
      },
    }[input.formBand]

    return {
      locale: input.locale,
      headline: copy.headline,
      body: copy.body,
      nextFocusCueKey: 'coreReset',
      tone: copy.tone,
    }
  }

  const copy = {
    building: {
      headline: 'Practice complete',
      body: 'You showed up and finished the work. Next time, slow it down and reset your center before continuing.',
      tone: 'gentle' as const,
    },
    steady: {
      headline: 'Steady session complete',
      body: 'Your practice stayed steady today. Next time, keep your ribs soft and your center connected as you move.',
      tone: 'steady' as const,
    },
    strong: {
      headline: 'Strong, steady work',
      body: 'Your control looked clear today. Next time, keep the same breath-led pace and move from your center.',
      tone: 'celebrate' as const,
    },
  }[input.formBand]

  return {
    locale: input.locale,
    headline: copy.headline,
    body: copy.body,
    nextFocusCueKey: 'coreReset',
    tone: copy.tone,
  }
}
