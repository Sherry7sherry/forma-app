import type { Metadata } from 'next'

import GuestAssessmentFlow from './GuestAssessmentFlow'

export const metadata: Metadata = {
  title: 'Free body assessment — Forma',
  description: 'Learn what kind of movement fits your body today in about four minutes.',
}

export default function BodyAssessmentPage() {
  return <GuestAssessmentFlow />
}
