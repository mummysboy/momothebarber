import { formatInTimeZone } from "date-fns-tz";
import { supabaseAdmin } from "./db";
import { getAvailableSlots, getSettings } from "./availability";
import { cancelScheduledSms, normalizeUsPhone, sendSms } from "./sms";
import type { BookingWithService, Service, Settings } from "./types";

const REMINDER_LEAD_MIN = 120; // "2 hours before"
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

async function sendConfirmationAndReminder(booking: {
  id: string;
  starts_at: string;
  customer_phone: string;
  manage_token: string;
  serviceName: string;
}): Promise<void> {
  const settings = await getSettings();
  const when = whenPhrase(booking.starts_at, settings);
  const manageUrl = `${siteUrl()}/b/${booking.manage_token}`;

  await sendSms({
    to: booking.customer_phone,
    kind: "confirmation",
    bookingId: booking.id,
    body:
      `${settings.shop_name}: you're booked — ${booking.serviceName}, ${when}. ` +
      `${settings.shop_address} (inside Cable Car Clothiers). ` +
      `Cancel or reschedule: ${manageUrl}`,
  });

  const reminderAt = new Date(
    new Date(booking.starts_at).getTime() - REMINDER_LEAD_MIN * 60_000,
  );
  const minSendAt = new Date(Date.now() + TWILIO_MIN_SCHEDULE_MIN * 60_000);
  if (reminderAt < minSendAt) return; // booked too close to the appointment

  const reminderTime = formatInTimeZone(booking.starts_at, settings.timezone, "h:mm a");
  const sid = await sendSms({
    to: booking.customer_phone,
    kind: "reminder",
    bookingId: booking.id,
    sendAt: reminderAt,
    body:
      `Reminder: ${booking.serviceName} with ${settings.shop_name} today at ${reminderTime}. ` +
      `${settings.shop_address}. Running late or need to change? ${siteUrl()}/b/${booking.manage_token}`,
  });
  if (sid) {
    await supabaseAdmin().from("bookings").update({ reminder_sid: sid }).eq("id", booking.id);
  }
}

export async function createBooking(input: {
  serviceId: string;
  startsAt: string; // UTC ISO from the slot picker
  name: string;
  phone: string;
  source?: "web" | "admin";
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
    .select("id, starts_at, customer_phone, manage_token")
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
    await sendConfirmationAndReminder({ ...booking, serviceName: service.name });
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
  if (opts.notifyCustomer && booking.customer_phone) {
    const settings = await getSettings();
    await sendSms({
      to: booking.customer_phone,
      kind: "cancellation",
      bookingId: booking.id,
      body:
        `${settings.shop_name}: your ${booking.services.name} on ` +
        `${whenPhrase(booking.starts_at, settings)} has been cancelled. ` +
        `Rebook anytime: ${siteUrl()}/book`,
    });
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
