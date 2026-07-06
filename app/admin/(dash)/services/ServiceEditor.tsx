"use client";

import { useState, useTransition } from "react";
import type { Service } from "@/lib/types";
import { adminSaveService } from "../../actions";

export default function ServiceEditor({ service }: { service: Service }) {
  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description);
  const [price, setPrice] = useState(String(service.price_cents / 100));
  const [duration, setDuration] = useState(String(service.duration_min));
  const [active, setActive] = useState(service.active);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`border border-ink bg-cream p-5 ${active ? "" : "opacity-60"}`}>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">Name</span>
          <input
            value={name}
            onChange={(e) => (setSaved(false), setName(e.target.value))}
            className="mt-1 w-full border border-ink bg-cream px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
            Price ($)
          </span>
          <input
            value={price}
            onChange={(e) => (setSaved(false), setPrice(e.target.value))}
            inputMode="decimal"
            className="mt-1 w-full border border-ink bg-cream px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
            Minutes
          </span>
          <input
            value={duration}
            onChange={(e) => (setSaved(false), setDuration(e.target.value))}
            inputMode="numeric"
            className="mt-1 w-full border border-ink bg-cream px-3 py-2"
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
          Description
        </span>
        <input
          value={description}
          onChange={(e) => (setSaved(false), setDescription(e.target.value))}
          className="mt-1 w-full border border-ink bg-cream px-3 py-2"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => (setSaved(false), setActive(e.target.checked))}
            className="size-4 accent-brand-red"
          />
          Bookable
        </label>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            const priceCents = Math.round(Number(price) * 100);
            const durationMin = Number(duration);
            if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isInteger(durationMin) || durationMin <= 0) {
              setError("Price and minutes must be valid numbers.");
              return;
            }
            startTransition(async () => {
              const result = await adminSaveService({
                id: service.id,
                name,
                description,
                price_cents: priceCents,
                duration_min: durationMin,
                active,
              });
              if (result.ok) setSaved(true);
              else setError(result.error);
            });
          }}
          className="bg-brand-red px-6 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream hover:bg-brand-red-dark disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="font-sans text-sm text-ink-soft">Saved.</span>}
        {error && <span className="font-sans text-sm text-brand-red-dark">{error}</span>}
      </div>
    </div>
  );
}
