"use server";

import { cancelBooking, getBookingByToken, rescheduleBooking } from "@/lib/booking";

export async function cancelByToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const booking = await getBookingByToken(token);
  if (!booking) return { ok: false, error: "Booking not found." };
  const result = await cancelBooking({ bookingId: booking.id, notifyCustomer: true });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function rescheduleByToken(
  token: string,
  newStartsAt: string,
): Promise<{ ok: true; newToken: string } | { ok: false; error: string }> {
  const result = await rescheduleBooking(token, newStartsAt);
  return result.ok ? { ok: true, newToken: result.manageToken } : result;
}
