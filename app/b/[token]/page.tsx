import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { getBookingByToken } from "@/lib/booking";
import { bookableDates, getSettings } from "@/lib/availability";
import ManageBooking from "./ManageBooking";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ moved?: string }>;
}) {
  const { token } = await params;
  const { moved } = await searchParams;
  const [booking, settings] = await Promise.all([getBookingByToken(token), getSettings()]);

  const dates = booking
    ? bookableDates(settings).map((date) => ({
        date,
        label: formatInTimeZone(`${date}T12:00:00Z`, "UTC", "EEE, MMM d"),
      }))
    : [];

  return (
    <main className="flex-1">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between px-6 py-6">
          <Link href="/" className="font-display text-xl font-bold">
            Momo The Barber
          </Link>
          <span className="font-sans text-xs uppercase tracking-[0.25em] text-ink-soft">
            Your appointment
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">
        {!booking ? (
          <div className="deco-frame px-8 py-12 text-center">
            <h1 className="font-display text-2xl font-bold">Booking not found</h1>
            <p className="mt-4 text-ink-soft">
              That link doesn&rsquo;t match an appointment.{" "}
              <Link href="/book" className="text-brand-red underline">
                Book a new one
              </Link>{" "}
              or call (415) 361-0025.
            </p>
          </div>
        ) : (
          <ManageBooking
            booking={{
              status: booking.status,
              serviceName: booking.services.name,
              service: booking.services,
              when: formatInTimeZone(
                booking.starts_at,
                settings.timezone,
                "EEEE, MMMM d 'at' h:mm a",
              ),
            }}
            token={token}
            dates={dates}
            justMoved={moved === "1"}
          />
        )}
      </div>
    </main>
  );
}
