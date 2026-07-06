import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { deriveTrainingEntitlement } from './subscriptionEntitlement.js'

const base = {
  bodyPolicy: 'allow' as const,
  subscriptionStatus: 'free',
  completedPersonalizedIntroSessions: 0,
  hasPartialPersonalizedIntro: false,
}

describe('deriveTrainingEntitlement', () => {
  it('allows one free personalized session', () => {
    assert.equal(deriveTrainingEntitlement(base), 'allow_free_personalized')
  })

  it('always allows active subscribers', () => {
    assert.equal(deriveTrainingEntitlement({
      ...base,
      subscriptionStatus: 'pro',
      completedPersonalizedIntroSessions: 4,
    }), 'allow_subscriber')
  })

  it('requires the trial handoff for a second personalized attempt', () => {
    assert.equal(deriveTrainingEntitlement({
      ...base,
      completedPersonalizedIntroSessions: 1,
    }), 'require_trial')
  })

  it('lets a partial first attempt resume without consuming the entitlement', () => {
    assert.equal(deriveTrainingEntitlement({
      ...base,
      completedPersonalizedIntroSessions: 0,
      hasPartialPersonalizedIntro: true,
    }), 'allow_free_personalized')
  })

  it('blocks safety before subscription or free-session evaluation', () => {
    assert.equal(deriveTrainingEntitlement({
      ...base,
      bodyPolicy: 'block_safety',
      subscriptionStatus: 'pro',
    }), 'block_safety')
  })
})

describe('personalized session entitlement migration', () => {
  const sql = readFileSync('supabase/migrations/009_personalized_session_entitlement.sql', 'utf8')

  it('links intro sessions to reports and records one-time trial start', () => {
    assert.match(sql, /add column if not exists report_id uuid/i)
    assert.match(sql, /add column if not exists is_personalized_intro boolean/i)
    assert.match(sql, /add column if not exists trial_started_at timestamptz/i)
    assert.match(sql, /add column if not exists post_session_response text[\s\S]*better[\s\S]*unchanged[\s\S]*worse/i)
    assert.match(sql, /where is_personalized_intro = true[\s\S]*is_partial = false/is)
  })
})

describe('personalized intro session server contracts', () => {
  const page = readFileSync('app/session/[id]/page.tsx', 'utf8')
  const player = readFileSync('app/session/[id]/SessionPlayer.tsx', 'utf8')

  it('validates report ownership and applies safety before entitlement', () => {
    assert.match(page, /body_report_versions[\s\S]*\.eq\('user_id', user\.id\)/)
    assert.match(page, /deriveSessionBodyPolicy[\s\S]*deriveTrainingEntitlement/)
    assert.match(page, /bodyPolicy[\s\S]*completedPersonalizedIntroSessions/)
    assert.match(page, /entitlement !== 'block_safety'[\s\S]*redirect/)
  })

  it('does not let the weekly quota consume or block the personalized intro', () => {
    assert.match(page, /isPersonalizedIntro[\s\S]*FREE_WEEKLY_LIMIT/)
    assert.match(page, /!isPersonalizedIntro[\s\S]*sessionsThisWeek/)
  })

  it('persists the report link and intro marker on the session record', () => {
    assert.match(player, /report_id:\s*reportId/)
    assert.match(player, /is_personalized_intro:\s*isPersonalizedIntro/)
  })

  it('asks for body feel before revealing the seven-day trial handoff', () => {
    assert.match(player, /post_session_response/)
    assert.match(player, /Start my seven-day trial/)
    assert.match(player, /trial=true/)
    assert.match(player, /isPersonalizedIntro[\s\S]*fullyCompleted[\s\S]*postSessionFeeling/)
  })
})

describe('checkout trial contracts', () => {
  const checkout = readFileSync('app/api/stripe/checkout/route.ts', 'utf8')

  it('grants seven days once and records trial consumption after checkout succeeds', () => {
    assert.match(checkout, /searchParams\.get\('trial'\)/)
    assert.match(checkout, /trial_started_at/)
    assert.match(checkout, /trial_period_days:\s*7/)
    assert.match(checkout, /checkout\.sessions\.create[\s\S]*update\(\{ trial_started_at:/)
    assert.match(checkout, /idempotencyKey/)
  })
})
