import Image from "next/image";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { supabaseAdmin } from "@/lib/db";
import { bookableDates, getSettings } from "@/lib/availability";
import type { Service } from "@/lib/types";
import BookingFlow from "./BookingFlow";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const [settings, { data: services }] = await Promise.all([
    getSettings(),
    supabaseAdmin().from("services").select("*").eq("active", true).order("sort_order"),
  ]);

  const dates = bookableDates(settings).map((date) => ({
    date,
    label: formatInTimeZone(`${date}T12:00:00Z`, "UTC", "EEE, MMM d"),
  }));

  return (
    <main className="flex-1">
      <header className="border-b border-ink">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-mark.jpg"
              alt=""
              width={44}
              height={35}
              priority
              className="mix-blend-multiply"
            />
            <span className="font-display text-xl font-bold">Momo The Barber</span>
          </Link>
          <span className="text-right font-sans text-xs uppercase tracking-[0.25em] text-ink-soft">
            Book an appointment
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <BookingFlow services={(services ?? []) as Service[]} dates={dates} />
      </div>
    </main>
  );
}
