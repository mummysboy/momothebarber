import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <form action={login} className="deco-frame w-full max-w-sm bg-cream px-8 py-10">
        <h1 className="text-center font-display text-2xl font-bold">Momo The Barber</h1>
        <p className="mt-1 text-center font-sans text-xs uppercase tracking-[0.25em] text-ink-soft">
          Shop dashboard
        </p>
        {error && (
          <p className="mt-6 border border-brand-red bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
            Wrong email or password.
          </p>
        )}
        <label className="mt-8 block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="mt-2 w-full border border-ink bg-cream px-4 py-3 outline-none focus:border-brand-red"
          />
        </label>
        <label className="mt-4 block">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-ink-soft">
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full border border-ink bg-cream px-4 py-3 outline-none focus:border-brand-red"
          />
        </label>
        <button
          type="submit"
          className="mt-8 w-full bg-brand-red px-8 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-cream hover:bg-brand-red-dark"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
