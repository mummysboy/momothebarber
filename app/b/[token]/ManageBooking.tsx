"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Service } from "@/lib/types";
import BookingFlow from "@/app/book/BookingFlow";
import { cancelByToken, rescheduleByToken } from "./actions";

type Props = {
  booking: {
    status: string;
    serviceName: string;
    service: Service;
    when: string;
  };
  token: string;
  dates: { date: string; label: string }[];
  justMoved: boolean;
};

export default function ManageBooking({ booking, token, dates, justMoved }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "reschedule" | "cancelled">(
    booking.status === "cancelled" ? "cancelled" : "view",
  );
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (mode === "cancelled" || booking.status !== "confirmed") {
    const past = booking.status === "completed" || booking.status === "no_show";
    return (
      <div className="deco-frame px-8 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">
          {past ? "This appointment has passed" : "Appointment cancelled"}
        </h1>
        <p className="mt-4 text-ink-soft">
          {booking.serviceName} — {booking.when}
        </p>
        <Link
          href="/book"
          className="mt-8 inline-block bg-brand-red px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-cream hover:bg-brand-red-dark"
        >
          Book a new appointment
        </Link>
      </div>
    );
  }

  if (mode === "reschedule") {
    return (
      <div>
        <div className="mb-8 flex items-baseline justify-between">
          <h1 className="font-display text-2xl font-bold">Reschedule</h1>
          <button
            type="button"
            onClick={() => setMode("view")}
            className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft underline"
          >
            Keep current time
          </button>
        </div>
        <p className="mb-8 text-ink-soft">
          Currently: {booking.serviceName} — {booking.when}
        </p>
        <BookingFlow
          services={[]}
          dates={dates}
          rescheduleService={booking.service}
          onPickSlot={async (startsAt) => {
            const result = await rescheduleByToken(token, startsAt);
            if (result.ok) {
              router.replace(`/b/${result.newToken}?moved=1`);
              return null;
            }
            return result.error;
          }}
        />
      </div>
    );
  }

  return (
    <div className="deco-frame px-8 py-12 text-center">
      {justMoved && (
        <p className="mb-6 font-sans text-xs uppercase tracking-[0.3em] text-brand-red">
          Appointment moved — new confirmation text sent
        </p>
      )}
      <h1 className="font-display text-3xl font-bold">{booking.serviceName}</h1>
      <p className="mt-4 text-lg text-ink-soft">{booking.when}</p>
      <p className="mt-2 text-sm text-ink-soft">
        110 Sutter St, Suite 108 (inside Cable Car Clothiers)
      </p>
      {error && (
        <p className="mx-auto mt-6 max-w-md border border-brand-red bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
          {error}
        </p>
      )}
      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => setMode("reschedule")}
          className="border border-ink px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] transition-colors hover:bg-cream-dark"
        >
          Reschedule
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirmingCancel) {
              setConfirmingCancel(true);
              return;
            }
            setError(null);
            startTransition(async () => {
              const result = await cancelByToken(token);
              if (result.ok) setMode("cancelled");
              else setError(result.error ?? "Could not cancel.");
            });
          }}
          className={`border border-brand-red px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] transition-colors disabled:opacity-40 ${
            confirmingCancel
              ? "bg-brand-red text-cream hover:bg-brand-red-dark"
              : "text-brand-red hover:bg-brand-red hover:text-cream"
          }`}
        >
          {isPending
            ? "Cancelling…"
            : confirmingCancel
              ? "Yes, cancel it"
              : "Cancel appointment"}
        </button>
      </div>
    </div>
  );
}
