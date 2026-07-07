-- Reply-Y confirmations + owner (Momo) SMS notifications.
alter table public.bookings
  add column if not exists customer_confirmed_at timestamptz,
  -- SID of the scheduled "client hasn't confirmed" text to Momo, so it can be
  -- cancelled the moment the client replies Y (or the booking is cancelled).
  add column if not exists owner_alert_sid text;

-- Momo's mobile for booking/confirmation/no-reply alerts.
alter table public.settings
  add column if not exists owner_phone text not null default '+14153610025';
