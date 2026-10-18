"use client";

import { useEffect, useState } from "react";
import { requestPlanAction } from "@/app/plan-actions";
import { CONTACT_INSTAGRAM, CONTACT_INSTAGRAM_URL } from "@/lib/contact";

const COUNTDOWN_SECONDS = 5;

/**
 * Buy flow. Signed out: go to login. Signed in: record the request, copy a pre-written message,
 * show a countdown, then open our Instagram chat. The countdown can be cancelled.
 */
export function PlanBuyButton({
  code,
  featured,
  name,
  price,
  signedIn,
}: {
  code: string;
  featured?: boolean;
  name: string;
  price: number;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<{ copied: boolean; message: string; left: number } | null>(null);

  useEffect(() => {
    if (!step) return;
    if (step.left <= 0) {
      window.open(CONTACT_INSTAGRAM_URL, "_blank", "noopener,noreferrer");
      setStep(null);
      return;
    }
    const t = setTimeout(() => setStep((s) => (s ? { ...s, left: s.left - 1 } : s)), 1000);
    return () => clearTimeout(t);
  }, [step]);

  const onBuy = async () => {
    if (!signedIn) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    setError(null);
    const res = await requestPlanAction(code);
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    if (code === "free") {
      // Free starts at once. No Instagram message needed.
      window.location.href = "/dashboard";
      return;
    }
    setBusy(false);
    const message = `Hi! I want the ${name} plan (₹${price.toLocaleString("en-IN")}/month). I'm signed in to Primz AI and I'd like help connecting my Instagram. I know it's beta.`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
    } catch {
      // clipboard blocked; the message is shown in the overlay instead
    }
    setStep({ copied, message, left: COUNTDOWN_SECONDS });
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBuy}
        disabled={busy}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 ${
          featured ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/25 hover:bg-zinc-800" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        }`}
      >
        {busy ? "Saving…" : `Buy ${name}`}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      <span className="sr-only">Instagram {CONTACT_INSTAGRAM}</span>

      {step ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-md animate-fade-in sm:p-6">
          <div className="relative w-full max-w-xl animate-fade-up overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-fuchsia-600 px-8 pb-10 pt-8 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-2xl font-bold ring-1 ring-white/30">
                  {step.copied ? "✓" : "!"}
                </div>
                <div>
                  <p className="text-sm font-medium text-white/80">Step 2 of 2</p>
                  <h3 className="text-3xl font-bold tracking-[-0.02em]">{step.copied ? "Message copied" : "Copy this message"}</h3>
                </div>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-white/90">
                Paste it into the Instagram chat and send. We activate your plan within 48 hours.
              </p>
            </div>
            <div className="-mt-5 px-8 pb-8">
              <div className="rounded-3xl bg-white p-5 ring-1 ring-zinc-200 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your message</p>
                <div className="mt-3 rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3 text-[15px] leading-relaxed text-white">
                  {step.message}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-zinc-900">
                  Opening Instagram in <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-600 px-2 text-white">{step.left}</span>
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setStep(null)} className="rounded-2xl border border-zinc-300 px-5 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    window.open(CONTACT_INSTAGRAM_URL, "_blank", "noopener,noreferrer");
                    setStep(null);
                  }}
                  className="rounded-2xl bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-900/25 transition-all hover:bg-zinc-800 active:scale-[0.98]"
                >
                  Open Instagram now
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
