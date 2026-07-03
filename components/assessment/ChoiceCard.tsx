import { Check } from 'lucide-react'

export function ChoiceCard({
  title,
  detail,
  selected,
  onClick,
}: {
  title: string
  detail?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 ${selected
        ? 'border-sage bg-sage/10 shadow-card'
        : 'border-border bg-white hover:border-sage/50'}`}
    >
      <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border ${selected
        ? 'border-sage bg-sage text-white'
        : 'border-border bg-cream text-transparent'}`}>
        <Check size={14} strokeWidth={3} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-charcoal">{title}</span>
        {detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted">{detail}</span>}
      </span>
    </button>
  )
}
