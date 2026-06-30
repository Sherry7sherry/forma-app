import { Activity, HeartPulse, ScanLine } from 'lucide-react'

import type { BodyMirrorDimensionKey, BodyMirrorResult, DimensionState } from '@/lib/bodyMirror'

const ICONS = {
  comfort: HeartPulse,
  mobility: Activity,
  control: ScanLine,
}

const STATE_LABELS: Record<DimensionState, string> = {
  no_data: 'No data',
  baseline: 'Baseline',
  improved: 'Improving',
  steady: 'Steady',
  declined: 'Needs care',
}

const STATE_STYLES: Record<DimensionState, string> = {
  no_data: 'bg-cream-dark text-muted',
  baseline: 'bg-sage/15 text-sage-dark',
  improved: 'bg-sage text-white',
  steady: 'bg-sage/15 text-sage-dark',
  declined: 'bg-rose/15 text-rose-dark',
}

const COMPACT_STATE_STYLES: Record<DimensionState, string> = {
  no_data: 'bg-cream-dark text-muted',
  baseline: 'bg-white/10 text-[#DCE8E1]',
  improved: 'bg-cream text-sage-dark',
  steady: 'bg-white/10 text-[#DCE8E1]',
  declined: 'bg-[#F4D8D1] text-rose-dark',
}

export default function BodyMirrorDimensions({ result, compact = false }: {
  result: BodyMirrorResult
  compact?: boolean
}) {
  const keys: BodyMirrorDimensionKey[] = ['comfort', 'mobility', 'control']
  return (
    <div className={compact ? 'divide-y divide-white/15' : 'grid gap-3'}>
      {keys.map(key => {
        const dimension = result.dimensions[key]
        const Icon = ICONS[key]
        const stateStyle = compact ? COMPACT_STATE_STYLES[dimension.state] : STATE_STYLES[dimension.state]
        return (
          <div key={key} className={compact
            ? 'flex items-center gap-3 py-3 first:pt-0 last:pb-0'
            : 'card flex items-start gap-4'}>
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl
              ${compact ? 'bg-white/10 text-cream' : 'bg-sage/10 text-sage-dark'}`}>
              <Icon size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className={`text-sm font-semibold ${compact ? 'text-cream' : 'text-charcoal'}`}>{dimension.label}</h3>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${stateStyle}`}>
                  {STATE_LABELS[dimension.state]}
                </span>
              </div>
              <p className={`mt-1 text-xs leading-relaxed ${compact ? 'text-[#DCE8E1]' : 'text-muted'}`}>
                {dimension.summary}
              </p>
              {!compact && <p className="mt-1.5 text-xs leading-relaxed text-charcoal-mid">{dimension.detail}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
