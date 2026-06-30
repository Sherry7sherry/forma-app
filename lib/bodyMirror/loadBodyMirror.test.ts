import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { loadBodyMirrorForUser } from './loadBodyMirror.js'

interface FakeResult {
  data: unknown[] | null
  error: { message: string } | null
}

function fakeSupabase(results: Record<string, FakeResult>) {
  const calls: Array<{ table: string; userId?: string }> = []
  return {
    calls,
    from(table: string) {
      const call = { table, userId: undefined as string | undefined }
      calls.push(call)
      const query = {
        select() { return query },
        eq(_column: string, value: string) { call.userId = value; return query },
        order() { return query },
        limit() { return query },
        then(resolve: (value: FakeResult) => void) {
          resolve(results[table] ?? { data: [], error: null })
        },
      }
      return query
    },
  }
}

describe('loadBodyMirrorForUser', () => {
  it('loads every evidence source for one user and maps database rows once', async () => {
    const supabase = fakeSupabase({
      body_check_ins: {
        data: [{
          id: 'check-in',
          context: 'daily',
          comfort: 1,
          focus_areas: ['lower_back'],
          safety_signals: ['sharp_pain'],
          recorded_at: '2026-06-29T07:00:00.000Z',
        }],
        error: null,
      },
    })

    const loaded = await loadBodyMirrorForUser(supabase, 'user-1', {
      now: new Date('2026-06-29T08:00:00.000Z'),
    })

    assert.equal(loaded.error, null)
    assert.equal(loaded.result?.status, 'safety_hold')
    assert.deepEqual(
      supabase.calls.map(call => call.table),
      ['body_check_ins', 'movement_assessments', 'movement_observations', 'session_records'],
    )
    assert.equal(supabase.calls.every(call => call.userId === 'user-1'), true)
  })

  it('does not disguise a query failure as an empty body mirror', async () => {
    const supabase = fakeSupabase({
      movement_observations: { data: null, error: { message: 'relation missing' } },
    })

    const loaded = await loadBodyMirrorForUser(supabase, 'user-1')

    assert.equal(loaded.result, null)
    assert.equal(loaded.error, 'Body Mirror data is temporarily unavailable.')
  })
})
