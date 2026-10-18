import Link from "next/link";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/clients";
import { DemoChat } from "@/components/landing/demo-chat";
import { PlanBuyButton } from "@/components/landing/plan-buy";
import { ContactMenu } from "@/components/landing/contact-menu";
import { ScrollLink } from "@/components/landing/scroll-link";
import { CONTACT_EMAIL, CONTACT_INSTAGRAM, CONTACT_INSTAGRAM_URL } from "@/lib/contact";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata = { title: "Primz AI · Turn Instagram leads into calls" };

const FEATURES = [
  { title: "Replies in seconds", body: "A lead's message gets a natural, on-brand reply the moment it arrives, day or night." },
  { title: "Qualifies while it talks", body: "It asks the right question, learns the lead's problem, and only pitches when there is a real fit." },
  { title: "Checked before it's sent", body: "A second AI reviews every reply. Anything unclear is held for you instead of going out." },
  { title: "You stay in control", body: "Take over any chat, edit a reply, and see every decision in a clear activity log." },
];

const STEPS = [
  { n: "01", title: "Connect Instagram", body: "Link your account and add the services you sell." },
  { n: "02", title: "Set the voice", body: "Choose the tone and the limits. The AI never goes beyond what you allow." },
  { n: "03", title: "Let it reply", body: "Leads get answered instantly. The hot ones land on your calendar." },
];

export default async function LandingPage() {
  const supabase = await createAuthClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#fafafa] text-zinc-900">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-[#fafafa]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="text-2xl font-bold tracking-[-0.03em] text-zinc-900">Primz <span className="bg-gradient-to-r from-blue-600 to-fuchsia-600 bg-clip-text text-transparent">AI</span></span>
          <nav className="flex items-center gap-7 text-[15px] font-medium">
            <ScrollLink target="features" className="hidden text-zinc-600 transition-colors hover:text-zinc-900 sm:inline">Features</ScrollLink>
            <ScrollLink target="plans" className="text-zinc-600 transition-colors hover:text-zinc-900">Pricing</ScrollLink>
            <ContactMenu />
            <Link href="/login" className="rounded-full bg-zinc-900 px-4 py-2 font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]">Sign up</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[520px] max-w-4xl rounded-full bg-gradient-to-br from-blue-200/50 via-fuchsia-200/40 to-amber-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-24">
          <div>
            <h1 className="animate-fade-up text-5xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
              Turn Instagram leads into <span className="bg-gradient-to-r from-blue-600 to-fuchsia-600 bg-clip-text text-transparent">booked calls</span>, in seconds.
            </h1>
            <p className="animate-fade-up delay-100 mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
              Most leads go cold waiting for a reply. Primz AI answers every DM the moment it lands, qualifies the lead, and pitches your service when it fits.
            </p>
            <div className="animate-fade-up delay-200 mt-10 flex flex-wrap items-center gap-3">
              <Link href="/login" className="rounded-full bg-zinc-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/25 transition-all hover:-translate-y-0.5 hover:bg-zinc-800 active:scale-[0.98]">
                Get started
              </Link>
              <ScrollLink target="plans" className="rounded-full border border-zinc-300 bg-white px-7 py-3.5 text-sm font-semibold text-zinc-900 transition-all hover:-translate-y-0.5 hover:border-zinc-400">
                View pricing
              </ScrollLink>
            </div>
          </div>
          <div className="animate-fade-up delay-300 animate-float">
            <DemoChat />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
        <p className="text-sm font-semibold text-blue-600">Why it works</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-[-0.03em]">Every lead gets an answer. Your time goes to the calls.</h2>
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="lift rounded-3xl border border-zinc-200/80 bg-white p-8">
              <h3 className="text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-3 leading-relaxed text-zinc-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-zinc-950 py-24 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-sm font-semibold text-amber-300">How it works</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Up and running in an afternoon.</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="text-sm font-semibold text-zinc-500">{s.n}</span>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-zinc-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
        <p className="text-sm font-semibold text-blue-600">Pricing</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Simple plans. Cancel anytime.</h2>
        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.code} className={`lift flex flex-col rounded-3xl border bg-white p-7 ${p.featured ? "border-zinc-900 ring-1 ring-zinc-900" : "border-zinc-200/80"}`}>
              {p.featured ? <span className="mb-4 w-fit rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">Most popular</span> : null}
              <h3 className="text-3xl font-semibold tracking-[-0.02em]">{p.name}</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">₹{p.price.toLocaleString("en-IN")}</span>
                <span className="text-sm text-zinc-500">/ month</span>
              </p>
              <ul className="mt-7 flex-1 space-y-3 text-sm text-zinc-700">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2"><span className="text-blue-600">•</span>{h}</li>
                ))}
                <li className="flex gap-2"><span className="text-blue-600">•</span>{p.keys}</li>
              </ul>
              <div className="mt-8">
                <PlanBuyButton name={p.name} featured={p.featured} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-10 text-sm">
          <div>
            <p className="font-semibold">Primz AI</p>
            <p className="mt-1 text-zinc-500">Built to turn conversations into calls.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className="rounded-full border border-zinc-300 px-5 py-2.5 font-semibold transition-all hover:-translate-y-0.5 hover:border-zinc-400">Email us</a>
            <a href={CONTACT_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="rounded-full border border-zinc-300 px-5 py-2.5 font-semibold transition-all hover:-translate-y-0.5 hover:border-zinc-400">@{CONTACT_INSTAGRAM}</a>
            <Link href="/privacy" className="px-2 text-zinc-500 hover:text-zinc-900">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
