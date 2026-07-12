# Forma — AI Pilates Coach

> Your AI coach for recovery, alignment, and everyday strength.

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Database & Auth | Supabase (PostgreSQL + Auth + RLS) |
| AI Camera | MediaPipe Pose (runs in browser — no server cost) |
| Payments | Stripe Subscriptions |
| Hosting | Vercel |

---

## Setup Guide (step by step)

### 1. Install dependencies

```bash
cd forma-app
npm install
```

---

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor** → **New query**
2. **Run [`supabase/migrations/000_full_setup.sql`](supabase/migrations/000_full_setup.sql).** This single
   file is the **source of truth** for the database — it creates every table, RLS
   policy, trigger, and seed data (31 exercises, 7 session plans, and the
   plan→exercise links). It is fully idempotent: safe to run on a brand-new
   project **or** an existing one, and safe to re-run any time (it never errors
   or duplicates rows).
   - The older numbered migrations (`001`–`005`) are kept only for history.
     You do **not** need to run them — `000_full_setup.sql` contains everything.
3. In your project → **Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Service role key → `SUPABASE_SERVICE_ROLE_KEY`
4. Enable Google Auth (optional): **Authentication → Providers → Google**
   - Add your Google OAuth Client ID + Secret
   - Add `https://your-project.supabase.co/auth/v1/callback` to Google Console redirect URIs

> **Keeping the DB and code in sync.** Every schema change the app relies on must
> land as SQL in `supabase/migrations/`. If you add a column in code but not in a
> migration, you'll hit `Could not find the 'x' column ... in the schema cache`.
> When in doubt, re-run `000_full_setup.sql` — it reconciles the database to the
> schema the code expects.

### Bilingual AI Coach migration

The bilingual coach release also requires:

```sql
supabase/migrations/010_bilingual_ai_coach_v1.sql
```

Run it through the same Supabase SQL/migration workflow before using language
preferences or coach recaps in a shared environment. It adds the constrained
`user_profiles.preferred_locale` field and session recap provenance fields.

---

### 3. Set up Stripe

1. Go to [stripe.com](https://stripe.com) → **Products** → Create two products:
   - **Forma Pro Monthly** → $14.99/month recurring → copy the Price ID
   - **Forma Pro Yearly** → $99/year recurring → copy the Price ID
2. **Developers → API keys** → copy Secret key + Publishable key
3. **Developers → Webhooks** → Add endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
     (`checkout.session.completed` is what grants Pro on the very first upgrade — don't omit it)
   - Copy the Webhook Secret

---

### 4. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`.

For bilingual post-session coach recaps, also set the server-only values below
in local and production environments. Do **not** prefix them with
`NEXT_PUBLIC_`; they must never be exposed to the browser bundle.

```bash
OPENAI_API_KEY=
OPENAI_COACH_MODEL=
INTERNAL_TESTER_EMAILS=tester-one@example.com,tester-two@example.com
```

`INTERNAL_TESTER_EMAILS` is server-only and controls access to `/internal/*` and
internal-test APIs. URL parameters never grant internal access.

Restart the local dev server or redeploy after changing server environment
values.

V1 live voice cues still use browser SpeechSynthesis, with tone/haptic fallback
when speech or a locale-matched voice is unavailable. Cloud/premium TTS is not
enabled in this release.

---

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

For local Stripe webhook testing:
```bash
# Install Stripe CLI, then:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

### 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to Vercel at [vercel.com/new](https://vercel.com/new) — it auto-deploys on every push.

Add all environment variables in **Vercel → Project → Settings → Environment Variables**.

Update `NEXT_PUBLIC_APP_URL` to your production domain.

---

## Project Structure

```
forma-app/
├── app/
│   ├── page.tsx                    # Splash / landing
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login
│   │   └── signup/page.tsx         # Signup
│   ├── onboarding/page.tsx         # 3-step onboarding
│   ├── (app)/                      # Protected app shell
│   │   ├── layout.tsx              # Bottom nav wrapper
│   │   ├── home/page.tsx           # Home dashboard
│   │   ├── sessions/               # Session library
│   │   ├── session/[id]/           # Session player + AI camera
│   │   ├── progress/page.tsx       # Progress & milestones
│   │   └── profile/page.tsx        # Profile + upgrade
│   ├── auth/
│   │   ├── callback/route.ts       # OAuth callback
│   │   └── signout/route.ts        # Sign out
│   └── api/stripe/
│       ├── checkout/route.ts       # Create Stripe checkout session
│       └── webhook/route.ts        # Handle Stripe events
├── components/
│   ├── camera/PoseCamera.tsx       # MediaPipe AI camera component
│   └── nav/BottomNav.tsx           # Bottom navigation
├── lib/
│   ├── supabase/client.ts          # Browser Supabase client
│   ├── supabase/server.ts          # Server Supabase client
│   ├── stripe.ts                   # Stripe client + plan config
│   └── utils.ts                    # Helper functions
├── types/index.ts                  # TypeScript types
├── middleware.ts                   # Auth protection + redirect logic
└── supabase/migrations/
    ├── 000_full_setup.sql          # ⭐ SOURCE OF TRUTH — run this one (idempotent)
    ├── 001_initial.sql             # (history) original schema + RLS + triggers
    ├── 002_seed_exercises.sql      # (history) 31 exercises + 7 session plans
    ├── 003_health_disclaimer.sql   # (history) disclaimer column
    ├── 004_voice_coaching.sql      # (history) voice-coaching column
    └── 005_fix_missing_columns.sql # (history) column backfill — folded into 000
```

---

## Freemium Model

| Feature | Free | Pro ($14.99/mo or $99/yr) |
|---|---|---|
| Sessions per week | 3 | Unlimited |
| AI camera form analysis | ❌ | ✅ |
| Real-time feedback | ❌ | ✅ |
| Progress tracking | Basic | Full |
| All session types | ❌ | ✅ |

---

## Adding Exercises

Add rows to the `exercises` table in Supabase, then create a `session_plan` and link exercises via `session_plan_exercises`. The `pose_definition` JSON field tells the AI camera what joint angles to look for.

## Adding Videos

Upload MP4 files to Supabase Storage (bucket: `exercise-videos`), then update the `video_url` column for each exercise.
