import { createHmac, timingSafeEqual } from "node:crypto";
import { confirmFromSms, relayInboundToOwner } from "@/lib/booking";
import { normalizeUsPhone } from "@/lib/sms";

export const dynamic = "force-dynamic";

/**
 * Twilio signs each webhook: base64(HMAC-SHA1(url + params sorted by key with
 * values appended, keyed by the auth token)). Without a valid signature the
 * request is rejected — nobody else can fake inbound texts.
 */
function isValidTwilioSignature(params: URLSearchParams, header: string | null): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // No Twilio configured (local dev / outbox mode): nothing to validate against.
  if (!authToken) return true;
  if (!header) return false;

  const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/sms`;
  const data =
    url +
    [...params.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => k + v)
      .join("");
  const expected = createHmac("sha1", authToken).update(data).digest();
  const received = Buffer.from(header, "base64");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function twiml(message?: string) {
  const escaped = message
    ?.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const body = escaped ? `<Message>${escaped}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const params = new URLSearchParams(await request.text());
  if (!isValidTwilioSignature(params, request.headers.get("x-twilio-signature"))) {
    return new Response("Invalid signature", { status: 403 });
  }

  const from = normalizeUsPhone(params.get("From") ?? "");
  const body = (params.get("Body") ?? "").trim();
  if (!from || !body) return twiml();

  // "Y" / "Yes" (any casing, trailing punctuation ok) confirms the appointment.
  if (/^y(es)?[.!]*$/i.test(body)) {
    return twiml(await confirmFromSms(from));
  }

  // Anything else ("running late", questions) goes straight to Momo's phone.
  await relayInboundToOwner(from, body);
  return twiml();
}
