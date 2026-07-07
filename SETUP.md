# momothebarber.com — Setup & Operations

One Next.js app serves the public site, booking flow, and Momo's dashboard.

## Local development

```bash
supabase start          # local Postgres + Auth (Docker)
npm run dev             # http://localhost:3000
```

`.env.local` points at the local Supabase stack. With no Twilio credentials set,
every SMS is written to the `sms_outbox` table instead of sent — check it with:

```bash
supabase db query 'select kind, to_phone, send_at, body from sms_outbox order by created_at desc'
```

## Production checklist

### 1. Supabase (database + admin login)
1. Create a project at supabase.com (or via the connected MCP).
2. Apply `supabase/migrations/0001_initial_schema.sql` to it.
3. Auth → Users → create Momo's user (email + strong password). Anyone with a
   user account can access the dashboard — only create accounts for Momo/Isaac.
4. Copy env vars (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   (server-only, never NEXT_PUBLIC), `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Free tier pauses after ~1 week without traffic. Once live, real traffic
   prevents this, but Pro ($25/mo) is the safe choice for a business.

### 2. Twilio (SMS confirmations + reminders)
1. Create account at twilio.com, buy a local US number (~$1.15/mo).
2. Messaging → Services → create a **Messaging Service**, add the number to its
   sender pool. Scheduled reminders require the Messaging Service SID (`MG…`).
3. Register **A2P 10DLC** (Messaging → Regulatory Compliance): sole-proprietor
   registration is fine for a barbershop. One-time, takes a few days; texts to
   US numbers won't deliver until approved.
4. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`.
   Until these are set the site works fully, logging SMS to `sms_outbox`.
5. **Inbound texts (reply-Y confirmations):** in the Messaging Service →
   Integration, set "Send a webhook" for incoming messages to
   `https://www.momothebarber.com/api/sms` (HTTP POST). The route validates
   Twilio's `X-Twilio-Signature`, so only real Twilio requests are accepted
   once `TWILIO_AUTH_TOKEN` is set.

How reminders work: when a booking is created we immediately send the
confirmation and schedule the reminder with Twilio (`sendAt` = 2 hours before
the appointment). No cron job. Cancelling/rescheduling cancels the scheduled
message via the stored SID. Bookings made less than ~2h15m ahead skip the
reminder (Twilio needs 15 min lead).

How owner notifications work: Momo's number lives in `settings.owner_phone`.
He gets a text on every web booking, reschedule, and client cancellation. Each
booking also schedules a "hasn't confirmed" alert to Momo at **45 minutes
before** the appointment; when the client texts back **Y**, the webhook marks
the booking confirmed, cancels that alert, and texts Momo the confirmation.
Any other inbound text is forwarded to Momo's phone.

### 3. Vercel (hosting + domain)
1. Push the repo to GitHub, import into Vercel.
2. Add all env vars from `.env.example`, with
   `NEXT_PUBLIC_SITE_URL=https://www.momothebarber.com` (used in SMS links).
3. Domains → add `momothebarber.com` + `www` and follow the DNS instructions
   at the registrar.

## Day-to-day (Momo)

- **momothebarber.com/admin** — sign in, see the day's appointments, mark
  Done / No-show, cancel (client gets a text), add walk-ins.
- **Hours & Blocks** — change weekly hours; block lunch or days off.
- **Services** — change names, prices, durations, or hide a service.

## Data model notes

- Double-bookings are impossible: Postgres exclusion constraint on confirmed
  bookings' time ranges.
- Clients manage bookings via `/b/<token>` — the token in their confirmation
  text is the only credential; no client accounts.
- All tables have RLS enabled with **no** policies: the anon key can read
  nothing; all reads/writes go through server code using the service role.
