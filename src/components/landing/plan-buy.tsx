"use client";

import { useEffect, useState } from "react";
import { requestPlanAction } from "@/app/plan-actions";
import { CONTACT_INSTAGRAM, CONTACT_INSTAGRAM_URL } from "@/lib/contact";

const COUNTDOWN_SECONDS = 3;

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
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 px-5 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md animate-fade-up rounded-[28px] bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-fuchsia-600 text-2xl text-white shadow-lg shadow-fuchsia-600/30">
              {step.copied ? "✓" : "!"}
            </div>
            <h3 className="mt-5 text-2xl font-bold tracking-tight">{step.copied ? "Message copied" : "Copy this message"}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
              Paste it into the Instagram chat and send. We&apos;ll take it from there.
            </p>
            <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-left text-sm leading-relaxed text-zinc-800 ring-1 ring-zinc-200">
              {step.message}
            </div>
            <p className="mt-6 text-sm font-semibold text-zinc-900">
              Opening Instagram in <span className="inline-block min-w-[1ch] text-blue-600">{step.left}</span>…
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setStep(null)} className="flex-1 rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(CONTACT_INSTAGRAM_URL, "_blank", "noopener,noreferrer");
                  setStep(null);
                }}
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Open now
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
