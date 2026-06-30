import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const migrationPath = 'supabase/migrations/007_body_mirror_phase_one.sql'

function readMigration() {
  return readFileSync(migrationPath, 'utf8')
}

describe('body mirror migration', () => {
  it('creates all three evidence tables with constrained evidence fields', () => {
    const sql = readMigration()

    for (const table of ['body_check_ins', 'movement_assessments', 'movement_observations']) {
      assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, 'i'))
    }

    assert.match(sql, /comfort\s+smallint not null check \(comfort between 1 and 5\)/i)
    assert.match(sql, /overall_confidence\s+numeric\(4,3\).*between 0 and 1/i)
    assert.match(sql, /confidence\s+numeric\(4,3\).*between 0 and 1/i)
    assert.match(sql, /foreign key \(assessment_id, user_id\).*movement_assessments \(id, user_id\)/is)
  })

  it('enables RLS and scopes every evidence table to auth.uid()', () => {
    const sql = readMigration()

    for (const table of ['body_check_ins', 'movement_assessments', 'movement_observations']) {
      assert.match(sql, new RegExp(`alter table public\\.${table}\\s+enable row level security`, 'i'))
      assert.match(
        sql,
        new RegExp(`on public\\.${table} for all[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i'),
      )
    }
  })

  it('retains low-confidence evidence and limits safety signals to the stop list', () => {
    const sql = readMigration()

    assert.doesNotMatch(sql, /confidence[^;]+check\s*\([^)]*>=\s*0\.7/is)
    for (const signal of ['sharp_pain', 'numbness', 'radiating_pain', 'dizziness']) {
      assert.match(sql, new RegExp(`'${signal}'`))
    }
  })

  it('preserves evidence ownership when an optional linked record is deleted', () => {
    const sql = readMigration()

    assert.match(sql, /on delete set null \(session_record_id\)/i)
    assert.match(sql, /on delete set null \(body_check_in_id\)/i)
    assert.doesNotMatch(
      sql,
      /foreign key \([^)]*, user_id\)[\s\S]*?on delete set null\s*[,;]/i,
      'Composite ownership keys must never null the non-null user_id column.',
    )
  })

  it('seeds the idempotent no-mat quick session from existing exercises', () => {
    const sql = readMigration()

    assert.match(sql, /'Desk Reset'/)
    assert.match(sql, /duration_minutes[\s\S]*?4/i)
    assert.match(sql, /'Standing Roll Down'/)
    assert.match(sql, /'Arm Arcs'/)
    assert.match(sql, /'Spine Twist'/)
    assert.match(sql, /on conflict \(name\) do update/i)
  })

  it('keeps the fresh-install schema aligned with the evidence tables', () => {
    const fullSetup = readFileSync('supabase/migrations/000_full_setup.sql', 'utf8')

    assert.match(fullSetup, /create table if not exists public\.body_check_ins/i)
    assert.match(fullSetup, /create table if not exists public\.movement_assessments/i)
    assert.match(fullSetup, /create table if not exists public\.movement_observations/i)
  })
})
