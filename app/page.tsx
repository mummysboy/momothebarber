import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/db";
import type { BusinessHours, Service } from "@/lib/types";

export const revalidate = 300;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

function price(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

export default async function HomePage() {
  const db = supabaseAdmin();
  const [{ data: services }, { data: hours }] = await Promise.all([
    db.from("services").select("*").eq("active", true).order("sort_order"),
    db.from("business_hours").select("*").order("weekday"),
  ]);

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b border-ink bg-cream">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:py-24">
          {/* Logo lockup — Momo's mark with the wordmark set to match his card */}
          <Image
            src="/logo-mark.jpg"
            alt="Momo The Barber logo"
            width={130}
            height={103}
            priority
            className="mx-auto mix-blend-multiply"
          />
          <div
            aria-hidden
            className="mx-auto mt-4 flex w-40 items-center gap-3 text-[#263248]"
          >
            <span className="h-px flex-1 bg-[#263248]" />
            <span className="text-xs leading-none">★</span>
            <span className="h-px flex-1 bg-[#263248]" />
          </div>
          <h1 className="mt-5 font-sans text-4xl font-black uppercase tracking-[0.06em] text-[#263248] sm:text-6xl">
            Momo The Barber
          </h1>
          <p className="mt-3 font-sans text-sm font-medium uppercase tracking-[0.5em] text-[#263248]/80 sm:text-base">
            Hair Cut and Shave
          </p>
          <div className="deco-rule mx-auto mt-10 w-24" />
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-ink-soft">
            Traditional barbering inside Cable Car Clothiers, San Francisco&rsquo;s
            British goods store since 1939. Classic cuts, hot lather, and the
            straight razor — done properly.
          </p>
          <Link
            href="/book"
            className="mt-10 inline-block bg-brand-red px-10 py-4 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-brand-red-dark"
          >
            Book an Appointment
          </Link>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">Services</h2>
        <div className="deco-rule mx-auto mt-6 w-16" />
        <ul className="mt-12 space-y-8">
          {((services ?? []) as Service[]).map((s) => (
            <li key={s.id}>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-xl font-semibold">{s.name}</span>
                <span
                  aria-hidden
                  className="flex-1 border-b border-dotted border-ink-soft/50"
                />
                <span className="font-display text-xl">{price(s.price_cents)}</span>
              </div>
              <p className="mt-1 text-sm text-ink-soft">
                {s.description} · {s.duration_min} min
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Gallery */}
      <section className="border-t border-ink bg-cream">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">The Work</h2>
          <div className="deco-rule mx-auto mt-6 w-16" />
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="deco-frame overflow-hidden">
                <Image
                  src={`/gallery/cut-${n}.jpg`}
                  alt="Haircut by Momo The Barber"
                  width={585}
                  height={780}
                  className="aspect-[3/4] w-full object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm italic text-ink-soft">
            Every cut finished with a hot towel, in the chair at Cable Car Clothiers.
          </p>
        </div>
      </section>

      {/* Visit */}
      <section className="border-t border-ink bg-cream-dark">
        <div className="mx-auto grid max-w-4xl gap-12 px-6 py-20 sm:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold">Visit the Shop</h2>
            <div className="deco-rule mt-6 w-16" />
            <p className="mt-8 leading-relaxed text-ink-soft">
              Inside Cable Car Clothiers
              <br />
              110 Sutter St, Suite 108
              <br />
              San Francisco, CA 94104
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              Call or text:{" "}
              <a className="underline decoration-brand-red" href="tel:+14153610025">
                (415) 361-0025
              </a>
            </p>
            <a
              className="mt-4 inline-block font-sans text-xs uppercase tracking-[0.2em] text-brand-red underline"
              href="https://maps.google.com/?q=110+Sutter+St,+San+Francisco,+CA+94104"
              target="_blank"
              rel="noreferrer"
            >
              Get directions
            </a>
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold">Hours</h2>
            <div className="deco-rule mt-6 w-16" />
            <ul className="mt-8 space-y-2 text-ink-soft">
              {((hours ?? []) as BusinessHours[]).map((h) => (
                <li key={h.weekday} className="flex justify-between gap-6">
                  <span>{WEEKDAYS[h.weekday]}</span>
                  <span>
                    {h.is_open
                      ? `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`
                      : "Closed"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm italic text-ink-soft">
              Walk-ins welcome when the chair is free — appointments guarantee it.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink py-10 text-center font-sans text-xs uppercase tracking-[0.25em] text-ink-soft">
        Momo The Barber · 110 Sutter St, San Francisco ·{" "}
        <Link href="/book" className="text-brand-red underline">
          Book online
        </Link>
      </footer>
    </main>
  );
}
