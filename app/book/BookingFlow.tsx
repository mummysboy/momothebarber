"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { Service } from "@/lib/types";
import type { Slot } from "@/lib/availability";
import { fetchSlots, submitBooking } from "./actions";

type DateOption = { date: string; label: string };

// "10:30 AM" → Morning · "12:15 PM"–"4:45 PM" → Afternoon · "5:00 PM"+ → Evening
function groupSlots(slots: Slot[]): { name: string; slots: Slot[] }[] {
  const period = (label: string) => {
    if (label.endsWith("AM")) return "Morning";
    const hour = Number(label.split(":")[0]);
    return hour === 12 || hour < 5 ? "Afternoon" : "Evening";
  };
  return ["Morning", "Afternoon", "Evening"]
    .map((name) => ({ name, slots: slots.filter((s) => period(s.label) === name) }))
    .filter((g) => g.slots.length > 0);
}

type Props = {
  services: Service[];
  dates: DateOption[];
  /** Reschedule mode: submit is handled by the parent instead of submitBooking. */
  rescheduleService?: Service;
  onPickSlot?: (startsAt: string) => Promise<string | null>;
};

function StepHeading({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl font-bold">
      <span className="mr-3 text-brand-red">{step}.</span>
      {children}
    </h2>
  );
}

export default function BookingFlow({ services, dates, rescheduleService, onPickSlot }: Props) {
  const [service, setService] = useState<Service | null>(rescheduleService ?? null);
  const [date, setDate] = useState<string>(dates[0]?.date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ manageToken: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isReschedule = Boolean(onPickSlot);

  const loadSlots = useCallback(
    (serviceId: string, d: string) => {
      setSlots(null);
      setSlot(null);
      startTransition(async () => {
        setSlots(await fetchSlots(serviceId, d));
      });
    },
    [startTransition],
  );

  useEffect(() => {
    if (service && date) loadSlots(service.id, date);
  }, [service, date, loadSlots]);

  const confirm = () => {
    if (!service || !slot) return;
    setError(null);
    startTransition(async () => {
      if (onPickSlot) {
        const err = await onPickSlot(slot.startsAt);
        if (err) {
          setError(err);
          loadSlots(service.id, date);
        }
        return;
      }
      const result = await submitBooking({
        serviceId: service.id,
        startsAt: slot.startsAt,
        name,
        phone,
      });
      if (result.ok) {
        setConfirmed({ manageToken: result.manageToken });
      } else {
        setError(result.error);
        loadSlots(service.id, date);
      }
    });
  };

  if (confirmed) {
    const dateLabel = dates.find((d) => d.date === date)?.label;
    return (
      <div className="deco-frame bg-cream px-8 py-12 text-center">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-brand-red">
          Appointment confirmed
        </p>
        <h2 className="mt-4 font-display text-3xl font-bold">See you soon, {name.split(" ")[0]}.</h2>
        <p className="mt-6 text-ink-soft">
          {service?.name} — {dateLabel} at {slot?.label}
          <br />
          110 Sutter St, Suite 108 (inside Cable Car Clothiers)
        </p>
        <p className="mt-6 text-sm text-ink-soft">
          A confirmation text is on its way — reply <strong>Y</strong>
          {" "}to confirm your spot. You&rsquo;ll get a reminder 2 hours
          before, and the link in the text lets you cancel or reschedule.
        </p>
        <p className="mt-4 text-sm italic text-ink-soft">
          We accept all forms of payment — cash preferred.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Step 1: service */}
      {!isReschedule && (
        <section>
          <StepHeading step={1}>Choose a service</StepHeading>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setService(s)}
                className={`border px-5 py-4 text-left transition-colors ${
                  service?.id === s.id
                    ? "border-brand-red bg-brand-red text-cream"
                    : "border-ink bg-cream hover:bg-cream-dark"
                }`}
              >
                <span className="flex items-baseline justify-between font-display text-lg font-semibold">
                  {s.name}
                  <span>${(s.price_cents / 100).toFixed(0)}</span>
                </span>
                <span
                  className={`mt-1 block text-sm ${
                    service?.id === s.id ? "text-cream/80" : "text-ink-soft"
                  }`}
                >
                  {s.duration_min} minutes
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2: date + time */}
      {service && (
        <section>
          <StepHeading step={isReschedule ? 1 : 2}>Pick a time</StepHeading>
          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {dates.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setDate(d.date)}
                className={`shrink-0 border px-4 py-2 font-sans text-sm transition-colors ${
                  date === d.date
                    ? "border-brand-red bg-brand-red text-cream"
                    : "border-ink bg-cream hover:bg-cream-dark"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="mt-6 min-h-16">
            {slots === null ? (
              <p className="text-sm italic text-ink-soft">Checking the book…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm italic text-ink-soft">
                No openings this day — try another date.
              </p>
            ) : (
              <div className="space-y-8">
                {groupSlots(slots).map((group) => (
                  <div key={group.name}>
                    <div className="flex items-center gap-4">
                      <span className="font-sans text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
                        {group.name}
                      </span>
                      <span aria-hidden className="h-px flex-1 bg-ink/20" />
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {group.slots.map((s) => (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => setSlot(s)}
                          className={`border py-2.5 text-center font-sans text-sm tabular-nums transition-colors ${
                            slot?.startsAt === s.startsAt
                              ? "border-brand-red bg-brand-red font-semibold text-cream"
                              : "border-ink bg-cream hover:bg-cream-dark"
                          }`}
                        >
                          {s.label.replace(/ [AP]M$/, "")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 3: details */}
      {service && slot && (
        <section>
          {!isReschedule && (
            <>
              <StepHeading step={3}>Your details</StepHeading>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
                    Name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="mt-2 w-full border border-ink bg-cream px-4 py-3 outline-none focus:border-brand-red"
                    placeholder="Your name"
                  />
                </label>
                <label className="block">
                  <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
                    Mobile number
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    className="mt-2 w-full border border-ink bg-cream px-4 py-3 outline-none focus:border-brand-red"
                    placeholder="(415) 555-0123"
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                By booking, you agree to receive appointment text messages from
                Momo The Barber (confirmation, a reminder 2 hours before, and any
                changes). Msg &amp; data rates may apply; frequency varies by
                appointment. Reply STOP to opt out, HELP for help. No marketing,
                ever. <a href="/privacy" className="underline">Privacy policy</a>.
              </p>
            </>
          )}
          {error && (
            <p className="mt-4 border border-brand-red bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={isPending || (!isReschedule && (name.trim().length < 2 || phone.trim().length < 10))}
            className="mt-6 w-full bg-brand-red px-10 py-4 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {isPending
              ? "Booking…"
              : isReschedule
                ? `Move to ${slot.label}`
                : `Confirm — ${service.name}, ${slot.label}`}
          </button>
        </section>
      )}
    </div>
  );
}
