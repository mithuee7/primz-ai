import Link from "next/link";
import { DemoChat } from "@/components/landing/demo-chat";
import { PLANS, SETUP_SERVICES } from "@/lib/plans";

export const metadata = { title: "Primz AI · Instagram DM assistant" };

const FEATURES = [
  { title: "Replies in seconds", body: "Every new DM gets a fast, natural reply, including at night and on weekends." },
  { title: "Knows when to pitch", body: "Warm conversations get your service pitched at the right moment, with a soft next step." },
  { title: "Safety checks", body: "A second AI reviews each reply before it's sent. Anything unclear is held for you." },
  { title: "You stay in control", body: "Take over any chat, edit replies, and see every decision in the logs." },
];

const STEPS = [
  "Connect your Instagram account and add your services.",
  "Choose how the AI should sound and what it may say.",
  "Turn on auto-replies. Leads get answered, and hot ones are flagged for a call.",
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-white text-zinc-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <span className="text-base font-semibold tracking-tight">Primz AI</span>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#plans" className="text-zinc-600 hover:text-zinc-900">Plans</a>
          <a href="#demo" className="text-zinc-600 hover:text-zinc-900">Demo</a>
          <Link href="/login" className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white">Sign in</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 lg:grid-cols-2 lg:items-center lg:pt-14">
        <div>
          <p className="text-sm font-medium text-blue-600">Instagram DM automation</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Never leave a lead on read again.
          </h1>
          <p className="mt-5 text-lg text-zinc-600">
            Primz AI answers your Instagram DMs in your own voice, qualifies leads, and pitches your service when the moment is right. You get the calls, not the inbox.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white">Get started</Link>
            <a href="#plans" className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium">See plans</a>
          </div>
        </div>
        <div id="demo">
          <DemoChat />
        </div>
      </section>

      <section className="bg-zinc-50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold tracking-tight">What it does</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-2xl bg-zinc-50 p-5">
              <span className="text-sm font-semibold text-blue-600">Step {i + 1}</span>
              <p className="mt-2 text-sm text-zinc-700">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="plans" className="bg-zinc-50 py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-2xl font-semibold tracking-tight">Plans</h2>
          <p className="mt-2 text-sm text-zinc-600">Every plan includes all features. Pricing for Basic to Business is shown on request for now.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((p) => (
              <div key={p.code} className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-2 text-2xl font-semibold">{p.price ?? "On request"}</p>
                <ul className="mt-5 flex-1 space-y-2 text-sm text-zinc-700">
                  {p.highlights.map((h) => (
                    <li key={h}>• {h}</li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-zinc-100 pt-4 text-xs text-zinc-500">{p.keys}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-14 text-lg font-semibold">Done-for-you setup</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {SETUP_SERVICES.map((s) => (
              <div key={s.name} className="rounded-2xl bg-white p-6 ring-1 ring-zinc-200">
                <p className="font-semibold">{s.name}</p>
                <p className="mt-1 text-2xl font-semibold">{s.price}</p>
                <p className="mt-2 text-sm text-zinc-600">{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-10 text-sm text-zinc-500">
        <span>Primz AI</span>
        <Link href="/login" className="hover:text-zinc-900">Sign in</Link>
      </footer>
    </main>
  );
}
