import { formatInTimeZone } from "date-fns-tz";
import { supabaseAdmin } from "@/lib/db";
import { getSettings } from "@/lib/availability";
import { requireAdmin } from "@/lib/supabase-auth";
import type { BlockedTime, BusinessHours } from "@/lib/types";
import HoursEditor from "./HoursEditor";
import BlocksEditor from "./BlocksEditor";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  await requireAdmin();
  const settings = await getSettings();
  const db = supabaseAdmin();
  const [{ data: hours }, { data: blocks }] = await Promise.all([
    db.from("business_hours").select("*").order("weekday"),
    db
      .from("blocked_times")
      .select("*")
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);

  return (
    <main className="space-y-12">
      <section>
        <h1 className="font-display text-3xl font-bold">Weekly hours</h1>
        <p className="mt-2 text-sm text-ink-soft">
          These control which times clients can book. Changes apply immediately.
        </p>
        <div className="mt-6">
          <HoursEditor initial={(hours ?? []) as BusinessHours[]} />
        </div>
      </section>
      <section>
        <h2 className="font-display text-3xl font-bold">Blocked time</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Block lunch, errands, or days off — those slots disappear from booking.
        </p>
        <div className="mt-6">
          <BlocksEditor
            timezone={settings.timezone}
            blocks={((blocks ?? []) as BlockedTime[]).map((b) => ({
              id: b.id,
              reason: b.reason,
              label: `${formatInTimeZone(b.starts_at, settings.timezone, "EEE, MMM d h:mm a")} – ${formatInTimeZone(
                b.ends_at,
                settings.timezone,
                "h:mm a",
              )}`,
            }))}
          />
        </div>
      </section>
    </main>
  );
}
