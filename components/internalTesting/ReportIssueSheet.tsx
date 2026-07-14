'use client'

import { useEffect, useState } from 'react'

import { INTERNAL_ISSUE_OPTIONS, type InternalIssueType } from '@/lib/internalTesting/persistence'

const DEFAULT_ISSUE_TYPE: InternalIssueType = 'camera-issue'

interface InternalIssuePayload {
  type: InternalIssueType
  note: string
}

export function ReportIssueSheet({
  onSubmit,
  resetKey,
}: {
  onSubmit(issue: InternalIssuePayload): Promise<void> | void
  resetKey: string
}) {
  const [type, setType] = useState<InternalIssueType>(DEFAULT_ISSUE_TYPE)
  const [note, setNote] = useState('')
  const selectedIssue = INTERNAL_ISSUE_OPTIONS.find(option => option.type === type)

  function resetForm() {
    setType(DEFAULT_ISSUE_TYPE)
    setNote('')
  }

  useEffect(() => {
    resetForm()
  }, [resetKey])

  async function submitIssue() {
    await onSubmit({ type, note })
    resetForm()
  }

  return (
    <div className="grid gap-2">
      <select
        value={type}
        onChange={event => setType(event.target.value as InternalIssueType)}
        className="rounded-xl p-2 text-charcoal"
      >
        {INTERNAL_ISSUE_OPTIONS.map(option => (
          <option key={option.type} value={option.type}>{option.label}</option>
        ))}
      </select>
      {selectedIssue?.description ? (
        <p className="text-xs text-white/60">{selectedIssue.description}</p>
      ) : null}
      <textarea
        aria-label="Optional note"
        value={note}
        onChange={event => setNote(event.target.value)}
        className="rounded-xl p-2 text-charcoal"
      />
      <button type="button" onClick={() => void submitIssue()} className="btn-secondary">
        Log issue
      </button>
    </div>
  )
}
