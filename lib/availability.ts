import { addDays, addMinutes, format, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { supabaseAdmin } from "./db";
import type { BlockedTime, Booking, BusinessHours, Service, Settings } from "./types";

export type Slot = {
  startsAt: string; // UTC ISO
  label: string; // e.g. "2:15 PM" in shop time
};

type Interval = { start: Date; end: Date };

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabaseAdmin().from("settings").select("*").single();
  if (error) throw error;
  return data as Settings;
}

/** Dates (yyyy-MM-dd, shop TZ) currently offered by the booking flow. */
export function bookableDates(settings: Settings, now = new Date()): string[] {
  const today = toZonedTime(now, settings.timezone);
  return Array.from({ length: settings.max_advance_days + 1 }, (_, i) =>
    format(addDays(startOfDay(today), i), "yyyy-MM-dd"),
  );
}

/**
 * Available start times for a service on a given shop-TZ date.
 * `excludeBookingId` lets a reschedule ignore the booking being moved.
 */
export async function getAvailableSlots(
  serviceId: string,
  date: string,
  excludeBookingId?: string,
  now = new Date(),
): Promise<Slot[]> {
  const db = supabaseAdmin();
  const settings = await getSettings();
  const tz = settings.timezone;

  if (!bookableDates(settings, now).includes(date)) return [];

  const dayStart = fromZonedTime(`${date}T00:00:00`, tz);
  const dayEnd = fromZonedTime(`${date}T23:59:59`, tz);
  const weekday = Number(formatInTimeZone(dayStart, tz, "i")) % 7; // 0 = Sunday

  const [{ data: service }, { data: hours }, { data: bookings }, { data: blocks }] =
    await Promise.all([
      db.from("services").select("*").eq("id", serviceId).eq("active", true).single(),
      db.from("business_hours").select("*").eq("weekday", weekday).single(),
      db
        .from("bookings")
        .select("id, starts_at, ends_at")
        .eq("status", "confirmed")
        .lt("starts_at", dayEnd.toISOString())
        .gt("ends_at", dayStart.toISOString()),
      db
        .from("blocked_times")
        .select("starts_at, ends_at")
        .lt("starts_at", dayEnd.toISOString())
        .gt("ends_at", dayStart.toISOString()),
    ]);

  const day = hours as BusinessHours | null;
  if (!service || !day?.is_open) return [];

  const busy: Interval[] = [
    ...((bookings ?? []) as Pick<Booking, "id" | "starts_at" | "ends_at">[])
      .filter((b) => b.id !== excludeBookingId)
      .map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    ...((blocks ?? []) as Pick<BlockedTime, "starts_at" | "ends_at">[]).map((b) => ({
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
    })),
  ];

  const open = fromZonedTime(`${date}T${day.open_time}`, tz);
  const close = fromZonedTime(`${date}T${day.close_time}`, tz);
  const earliest = addMinutes(now, settings.min_lead_time_min);
  const duration = (service as Service).duration_min;

  const slots: Slot[] = [];
  for (
    let start = open;
    addMinutes(start, duration) <= close;
    start = addMinutes(start, settings.slot_granularity_min)
  ) {
    const candidate = { start, end: addMinutes(start, duration) };
    if (candidate.start < earliest) continue;
    if (busy.some((b) => overlaps(candidate, b))) continue;
    slots.push({
      startsAt: start.toISOString(),
      label: formatInTimeZone(start, tz, "h:mm a"),
    });
  }
  return slots;
}
