export type Service = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  active: boolean;
  sort_order: number;
};

export type BookingStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export type Booking = {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_phone: string;
  status: BookingStatus;
  source: "web" | "admin";
  manage_token: string;
  reminder_sid: string | null;
  created_at: string;
  cancelled_at: string | null;
};

export type BookingWithService = Booking & { services: Service };

export type BusinessHours = {
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

export type BlockedTime = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
};

export type Settings = {
  slot_granularity_min: number;
  min_lead_time_min: number;
  max_advance_days: number;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  timezone: string;
};
