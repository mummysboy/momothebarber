"use client";

import { useState, useTransition } from "react";
import { adminCancelBooking, adminSetBookingStatus } from "../actions";

export default function AgendaActions({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const buttonClass =
    "border px-3 py-1.5 font-sans text-xs uppercase tracking-[0.15em] transition-colors disabled:opacity-40";

  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => adminSetBookingStatus(bookingId, "completed"))}
        className={`${buttonClass} border-ink hover:bg-ink hover:text-cream`}
      >
        Done
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => adminSetBookingStatus(bookingId, "no_show"))}
        className={`${buttonClass} border-ink-soft/50 text-ink-soft hover:bg-ink-soft hover:text-cream`}
      >
        No-show
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirmingCancel) {
            setConfirmingCancel(true);
            return;
          }
          startTransition(() => adminCancelBooking(bookingId));
        }}
        className={`${buttonClass} ${
          confirmingCancel
            ? "border-brand-red bg-brand-red text-cream hover:bg-brand-red-dark"
            : "border-brand-red text-brand-red hover:bg-brand-red hover:text-cream"
        }`}
      >
        {confirmingCancel ? "Confirm — texts client" : "Cancel"}
      </button>
    </div>
  );
}
