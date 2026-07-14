'use client'

import { useEffect, useState } from 'react'

import { INTERNAL_ISSUE_TYPES, type InternalIssueType } from '@/lib/internalTesting/persistence'

const DEFAULT_ISSUE_TYPE: InternalIssueType = 'unable-to-continue'

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
        {INTERNAL_ISSUE_TYPES.map(issueType => (
          <option key={issueType}>{issueType}</option>
        ))}
      </select>
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
