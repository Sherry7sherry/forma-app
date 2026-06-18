import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { markStripeEventProcessing } from './stripeWebhook'

function createSupabaseStub(existingEvent: boolean) {
  const calls: string[] = []
  return {
    calls,
    from(table: string) {
      calls.push(`from:${table}`)
      return {
        select() {
          calls.push('select')
          return {
            eq() {
              calls.push('eq')
              return {
                maybeSingle: async () => ({
                  data: existingEvent ? { id: 'evt_1' } : null,
                  error: null,
                }),
              }
            },
          }
        },
        insert() {
          calls.push('insert')
          return {
            select() {
              calls.push('insert_select')
              return {
                single: async () => ({ data: { id: 'evt_1' }, error: null }),
              }
            },
          }
        },
      }
    },
  }
}

describe('markStripeEventProcessing', () => {
  it('skips an already processed Stripe event', async () => {
    const supabase = createSupabaseStub(true)

    const result = await markStripeEventProcessing(supabase, 'evt_1', 'customer.subscription.updated')

    assert.deepEqual(result, { shouldProcess: false })
    assert.equal(supabase.calls.includes('insert'), false)
  })

  it('records a new Stripe event before processing', async () => {
    const supabase = createSupabaseStub(false)

    const result = await markStripeEventProcessing(supabase, 'evt_2', 'checkout.session.completed')

    assert.deepEqual(result, { shouldProcess: true })
    assert.equal(supabase.calls.includes('insert'), true)
  })
})
