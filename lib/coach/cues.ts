import type { Locale } from '../i18n'
import { formatMessage } from '../i18n'

export type CoachCueKey =
  | 'calibrate'
  | 'exerciseStart'
  | 'transition'
  | 'finish'
  | 'frameBody'
  | 'slowDown'
  | 'coreReset'

type CueTemplate = {
  key: CoachCueKey
  text: string
}

export type CoachCue = {
  key: CoachCueKey
  text: string
}

export type SpeechVoiceLike = {
  lang: string
  name?: string
}

const cueCatalog: Record<Locale, Record<CoachCueKey, CueTemplate[]>> = {
  'en-US': {
    calibrate: [
      { key: 'calibrate', text: 'Move until your full body is in frame. I will start automatically.' },
      { key: 'calibrate', text: 'Step into view so I can see your whole body.' },
    ],
    exerciseStart: [
      { key: 'exerciseStart', text: 'Starting {exerciseName}. {target}.' },
      { key: 'exerciseStart', text: 'Let’s begin {exerciseName}. {target}.' },
    ],
    transition: [
      { key: 'transition', text: 'Great. Next: {exerciseName}. Starting in {seconds} seconds.' },
      { key: 'transition', text: 'Nice work. {exerciseName} is next in {seconds} seconds.' },
    ],
    finish: [
      { key: 'finish', text: 'Great. That was your last exercise. Finishing up.' },
      { key: 'finish', text: 'Session complete. Nice steady work.' },
    ],
    frameBody: [
      { key: 'frameBody', text: 'Step back, I need your full body.' },
      { key: 'frameBody', text: 'Adjust the camera so your whole body stays in view.' },
    ],
    slowDown: [
      { key: 'slowDown', text: 'Slow it down and keep the movement smooth.' },
      { key: 'slowDown', text: 'Move a little slower so I can track you clearly.' },
    ],
    coreReset: [
      { key: 'coreReset', text: 'Slow it down—soften your ribs back in, then continue.' },
      { key: 'coreReset', text: 'Reset your center, then keep moving gently.' },
    ],
  },
  'zh-CN': {
    calibrate: [
      { key: 'calibrate', text: '移动到画面里，让我看到你的全身，我会自动开始。' },
      { key: 'calibrate', text: '请把身体放进镜头画面里，让我看到全身。' },
    ],
    exerciseStart: [
      { key: 'exerciseStart', text: '开始 {exerciseName}。{target}。' },
      { key: 'exerciseStart', text: '我们开始 {exerciseName}。{target}。' },
    ],
    transition: [
      { key: 'transition', text: '很好，下一个动作是 {exerciseName}，{seconds} 秒后开始。' },
      { key: 'transition', text: '做得不错，接下来是 {exerciseName}，{seconds} 秒后开始。' },
    ],
    finish: [
      { key: 'finish', text: '很好，这是最后一个动作，正在结束训练。' },
      { key: 'finish', text: '本次训练完成，刚刚做得很稳定。' },
    ],
    frameBody: [
      { key: 'frameBody', text: '往后退一点，我需要看到你的全身。' },
      { key: 'frameBody', text: '调整一下镜头，让全身留在画面里。' },
    ],
    slowDown: [
      { key: 'slowDown', text: '慢一点，让动作更稳定。' },
      { key: 'slowDown', text: '稍微放慢，我会更清楚地跟踪动作。' },
    ],
    coreReset: [
      { key: 'coreReset', text: '先慢一点，轻轻把肋骨收回来，再继续。' },
      { key: 'coreReset', text: '重新找回核心支撑，再轻柔地继续。' },
    ],
  },
}

export function getCue(
  locale: Locale,
  key: CoachCueKey,
  seed: number,
  values: Record<string, string | number> = {},
): CoachCue {
  const variants = cueCatalog[locale][key]
  const template = variants[Math.abs(seed) % variants.length]
  return {
    key: template.key,
    text: formatMessage(template.text, values),
  }
}

export function getSpeechVoice<T extends SpeechVoiceLike>(locale: Locale, voices: T[]): T | null {
  const prefix = locale === 'zh-CN' ? 'zh' : 'en'
  return voices.find(voice => voice.lang.toLowerCase().startsWith(prefix)) ?? null
}
