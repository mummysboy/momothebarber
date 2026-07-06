"use client";

import { useState, useTransition } from "react";
import type { Service } from "@/lib/types";
import type { Slot } from "@/lib/availability";
import { adminCreateBooking, adminFetchSlots } from "../actions";

export default function AddBooking({ services, date }: { services: Service[]; date: string }) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadSlots = (svcId: string) => {
    setSlots(null);
    setStartsAt("");
    startTransition(async () => setSlots(await adminFetchSlots(svcId, date)));
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (serviceId) loadSlots(serviceId);
        }}
        className="border border-ink px-6 py-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] hover:bg-cream-dark"
      >
        + Add booking (walk-in / phone)
      </button>
    );
  }

  return (
    <div className="border border-ink bg-cream-dark/40 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Add booking</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft underline"
        >
          Close
        </button>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">Service</span>
          <select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              loadSlots(e.target.value);
            }}
            className="mt-2 w-full border border-ink bg-cream px-3 py-2.5"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.duration_min} min
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">Time</span>
          <select
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-2 w-full border border-ink bg-cream px-3 py-2.5"
          >
            <option value="">{slots === null ? "Loading…" : "Pick a time"}</option>
            {(slots ?? []).map((s) => (
              <option key={s.startsAt} value={s.startsAt}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full border border-ink bg-cream px-3 py-2.5"
            placeholder="Client name"
          />
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
            Phone (optional — texts confirmation)
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            className="mt-2 w-full border border-ink bg-cream px-3 py-2.5"
            placeholder="(415) 555-0123"
          />
        </label>
      </div>
      {error && (
        <p className="mt-4 border border-brand-red bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={isPending || !startsAt || name.trim().length < 2}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await adminCreateBooking({ serviceId, startsAt, name, phone });
            if (result.ok) {
              setOpen(false);
              setName("");
              setPhone("");
            } else {
              setError(result.error);
            }
          });
        }}
        className="mt-6 bg-brand-red px-8 py-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream hover:bg-brand-red-dark disabled:opacity-40"
      >
        {isPending ? "Adding…" : "Add booking"}
      </button>
    </div>
  );
}
