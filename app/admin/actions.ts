"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/db";
import { requireAdmin, supabaseAuthServer } from "@/lib/supabase-auth";
import { cancelBooking, createBooking } from "@/lib/booking";
import { getAvailableSlots } from "@/lib/availability";
import type { BookingStatus } from "@/lib/types";

export async function login(formData: FormData) {
  const supabase = await supabaseAuthServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/admin/login?error=1");
  redirect("/admin");
}

export async function logout() {
  const supabase = await supabaseAuthServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function adminCancelBooking(bookingId: string) {
  await requireAdmin();
  await cancelBooking({ bookingId, notifyCustomer: true });
  revalidatePath("/admin");
}

export async function adminSetBookingStatus(bookingId: string, status: BookingStatus) {
  await requireAdmin();
  await supabaseAdmin().from("bookings").update({ status }).eq("id", bookingId);
  revalidatePath("/admin");
}

export async function adminFetchSlots(serviceId: string, date: string) {
  await requireAdmin();
  const { getSettings } = await import("@/lib/availability");
  const settings = await getSettings();
  const asOf = new Date(Date.now() - settings.min_lead_time_min * 60_000);
  return getAvailableSlots(serviceId, date, undefined, asOf);
}

export async function adminCreateBooking(input: {
  serviceId: string;
  startsAt: string;
  name: string;
  phone: string;
}) {
  await requireAdmin();
  const result = await createBooking({ ...input, source: "admin" });
  if (result.ok) revalidatePath("/admin");
  return result;
}

export async function adminSaveHours(
  hours: { weekday: number; is_open: boolean; open_time: string; close_time: string }[],
) {
  await requireAdmin();
  const db = supabaseAdmin();
  for (const h of hours) {
    const { error } = await db.from("business_hours").update(h).eq("weekday", h.weekday);
    if (error) return { ok: false as const, error: "Invalid hours — closing must be after opening." };
  }
  revalidatePath("/admin/schedule");
  revalidatePath("/");
  return { ok: true as const };
}

export async function adminAddBlock(input: { startsAt: string; endsAt: string; reason: string }) {
  await requireAdmin();
  const { error } = await supabaseAdmin().from("blocked_times").insert({
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    reason: input.reason,
  });
  revalidatePath("/admin/schedule");
  return error
    ? { ok: false as const, error: "Could not add — check the times." }
    : { ok: true as const };
}

export async function adminRemoveBlock(id: string) {
  await requireAdmin();
  await supabaseAdmin().from("blocked_times").delete().eq("id", id);
  revalidatePath("/admin/schedule");
}

export async function adminSaveService(input: {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  active: boolean;
}) {
  await requireAdmin();
  const { id, ...fields } = input;
  const { error } = await supabaseAdmin().from("services").update(fields).eq("id", id);
  revalidatePath("/admin/services");
  revalidatePath("/");
  return error
    ? { ok: false as const, error: "Could not save — check price and duration." }
    : { ok: true as const };
}
