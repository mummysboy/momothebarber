import { supabaseAdmin } from "@/lib/db";
import { requireAdmin } from "@/lib/supabase-auth";
import type { Service } from "@/lib/types";
import ServiceEditor from "./ServiceEditor";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  await requireAdmin();
  const { data: services } = await supabaseAdmin()
    .from("services")
    .select("*")
    .order("sort_order");

  return (
    <main>
      <h1 className="font-display text-3xl font-bold">Services &amp; prices</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Changes show on the site and booking page immediately. Turning a service
        off hides it from new bookings (existing appointments keep it).
      </p>
      <div className="mt-8 space-y-4">
        {((services ?? []) as Service[]).map((s) => (
          <ServiceEditor key={s.id} service={s} />
        ))}
      </div>
    </main>
  );
}
