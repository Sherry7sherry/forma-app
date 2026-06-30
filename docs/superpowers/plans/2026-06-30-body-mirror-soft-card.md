# Body Mirror Deep Sage Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the black Home Today’s Body card with the selected ink-rich sage treatment while preserving its hierarchy, states, and behavior.

**Architecture:** Keep the change presentation-only. Update the Home card container and its dark sage text/status treatments in `app/(app)/home/page.tsx`, then update only the existing `compact` branch of `BodyMirrorDimensions` so the Progress rendering remains unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Node test runner.

## Global Constraints

- Use a visibly green vertical gradient from `#3F5F54` to `#527368`.
- Preserve Lora/Inter typography, rounded shape, information order, icons, copy, and status semantics.
- Retain rose styling for safety and declined states.
- Do not change Progress, the check-in sheet, domain behavior, data handling, or spacing.
- Preserve the mobile-first layout, semantic structure, and accessible contrast.

---

### Task 1: Restyle the Today’s Body card

**Files:**
- Modify: `lib/bodyMirror/bodyMirrorPages.test.ts`
- Modify: `app/(app)/home/page.tsx:65-103`
- Modify: `components/body-mirror/BodyMirrorDimensions.tsx:29-56`

**Interfaces:**
- Consumes: `BodyMirrorDimensions({ result, compact: true })` and the existing `BodyMirrorResult` state model.
- Produces: the same component API and DOM semantics with dark sage compact-mode color classes.

- [ ] **Step 1: Write the failing visual-contract test**

Add a source helper and test that lock the approved treatment without coupling to layout details:

```ts
const dimensions = () => readFileSync('components/body-mirror/BodyMirrorDimensions.tsx', 'utf8')

it('uses the approved ink-sage treatment for the compact Home mirror', () => {
  const homeSource = home()
  const dimensionSource = dimensions()

  assert.match(homeSource, /from-\[#3F5F54\].*to-\[#527368\]/s)
  assert.doesNotMatch(homeSource, /rounded-4xl bg-charcoal/)
  assert.doesNotMatch(homeSource, /from-\[#EDF3EF\]/)
  assert.match(homeSource, /text-\[#DCE8E1\]/)
  assert.match(dimensionSource, /divide-white\/15/)
  assert.match(dimensionSource, /bg-white\/10 text-cream/)
  assert.match(dimensionSource, /COMPACT_STATE_STYLES/)
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsc --project tsconfig.test.json
node --test --test-name-pattern="approved ink-sage treatment" .test-build/bodyMirror/bodyMirrorPages.test.js
```

Expected: FAIL because the current branch still uses the pale mist-sage gradient.

- [ ] **Step 3: Apply the minimal Home card color changes**

Change the card shell and its compact copy treatments to:

```tsx
<div className="relative overflow-hidden rounded-4xl border border-white/10 bg-gradient-to-b from-[#3F5F54] to-[#527368] px-5 py-5 shadow-[0_14px_36px_rgba(63,95,84,.22)]">
```

Use `text-[#DCE8E1]` for the eyebrow, supporting copy, and freshness; `text-cream` for the title and loaded/error headings; `border-white/15` for dividers; and `bg-white/10 text-cream` for the default top-right status chip. Leave the `bg-rose text-white` safety chip unchanged.

- [ ] **Step 4: Apply compact-mode dimension colors**

Keep the non-compact branch byte-for-byte equivalent while changing compact mode to:

```tsx
<div className={compact ? 'divide-y divide-white/15' : 'grid gap-3'}>
```

```tsx
${compact ? 'bg-white/10 text-cream' : 'bg-sage/10 text-sage-dark'}
```

```tsx
<h3 className={`text-sm font-semibold ${compact ? 'text-cream' : 'text-charcoal'}`}>
```

```tsx
<p className={`mt-1 text-xs leading-relaxed ${compact ? 'text-[#DCE8E1]' : 'text-muted'}`}>
```

Add compact-only state-chip styles so baseline, steady, improved, declined, and no-data states remain legible without changing Progress.

- [ ] **Step 5: Run the focused and full verification suites**

Run:

```bash
npm test
npm run lint
npx tsc --noEmit --incremental false
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy SUPABASE_SERVICE_ROLE_KEY=dummy STRIPE_SECRET_KEY=sk_test_dummy STRIPE_PRO_MONTHLY_PRICE_ID=price_dummy STRIPE_PRO_YEARLY_PRICE_ID=price_dummy STRIPE_WEBHOOK_SECRET=whsec_dummy NEXT_PUBLIC_APP_URL=http://localhost:3000 npm run build
```

Expected: all tests pass, lint and typecheck exit 0, and all Next.js routes build successfully.

- [ ] **Step 6: Inspect Home at mobile width**

Open the deployed Preview `/home` in the authenticated Chrome session and confirm the no-data state matches the selected mock: visibly green dark sage surface, cream copy, quiet light dividers, and legible state chips.

- [ ] **Step 7: Commit the implementation**

```bash
git add 'app/(app)/home/page.tsx' components/body-mirror/BodyMirrorDimensions.tsx lib/bodyMirror/bodyMirrorPages.test.ts
git commit -m "style: soften body mirror card"
```
