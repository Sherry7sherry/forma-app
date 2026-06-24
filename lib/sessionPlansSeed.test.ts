import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const replacementSeedPath = 'supabase/migrations/006_replace_exercise_library.sql'

const NEW_EXERCISE_NAMES = [
  'Chest Lift',
  'Glute Bridge',
  'Dead Bug',
  'Femur Arcs',
  'Bent Knee Opening',
  'Supine Knee Sways',
  'Arm Arcs',
  'Assisted Roll Up',
  'Roll Up',
  'Side Kick',
  'Prone Press Up',
  'Book Opening',
  'Spine Stretch Forward',
  'Hundred Prep',
  'Mermaid Stretch',
  'Quadruped Rock Back',
  'Leg Pull Front Prep',
  'Standing Roll Down',
  'Swan',
  'Spine Twist',
  'Single Leg Kick',
  'Saw',
  'Leg Pull Back',
  'Side Lift',
  'Single Leg Stretch',
  'Criss Cross',
  'Single Leg Circle',
  'Double Leg Kick',
  'Double Leg Stretch',
  'Pilates Push Up',
] as const

const PLAN_NAMES = [
  'Spinal Mobility & Deep Core',
  'Shoulder & Neck Release',
  'Core Activation',
  'Evening Wind-Down',
  'Hip Flexor & Lower Back Flow',
  'Full Body Pilates - Moderate',
  'Postnatal Foundation',
] as const

function readReplacementSeed() {
  return readFileSync(replacementSeedPath, 'utf8')
}

function sqlStringPattern(value: string) {
  return new RegExp(`'${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll("'", "''")}'`)
}

describe('session plan seed names', () => {
  it('uses a non-series name for the postnatal foundation plan', () => {
    const fullSetup = readFileSync('supabase/migrations/000_full_setup.sql', 'utf8')
    const exerciseSeed = readFileSync('supabase/migrations/002_seed_exercises.sql', 'utf8')
    const replacementSeed = readReplacementSeed()

    assert.match(fullSetup, /Postnatal Foundation/)
    assert.match(exerciseSeed, /Postnatal Foundation/)
    assert.match(replacementSeed, /Postnatal Foundation/)
    assert.doesNotMatch(fullSetup, /Postnatal Recovery [—-] Week 1/)
    assert.doesNotMatch(exerciseSeed, /Postnatal Recovery [—-] Week 1/)
    assert.doesNotMatch(replacementSeed, /Postnatal Recovery [—-] Week 1/)
  })

  it('seeds every normalized replacement exercise name', () => {
    const replacementSeed = readReplacementSeed()

    for (const exerciseName of NEW_EXERCISE_NAMES) {
      assert.match(replacementSeed, sqlStringPattern(exerciseName), `${exerciseName} missing from replacement migration`)
    }
  })

  it('rebuilds all existing session plans from replacement exercises only', () => {
    const replacementSeed = readReplacementSeed()

    for (const planName of PLAN_NAMES) {
      assert.match(replacementSeed, sqlStringPattern(planName), `${planName} missing from replacement migration`)
    }

    assert.doesNotMatch(replacementSeed, /Cat-Cow Stretch|Pelvic Tilts|Child''s Pose Hold|Plank Hold|Teaser Prep/)
  })
})
