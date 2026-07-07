"use client";

import { useEffect, useState } from "react";

const BOOKSY_URL =
  "https://booksy.com/en-us/1703710_momo-the-barber-sf_barber-shop_134715_san-francisco#ba_s=seo";

/** Full-screen notice shown once per browser session: this site is a demo. */
export default function DemoOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem("demo-notice-dismissed")) setOpen(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("demo-notice-dismissed", "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Demo notice"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 px-6"
    >
      <div className="max-w-md text-center">
        <p className="font-sans text-xs uppercase tracking-[0.3em] text-brand-red">
          Please note
        </p>
        <h2 className="mt-4 font-display text-3xl font-bold text-cream">
          This site is just a demo
        </h2>
        <p className="mt-4 text-cream/80">
          If you&rsquo;d like to book an appointment with Momo The Barber,
          please book through Booksy.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <a
            href={BOOKSY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-red px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-brand-red-dark"
          >
            Book on Booksy
          </a>
          <button
            type="button"
            onClick={dismiss}
            className="border border-cream/40 px-8 py-3 font-sans text-sm uppercase tracking-[0.2em] text-cream/80 transition-colors hover:border-cream hover:text-cream"
          >
            Continue to the demo
          </button>
        </div>
      </div>
    </div>
  );
}
