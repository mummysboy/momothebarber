import { supabaseAdmin } from "./db";

export type SmsKind = "confirmation" | "reminder" | "cancellation" | "owner";

function twilioConfig() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_MESSAGING_SERVICE_SID) return null;
  return {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
    messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
  };
}

async function twilioClient() {
  const config = twilioConfig();
  if (!config) return null;
  const { default: twilio } = await import("twilio");
  return { client: twilio(config.accountSid, config.authToken), config };
}

/**
 * Send an SMS now, or schedule it for `sendAt` (Twilio requires 15min–35days out).
 * Without Twilio credentials the message is written to sms_outbox so every flow
 * stays testable before the account is live. Returns the Twilio message SID when
 * scheduled/sent, null in outbox mode.
 */
export async function sendSms(opts: {
  to: string;
  body: string;
  kind: SmsKind;
  bookingId?: string;
  sendAt?: Date;
}): Promise<string | null> {
  const twilio = await twilioClient();
  if (!twilio) {
    await supabaseAdmin().from("sms_outbox").insert({
      to_phone: opts.to,
      body: opts.body,
      kind: opts.kind,
      booking_id: opts.bookingId ?? null,
      send_at: opts.sendAt?.toISOString() ?? null,
    });
    return null;
  }
  const message = await twilio.client.messages.create({
    to: opts.to,
    body: opts.body,
    messagingServiceSid: twilio.config.messagingServiceSid,
    ...(opts.sendAt ? { scheduleType: "fixed" as const, sendAt: opts.sendAt } : {}),
  });
  return message.sid;
}

/** Cancel a scheduled (not yet sent) message. Safe to call with stale SIDs. */
export async function cancelScheduledSms(sid: string | null): Promise<void> {
  if (!sid) return;
  const twilio = await twilioClient();
  if (!twilio) return;
  try {
    await twilio.client.messages(sid).update({ status: "canceled" });
  } catch {
    // Already sent or delivered — nothing to cancel.
  }
}

/** Normalize a US phone number to E.164, or return null if invalid. */
export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
