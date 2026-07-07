import { formatInTimeZone } from "date-fns-tz";
import { supabaseAdmin } from "./db";
import { getAvailableSlots, getSettings } from "./availability";
import { cancelScheduledSms, normalizeUsPhone, sendSms } from "./sms";
import type { BookingWithService, Service, Settings } from "./types";

const REMINDER_LEAD_MIN = 120; // "2 hours before"
const OWNER_ALERT_LEAD_MIN = 45; // warn Momo if the client hasn't replied Y by then
const TWILIO_MIN_SCHEDULE_MIN = 16; // Twilio requires sendAt ≥ 15 min out

export type BookingResult =
  | { ok: true; manageToken: string }
  | { ok: false; error: string };

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function whenPhrase(startsAt: string | Date, settings: Settings) {
  return formatInTimeZone(startsAt, settings.timezone, "EEE, MMM d 'at' h:mm a");
}

/** Text Momo. Returns the Twilio SID when scheduled/sent, null in outbox mode. */
async function notifyOwner(
  settings: Settings,
  body: string,
  opts: { bookingId?: string; sendAt?: Date } = {},
): Promise<string | null> {
  if (!settings.owner_phone) return null;
  return sendSms({ to: settings.owner_phone, kind: "owner", body, ...opts });
}

async function sendBookingTexts(
  booking: {
    id: string;
    starts_at: string;
    customer_name: string;
    customer_phone: string;
    manage_token: string;
    serviceName: string;
  },
  opts: { isAdmin: boolean; ownerLabel: string },
): Promise<void> {
  const settings = await getSettings();
  const when = whenPhrase(booking.starts_at, settings);
  const startTime = formatInTimeZone(booking.starts_at, settings.timezone, "h:mm a");
  const manageUrl = `${siteUrl()}/b/${booking.manage_token}`;

  await sendSms({
    to: booking.customer_phone,
    kind: "confirmation",
    bookingId: booking.id,
    body:
      `${settings.shop_name}: you're booked — ${booking.serviceName}, ${when}. ` +
      `${settings.shop_address} (inside Cable Car Clothiers). ` +
      `Reply Y to confirm. Cancel or reschedule: ${manageUrl}`,
  });

  // Momo hears about bookings clients made themselves; not ones he entered.
  if (!opts.isAdmin) {
    await notifyOwner(
      settings,
      `${opts.ownerLabel}: ${booking.customer_name} — ${booking.serviceName}, ${when}. ` +
        `${booking.customer_phone}`,
      { bookingId: booking.id },
    );
  }

  const minSendAt = new Date(Date.now() + TWILIO_MIN_SCHEDULE_MIN * 60_000);
  const startsAtMs = new Date(booking.starts_at).getTime();
  const updates: { reminder_sid?: string; owner_alert_sid?: string } = {};

  const reminderAt = new Date(startsAtMs - REMINDER_LEAD_MIN * 60_000);
  if (reminderAt >= minSendAt) {
    const sid = await sendSms({
      to: booking.customer_phone,
      kind: "reminder",
      bookingId: booking.id,
      sendAt: reminderAt,
      body:
        `Reminder: ${booking.serviceName} with ${settings.shop_name} today at ${startTime}. ` +
        `${settings.shop_address}. Not confirmed yet? Reply Y. ` +
        `Running late or need to change? ${manageUrl}`,
    });
    if (sid) updates.reminder_sid = sid;
  }

  // Scheduled heads-up to Momo, cancelled the moment the client replies Y.
  const alertAt = new Date(startsAtMs - OWNER_ALERT_LEAD_MIN * 60_000);
  if (alertAt >= minSendAt) {
    const sid = await notifyOwner(
      settings,
      `Heads up: ${booking.customer_name} (${startTime} ${booking.serviceName}) ` +
        `hasn't replied Y to confirm. ${booking.customer_phone}`,
      { bookingId: booking.id, sendAt: alertAt },
    );
    if (sid) updates.owner_alert_sid = sid;
  }

  if (Object.keys(updates).length > 0) {
    await supabaseAdmin().from("bookings").update(updates).eq("id", booking.id);
  }
}

export async function createBooking(input: {
  serviceId: string;
  startsAt: string; // UTC ISO from the slot picker
  name: string;
  phone: string;
  source?: "web" | "admin";
  /** How the text to Momo is labelled — "Rescheduled" when moving a booking. */
  ownerLabel?: string;
}): Promise<BookingResult> {
  const db = supabaseAdmin();
  const isAdmin = input.source === "admin";

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  // Walk-ins added by Momo may have no phone; web bookings always need one.
  let phone: string | null = null;
  if (input.phone.trim() || !isAdmin) {
    phone = normalizeUsPhone(input.phone);
    if (!phone) return { ok: false, error: "Please enter a valid US phone number." };
  }

  const { data: service } = await db
    .from("services")
    .select("*")
    .eq("id", input.serviceId)
    .eq("active", true)
    .single<Service>();
  if (!service) return { ok: false, error: "That service is no longer available." };

  const settings = await getSettings();
  const date = formatInTimeZone(input.startsAt, settings.timezone, "yyyy-MM-dd");
  // Admin bookings skip the public lead-time window (walk-ins start now).
  const asOf = isAdmin
    ? new Date(Date.now() - settings.min_lead_time_min * 60_000)
    : new Date();
  const slots = await getAvailableSlots(service.id, date, undefined, asOf);
  const startsAt = new Date(input.startsAt);
  if (!slots.some((s) => s.startsAt === startsAt.toISOString())) {
    return { ok: false, error: "That time is no longer available — please pick another." };
  }

  const endsAt = new Date(startsAt.getTime() + service.duration_min * 60_000);
  const { data: booking, error } = await db
    .from("bookings")
    .insert({
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      customer_name: name,
      customer_phone: phone ?? "",
      source: input.source ?? "web",
    })
    .select("id, starts_at, customer_name, customer_phone, manage_token")
    .single();

  if (error || !booking) {
    // 23P01 = exclusion constraint: someone confirmed this slot a moment ago.
    if (error?.code === "23P01") {
      return { ok: false, error: "That time was just taken — please pick another." };
    }
    console.error("createBooking insert failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  if (phone) {
    await sendBookingTexts(
      { ...booking, serviceName: service.name },
      { isAdmin, ownerLabel: input.ownerLabel ?? "New booking" },
    );
  }
  return { ok: true, manageToken: booking.manage_token };
}

export async function getBookingByToken(token: string): Promise<BookingWithService | null> {
  const { data } = await supabaseAdmin()
    .from("bookings")
    .select("*, services(*)")
    .eq("manage_token", token)
    .single();
  return (data as BookingWithService) ?? null;
}

export async function cancelBooking(opts: {
  bookingId: string;
  notifyCustomer: boolean;
  /** Text Momo about it — true for cancellations the client made themselves. */
  notifyOwner?: boolean;
}): Promise<BookingResult> {
  const db = supabaseAdmin();
  const { data: booking } = await db
    .from("bookings")
    .select("*, services(*)")
    .eq("id", opts.bookingId)
    .single<BookingWithService>();
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.status !== "confirmed") {
    return { ok: false, error: "This booking is no longer active." };
  }

  const { error } = await db
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", booking.id);
  if (error) {
    console.error("cancelBooking failed", error);
    return { ok: false, error: "Could not cancel — please try again." };
  }

  await cancelScheduledSms(booking.reminder_sid);
  await cancelScheduledSms(booking.owner_alert_sid);
  if ((opts.notifyCustomer && booking.customer_phone) || opts.notifyOwner) {
    const settings = await getSettings();
    const when = whenPhrase(booking.starts_at, settings);
    if (opts.notifyCustomer && booking.customer_phone) {
      await sendSms({
        to: booking.customer_phone,
        kind: "cancellation",
        bookingId: booking.id,
        body:
          `${settings.shop_name}: your ${booking.services.name} on ` +
          `${when} has been cancelled. ` +
          `Rebook anytime: ${siteUrl()}/book`,
      });
    }
    if (opts.notifyOwner) {
      await notifyOwner(
        settings,
        `Cancelled: ${booking.customer_name} — ${booking.services.name}, ${when}.`,
        { bookingId: booking.id },
      );
    }
  }
  return { ok: true, manageToken: booking.manage_token };
}

/** Cancel + rebook as one operation; keeps the same customer and service. */
export async function rescheduleBooking(
  token: string,
  newStartsAt: string,
): Promise<BookingResult> {
  const booking = await getBookingByToken(token);
  if (!booking || booking.status !== "confirmed") {
    return { ok: false, error: "This booking can no longer be changed." };
  }

  const cancelled = await cancelBooking({ bookingId: booking.id, notifyCustomer: false });
  if (!cancelled.ok) return cancelled;

  const rebooked = await createBooking({
    serviceId: booking.service_id,
    startsAt: newStartsAt,
    name: booking.customer_name,
    phone: booking.customer_phone,
    source: booking.source,
    ownerLabel: "Rescheduled",
  });
  if (!rebooked.ok) {
    // Put the original slot back rather than leaving the customer with nothing.
    await supabaseAdmin()
      .from("bookings")
      .update({ status: "confirmed", cancelled_at: null })
      .eq("id", booking.id);
  }
  return rebooked;
}

/**
 * Client texted "Y": mark their next appointment confirmed, cancel the
 * scheduled "hasn't confirmed" alert, and tell Momo. Returns the reply text.
 */
export async function confirmFromSms(fromPhone: string): Promise<string> {
  const db = supabaseAdmin();
  const settings = await getSettings();
  const { data } = await db
    .from("bookings")
    .select("*, services(*)")
    .eq("customer_phone", fromPhone)
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(1);
  const booking = data?.[0] as BookingWithService | undefined;

  if (!booking) {
    return (
      `${settings.shop_name}: we couldn't find an upcoming appointment for ` +
      `this number. Book one at ${siteUrl()}/book`
    );
  }
  const when = whenPhrase(booking.starts_at, settings);
  if (booking.customer_confirmed_at) {
    return `You're already confirmed — see you ${when}!`;
  }

  await db
    .from("bookings")
    .update({ customer_confirmed_at: new Date().toISOString(), owner_alert_sid: null })
    .eq("id", booking.id);
  await cancelScheduledSms(booking.owner_alert_sid);
  await notifyOwner(
    settings,
    `Confirmed: ${booking.customer_name} — ${booking.services.name}, ${when}.`,
    { bookingId: booking.id },
  );
  return `You're confirmed — ${booking.services.name}, ${when}. See you then!`;
}

/** Any other inbound text ("running late", questions) gets forwarded to Momo. */
export async function relayInboundToOwner(fromPhone: string, body: string): Promise<void> {
  const db = supabaseAdmin();
  const settings = await getSettings();
  // Attach a name when we recognize the number from a booking.
  const { data } = await db
    .from("bookings")
    .select("customer_name")
    .eq("customer_phone", fromPhone)
    .order("created_at", { ascending: false })
    .limit(1);
  const who = data?.[0]?.customer_name ? `${data[0].customer_name} (${fromPhone})` : fromPhone;
  await notifyOwner(settings, `Text from ${who}: ${body.slice(0, 500)}`);
}
