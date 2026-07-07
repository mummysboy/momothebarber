@AGENTS.md

# Momo The Barber — momothebarber.com

Site + custom booking engine for Momo (Mohammad M.), the barber inside Cable Car
Clothiers, 110 Sutter St Suite 108, San Francisco. Replaces his Booksy listing.
Live at https://www.momothebarber.com (Vercel project `momothebarber`, team
`mummysboys-projects`; GitHub `mummysboy/momothebarber`).

## Stack

- Next.js 16 App Router + Tailwind v4 (see AGENTS.md — read bundled docs first)
- Supabase Postgres + Auth. **Server-only DB access via service-role key** — no
  anon/RLS client access. Prod project: `cilwnkmynjiywjbidzfb` (us-west-1).
- Twilio SMS via Messaging Service with **scheduled messages** (`sendAt`,
  ≥16-min lead) for the 2h-before client reminder and the 45-min-before
  "hasn't confirmed" owner alert — no cron anywhere.
- Deploys: Vercel. Domain momothebarber.com + www.

## Commands

Node ≥22 required (nvm default is 20 and breaks supabase-js). Prefix every
npm/node/vercel command with:

```sh
export PATH="/opt/homebrew/opt/node@23/bin:$PATH"
```

- `npm run dev` — dev server (uses `.env.local`, points at local Supabase)
- `npm run build` / `npm run lint`
- `supabase start` — local stack, API port **55421**, Postgres **55422**
  (`psql postgresql://postgres:postgres@127.0.0.1:55422/postgres`)
- One-off TS scripts: use **`.mts`** extension with tsx (top-level await fails
  in `.ts`/CJS mode)
- Prod DB changes: MCP supabase tools (`apply_migration`, `execute_sql`)
  against project `cilwnkmynjiywjbidzfb`; also add the file under
  `supabase/migrations/` and apply locally via psql.

## Architecture

- `lib/availability.ts` — slot generation in shop TZ (America/Los_Angeles);
  15-min granularity, lead time + max-advance from `settings` row.
- `lib/booking.ts` — create/cancel/reschedule server logic + all SMS
  composition. Key exports: `createBooking`, `cancelBooking`,
  `rescheduleBooking`, `confirmFromSms`, `relayInboundToOwner`,
  `notifyOwner`. Constants: reminder −120 min, owner alert −45 min.
- `lib/sms.ts` — single SMS gateway. **Outbox mode:** when Twilio env vars are
  unset, messages are written to the `sms_outbox` table instead of sent —
  local dev tests the full flow without Twilio.
- `app/api/sms/route.ts` — Twilio inbound webhook. Validates
  `X-Twilio-Signature` (skipped when `TWILIO_AUTH_TOKEN` unset). Body matching
  `/^y(es)?[.!]*$/i` → confirm booking; anything else → relay text to owner.
- `app/book/` — public 3-step booking flow. `app/b/[token]/` — self-serve
  cancel/reschedule (link sent in confirmation SMS). `app/admin/` — dashboard
  (agenda, schedule/blocks, services), Supabase Auth email/password.
- Double-booking is impossible at the DB level: btree_gist exclusion
  constraint on confirmed bookings.

## SMS / notification flow

1. Booking → client confirmation ("Reply Y to confirm" + manage link) +
   owner new-booking text (web bookings only, not admin-created).
2. Two scheduled messages: client reminder at −2h, owner alert at −45min if
   client hasn't replied Y. SIDs stored on the booking
   (`reminder_sid`, `owner_alert_sid`) so cancel/reschedule can revoke them.
3. Client replies Y → `customer_confirmed_at` set, owner alert cancelled,
   owner gets "Confirmed:" text. Non-Y replies are forwarded to the owner.
4. Owner phone comes from `settings.owner_phone`.

## Twilio production state (2026-07-06)

- Messaging Service `MGbe6c3678f8b02e9341bec0d320601514`, sender
  +1 (320) 399-3601, inbound webhook → momothebarber.com/api/sms.
- A2P 10DLC: brand approved; campaign `QE2c6890da8086d771620e9b13fadeba0b`
  **IN_PROGRESS** — all outbound texts fail with error 30034 until it's
  VERIFIED. That error is the carrier block, not a code bug. Status check:
  `GET messaging.twilio.com/v1/Services/<MG…>/Compliance/Usa2p/<QE…>`.
- `settings.owner_phone` in prod = Isaac's number **temporarily** for testing;
  switch to Momo's +14153610025 when going live. Also planned: swap sender to
  a 415 number.
- Caveat: Twilio's mandatory opt-out list includes CANCEL — a client texting
  "cancel" gets unsubscribed instead of reaching Momo. The manage link is the
  official cancel path.

## Gotchas

- JSX collapses whitespace at line breaks around inline elements — use
  explicit `{" "}` (a missing space after `<strong>Y</strong>` shipped once).
- `app/opengraph-image.tsx` (Satori): no mix-blend-multiply, no woff2; fonts
  fetched as TTF from Google Fonts CSS via plain (non-browser-UA) fetch.
- Never commit secrets. Twilio + Supabase prod keys live in Vercel env vars.
