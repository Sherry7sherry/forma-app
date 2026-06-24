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

function extractValuesBlock(sql: string, cteName: string, nextStatement: string) {
  const blockPattern = new RegExp(
    `${cteName}\\([^)]*\\)\\s+as\\s*\\(\\s*values(?<block>[\\s\\S]*?)\\n\\)\\s*${nextStatement}`,
    'i',
  )
  const match = blockPattern.exec(sql)

  assert.ok(match?.groups?.block, `Could not find ${cteName} values block`)

  return match.groups.block
}

function parseReplacementExerciseNames(block: string) {
  return Array.from(block.matchAll(/\(\s*'((?:''|[^'])+)'/g), (match) => match[1].replaceAll("''", "'"))
}

function parsePlanExerciseRows(block: string) {
  return Array.from(
    block.matchAll(/\(\s*'((?:''|[^'])+)'\s*,\s*'((?:''|[^'])+)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g),
    ([, planName, exerciseName, orderIndex, repsOverride, restAfterSeconds]) => ({
      planName: planName.replaceAll("''", "'"),
      exerciseName: exerciseName.replaceAll("''", "'"),
      orderIndex: Number(orderIndex),
      repsOverride: Number(repsOverride),
      restAfterSeconds: Number(restAfterSeconds),
    }),
  )
}

describe('session plan seed names', () => {
  it('preserves the legacy full body plan name in older seeds and normalizes it in the replacement migration', () => {
    const fullSetup = readFileSync('supabase/migrations/000_full_setup.sql', 'utf8')
    const exerciseSeed = readFileSync('supabase/migrations/002_seed_exercises.sql', 'utf8')
    const replacementSeed = readReplacementSeed()

    assert.match(fullSetup, /Full Body Pilates — Moderate/)
    assert.match(exerciseSeed, /Full Body Pilates — Moderate/)
    assert.match(
      replacementSeed,
      /update public\.session_plans\s+set name = 'Full Body Pilates - Moderate'\s+where name = 'Full Body Pilates — Moderate'/,
    )
  })

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

  it('seeds exactly the 30 normalized replacement exercise names inside replacement_exercises values', () => {
    const replacementSeed = readReplacementSeed()
    const replacementExercisesBlock = extractValuesBlock(
      replacementSeed,
      'with replacement_exercises',
      'insert into public\\.exercises',
    )
    const replacementExerciseNames = parseReplacementExerciseNames(replacementExercisesBlock)
    const uniqueReplacementExerciseNames = new Set(replacementExerciseNames)

    assert.equal(replacementExerciseNames.length, NEW_EXERCISE_NAMES.length)
    assert.equal(uniqueReplacementExerciseNames.size, NEW_EXERCISE_NAMES.length)

    for (const exerciseName of NEW_EXERCISE_NAMES) {
      assert.match(
        replacementExercisesBlock,
        sqlStringPattern(exerciseName),
        `${exerciseName} missing from replacement_exercises values`,
      )
    }
  })

  it('rebuilds exactly seven session plans from replacement exercises inside plan_exercises values', () => {
    const replacementSeed = readReplacementSeed()
    const planExercisesBlock = extractValuesBlock(
      replacementSeed,
      'with plan_exercises',
      'insert into public\\.session_plan_exercises',
    )
    const planExerciseRows = parsePlanExerciseRows(planExercisesBlock)
    const uniquePlanNames = new Set(planExerciseRows.map((row) => row.planName))
    const replacementExerciseNames = new Set<string>(NEW_EXERCISE_NAMES)
    const expectedPlanRowCounts = new Map<string, number>([
      ['Spinal Mobility & Deep Core', 7],
      ['Shoulder & Neck Release', 6],
      ['Core Activation', 6],
      ['Evening Wind-Down', 6],
      ['Hip Flexor & Lower Back Flow', 6],
      ['Full Body Pilates - Moderate', 9],
      ['Postnatal Foundation', 6],
    ])

    assert.equal(uniquePlanNames.size, PLAN_NAMES.length)

    for (const planName of PLAN_NAMES) {
      assert.match(planExercisesBlock, sqlStringPattern(planName), `${planName} missing from plan_exercises values`)
    }

    for (const row of planExerciseRows) {
      assert.ok(replacementExerciseNames.has(row.exerciseName), `${row.exerciseName} is not part of replacement_exercises`)
    }

    for (const [planName, expectedCount] of expectedPlanRowCounts) {
      const planRows = planExerciseRows.filter((row) => row.planName === planName)

      assert.equal(planRows.length, expectedCount, `${planName} should have ${expectedCount} queued exercises`)
      assert.deepEqual(
        planRows.map((row) => row.orderIndex).sort((left, right) => left - right),
        Array.from({ length: expectedCount }, (_, index) => index),
        `${planName} should have a complete zero-based queue`,
      )
    }

    assert.doesNotMatch(planExercisesBlock, /Cat-Cow Stretch|Pelvic Tilts|Child''s Pose Hold|Plank Hold|Teaser Prep/)
  })

  it('does not delete non-replacement exercise rows from public.exercises', () => {
    const replacementSeed = readReplacementSeed()

    assert.doesNotMatch(replacementSeed, /delete\s+from\s+public\.exercises/i)
  })
})
