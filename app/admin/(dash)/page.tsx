import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { supabaseAdmin } from "@/lib/db";
import { getSettings } from "@/lib/availability";
import { requireAdmin } from "@/lib/supabase-auth";
import type { BookingWithService, Service } from "@/lib/types";
import AgendaActions from "./AgendaActions";
import AddBooking from "./AddBooking";

export const dynamic = "force-dynamic";

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireAdmin();
  const settings = await getSettings();
  const tz = settings.timezone;
  const today = format(toZonedTime(new Date(), tz), "yyyy-MM-dd");
  const { date: dateParam } = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? "") ? dateParam! : today;

  const dayStart = fromZonedTime(`${date}T00:00:00`, tz);
  const dayEnd = fromZonedTime(`${date}T23:59:59`, tz);

  const db = supabaseAdmin();
  const [{ data: bookings }, { data: services }] = await Promise.all([
    db
      .from("bookings")
      .select("*, services(*)")
      .gte("starts_at", dayStart.toISOString())
      .lte("starts_at", dayEnd.toISOString())
      .order("starts_at"),
    db.from("services").select("*").eq("active", true).order("sort_order"),
  ]);

  const dateNav = Array.from({ length: 8 }, (_, i) => {
    const d = format(addDays(new Date(`${today}T12:00:00`), i - 1), "yyyy-MM-dd");
    return { date: d, label: format(new Date(`${d}T12:00:00`), "EEE d") };
  });

  const list = (bookings ?? []) as BookingWithService[];
  const active = list.filter((b) => b.status === "confirmed");

  return (
    <main>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">
          {format(new Date(`${date}T12:00:00`), "EEEE, MMMM d")}
        </h1>
        <span className="font-sans text-sm text-ink-soft">
          {active.length} appointment{active.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {dateNav.map((d) => (
          <a
            key={d.date}
            href={`/admin?date=${d.date}`}
            className={`shrink-0 border px-4 py-2 font-sans text-sm ${
              d.date === date
                ? "border-brand-red bg-brand-red text-cream"
                : "border-ink bg-cream hover:bg-cream-dark"
            }`}
          >
            {d.date === today ? "Today" : d.label}
          </a>
        ))}
        <input
          type="date"
          defaultValue={date}
          className="shrink-0 border border-ink bg-cream px-3 py-2 font-sans text-sm"
          // Progressive enhancement: jump straight to a typed date.
          name="date"
          form="date-jump"
        />
        <form id="date-jump" action="/admin" className="shrink-0">
          <button type="submit" className="border border-ink px-3 py-2 font-sans text-sm hover:bg-cream-dark">
            Go
          </button>
        </form>
      </div>

      <div className="mt-8 space-y-3">
        {list.length === 0 && (
          <p className="border border-dashed border-ink-soft/40 px-6 py-12 text-center italic text-ink-soft">
            No appointments this day.
          </p>
        )}
        {list.map((b) => (
          <div
            key={b.id}
            className={`flex flex-wrap items-center gap-4 border px-5 py-4 ${
              b.status === "confirmed"
                ? "border-ink bg-cream"
                : "border-ink-soft/30 bg-cream-dark/50 opacity-60"
            }`}
          >
            <div className="w-24 font-display text-lg font-bold">
              {formatInTimeZone(b.starts_at, tz, "h:mm a")}
            </div>
            <div className="min-w-40 flex-1">
              <p className="font-semibold">{b.customer_name}</p>
              <p className="text-sm text-ink-soft">
                {b.services.name} · {b.services.duration_min} min
                {b.customer_phone && (
                  <>
                    {" · "}
                    <a className="underline" href={`tel:${b.customer_phone}`}>
                      {b.customer_phone.replace("+1", "")}
                    </a>
                  </>
                )}
                {b.source === "admin" && " · added by you"}
              </p>
            </div>
            {b.status === "confirmed" ? (
              <AgendaActions bookingId={b.id} />
            ) : (
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
                {b.status.replace("_", "-")}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12">
        <AddBooking services={(services ?? []) as Service[]} date={date} />
      </div>
    </main>
  );
}
