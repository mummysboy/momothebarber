-- Momo The Barber — booking engine schema
create extension if not exists btree_gist;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  duration_min integer not null check (duration_min > 0),
  active boolean not null default true,
  sort_order integer not null default 0
);

create type public.booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');
create type public.booking_source as enum ('web', 'admin');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  customer_name text not null,
  customer_phone text not null,
  status public.booking_status not null default 'confirmed',
  source public.booking_source not null default 'web',
  manage_token uuid not null unique default gen_random_uuid(),
  reminder_sid text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  -- Two confirmed bookings can never overlap, regardless of app-level races.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);

create index bookings_starts_at_idx on public.bookings (starts_at);

create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6), -- 0 = Sunday
  is_open boolean not null default false,
  open_time time not null default '10:30',
  close_time time not null default '17:00',
  check (close_time > open_time)
);

create table public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table public.settings (
  id boolean primary key default true check (id), -- single row
  slot_granularity_min integer not null default 15,
  min_lead_time_min integer not null default 60,
  max_advance_days integer not null default 30,
  shop_name text not null default 'Momo The Barber',
  shop_address text not null default '110 Sutter St, Suite 108, San Francisco, CA 94104',
  shop_phone text not null default '(415) 361-0025',
  timezone text not null default 'America/Los_Angeles'
);

-- When Twilio env vars are absent, SMS payloads land here instead of being sent.
create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  send_at timestamptz, -- null = immediate
  kind text not null, -- confirmation | reminder | cancellation
  booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now()
);

-- Server-only access: RLS on with no policies means anon/authenticated see
-- nothing via the Data API; the service role bypasses RLS.
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_times enable row level security;
alter table public.settings enable row level security;
alter table public.sms_outbox enable row level security;

-- Seed: services (Booksy pricing)
insert into public.services (name, description, price_cents, duration_min, sort_order) values
  ('Male Haircut', 'Classic scissor and clipper cut, finished with a hot towel.', 6000, 40, 1),
  ('Hot Shave', 'Traditional hot lather, straight razor shave with hot toweling.', 3000, 20, 2),
  ('Haircut & Beard Shape Up', 'Full haircut with a precise beard shape up.', 7500, 60, 3),
  ('Beard Trim', 'Beard trimmed, shaped, and lined up.', 2500, 15, 4);

-- Seed: hours (Mon–Fri 10:30–5, weekends closed until Momo opens them)
insert into public.business_hours (weekday, is_open, open_time, close_time) values
  (0, false, '10:30', '17:00'),
  (1, true,  '10:30', '17:00'),
  (2, true,  '10:30', '17:00'),
  (3, true,  '10:30', '17:00'),
  (4, true,  '10:30', '17:00'),
  (5, true,  '10:30', '17:00'),
  (6, false, '10:30', '17:00');

insert into public.settings default values;
