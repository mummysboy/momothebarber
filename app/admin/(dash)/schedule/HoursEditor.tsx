"use client";

import { useState, useTransition } from "react";
import type { BusinessHours } from "@/lib/types";
import { adminSaveHours } from "../../actions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const toHHMM = (t: string) => t.slice(0, 5);

export default function HoursEditor({ initial }: { initial: BusinessHours[] }) {
  const [hours, setHours] = useState(
    initial.map((h) => ({ ...h, open_time: toHHMM(h.open_time), close_time: toHHMM(h.close_time) })),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const update = (weekday: number, patch: Partial<BusinessHours>) => {
    setSaved(false);
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, ...patch } : h)));
  };

  return (
    <div className="border border-ink bg-cream">
      {hours.map((h) => (
        <div
          key={h.weekday}
          className="flex flex-wrap items-center gap-4 border-b border-ink-soft/20 px-5 py-3 last:border-b-0"
        >
          <label className="flex w-36 items-center gap-3">
            <input
              type="checkbox"
              checked={h.is_open}
              onChange={(e) => update(h.weekday, { is_open: e.target.checked })}
              className="size-4 accent-brand-red"
            />
            <span className="font-semibold">{WEEKDAYS[h.weekday]}</span>
          </label>
          {h.is_open ? (
            <div className="flex items-center gap-2 font-sans text-sm">
              <input
                type="time"
                value={h.open_time}
                onChange={(e) => update(h.weekday, { open_time: e.target.value })}
                className="border border-ink bg-cream px-2 py-1.5"
              />
              <span>to</span>
              <input
                type="time"
                value={h.close_time}
                onChange={(e) => update(h.weekday, { close_time: e.target.value })}
                className="border border-ink bg-cream px-2 py-1.5"
              />
            </div>
          ) : (
            <span className="font-sans text-sm italic text-ink-soft">Closed</span>
          )}
        </div>
      ))}
      <div className="flex items-center gap-4 px-5 py-4">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await adminSaveHours(hours);
              if (result.ok) setSaved(true);
              else setError(result.error);
            });
          }}
          className="bg-brand-red px-8 py-3 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream hover:bg-brand-red-dark disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Save hours"}
        </button>
        {saved && <span className="font-sans text-sm text-ink-soft">Saved.</span>}
        {error && <span className="font-sans text-sm text-brand-red-dark">{error}</span>}
      </div>
    </div>
  );
}
