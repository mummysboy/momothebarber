import Link from "next/link";
import { logout } from "../actions";

export const metadata = { title: "Dashboard — Momo The Barber" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <nav className="border-b border-ink bg-ink text-cream">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
          <span className="mr-auto font-display text-lg font-bold">Momo The Barber</span>
          <Link href="/admin" className="font-sans text-xs uppercase tracking-[0.2em] hover:text-gold">
            Appointments
          </Link>
          <Link
            href="/admin/schedule"
            className="font-sans text-xs uppercase tracking-[0.2em] hover:text-gold"
          >
            Hours &amp; Blocks
          </Link>
          <Link
            href="/admin/services"
            className="font-sans text-xs uppercase tracking-[0.2em] hover:text-gold"
          >
            Services
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="font-sans text-xs uppercase tracking-[0.2em] text-cream/60 hover:text-cream"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
