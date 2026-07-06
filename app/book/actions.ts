"use server";

import { getAvailableSlots, type Slot } from "@/lib/availability";
import { createBooking, type BookingResult } from "@/lib/booking";

export async function fetchSlots(serviceId: string, date: string): Promise<Slot[]> {
  return getAvailableSlots(serviceId, date);
}

export async function submitBooking(input: {
  serviceId: string;
  startsAt: string;
  name: string;
  phone: string;
}): Promise<BookingResult> {
  return createBooking({ ...input, source: "web" });
}
