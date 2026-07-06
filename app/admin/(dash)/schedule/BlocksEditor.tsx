"use client";

import { useState, useTransition } from "react";
import { fromZonedTime } from "date-fns-tz";
import { adminAddBlock, adminRemoveBlock } from "../../actions";

type BlockRow = { id: string; label: string; reason: string };

export default function BlocksEditor({
  blocks,
  timezone,
}: {
  blocks: BlockRow[];
  timezone: string;
}) {
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("13:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="border border-ink bg-cream">
      {blocks.length === 0 ? (
        <p className="border-b border-ink-soft/20 px-5 py-4 text-sm italic text-ink-soft">
          Nothing blocked.
        </p>
      ) : (
        blocks.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between gap-4 border-b border-ink-soft/20 px-5 py-3"
          >
            <span className="font-sans text-sm">
              {b.label}
              {b.reason && <span className="text-ink-soft"> — {b.reason}</span>}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => adminRemoveBlock(b.id))}
              className="font-sans text-xs uppercase tracking-[0.15em] text-brand-red underline disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))
      )}
      <div className="flex flex-wrap items-end gap-3 px-5 py-4">
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block border border-ink bg-cream px-2 py-1.5 font-sans text-sm"
          />
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">From</span>
          <input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block border border-ink bg-cream px-2 py-1.5 font-sans text-sm"
          />
        </label>
        <label className="block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">To</span>
          <input
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block border border-ink bg-cream px-2 py-1.5 font-sans text-sm"
          />
        </label>
        <label className="block flex-1 basis-40">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
            Reason (optional)
          </span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lunch, day off…"
            className="mt-1 block w-full border border-ink bg-cream px-2 py-1.5 font-sans text-sm"
          />
        </label>
        <button
          type="button"
          disabled={isPending || !date || !from || !to || to <= from}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await adminAddBlock({
                startsAt: fromZonedTime(`${date}T${from}:00`, timezone).toISOString(),
                endsAt: fromZonedTime(`${date}T${to}:00`, timezone).toISOString(),
                reason,
              });
              if (result.ok) {
                setDate("");
                setReason("");
              } else {
                setError(result.error);
              }
            });
          }}
          className="bg-ink px-6 py-2.5 font-sans text-xs font-semibold uppercase tracking-[0.2em] text-cream hover:bg-ink-soft disabled:opacity-40"
        >
          {isPending ? "Blocking…" : "Block time"}
        </button>
        {error && <span className="basis-full font-sans text-sm text-brand-red-dark">{error}</span>}
      </div>
    </div>
  );
}
