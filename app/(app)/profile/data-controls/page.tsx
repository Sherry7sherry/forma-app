import Link from 'next/link'

export default async function DataControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return (
    <div className="fade-up px-5 pb-10 pt-14 text-charcoal">
      <Link href="/profile" className="text-sm font-semibold text-sage-dark">← Back to profile</Link>
      <h1 className="mt-6 font-serif text-3xl">Your Forma data</h1>
      <p className="mt-3 text-sm leading-relaxed text-charcoal-mid">Export a copy at any time. Account deletion removes your saved Forma data and cannot be undone.</p>

      <section className="mt-6 rounded-3xl border border-border bg-white p-5 shadow-card">
        <h2 className="font-serif text-xl">Export my data</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">The download includes your profile, body evidence, reports, and session history. Raw video is not stored and is not part of the export.</p>
        <Link href="/api/account/export" prefetch={false} className="btn-secondary mt-5 w-full">Download JSON export</Link>
      </section>

      <section id="delete" className="mt-5 rounded-3xl border border-rose/30 bg-rose/5 p-5">
        <h2 className="font-serif text-xl">Delete account and data</h2>
        <p className="mt-2 text-xs leading-relaxed text-charcoal-mid">If you have an active subscription, cancel it from Profile first. To confirm permanent deletion, type DELETE below.</p>
        {error === 'billing_active' && <p role="alert" className="mt-3 text-sm font-medium text-rose-dark">Manage and cancel your active subscription before deleting the account.</p>}
        {error === 'delete_failed' && <p role="alert" className="mt-3 text-sm font-medium text-rose-dark">Deletion could not be completed. Nothing was removed; please try again.</p>}
        <form action="/api/account/delete" method="post" className="mt-5 grid gap-3">
          <label htmlFor="delete-confirmation" className="text-xs font-semibold text-charcoal">Type DELETE to confirm</label>
          <input id="delete-confirmation" name="confirmation" required pattern="DELETE" autoComplete="off"
            className="min-h-12 rounded-2xl border border-border bg-white px-4 text-sm outline-none focus:border-rose focus:ring-2 focus:ring-rose/20" />
          <button type="submit" className="min-h-12 rounded-full bg-rose-dark px-5 text-sm font-semibold text-white">Permanently delete my account</button>
        </form>
      </section>
    </div>
  )
}
