"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CONTACT_INSTAGRAM_URL } from "@/lib/contact";

const COUNTDOWN_SECONDS = 5;

interface Step {
  copied: boolean;
  message: string;
  left: number;
}

/**
 * Copies a pre-written message, shows a countdown dialog, then opens our Instagram chat.
 * The dialog renders on document.body so card transforms can't clip it. The redirect is
 * same-tab (browsers block window.open after a timer). "Open Instagram now" is a plain link.
 */
export function useInstagramHandoff(note: string) {
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    if (!step) return;
    if (step.left <= 0) {
      window.location.href = CONTACT_INSTAGRAM_URL;
      return;
    }
    const t = setTimeout(() => setStep((s) => (s ? { ...s, left: s.left - 1 } : s)), 1000);
    return () => clearTimeout(t);
  }, [step]);

  const begin = async (message: string) => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
    } catch {
      // clipboard blocked: the message is shown in the dialog
    }
    setStep({ copied, message, left: COUNTDOWN_SECONDS });
  };

  const overlay =
    step && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-md animate-fade-in sm:p-6">
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
                <p className="mt-4 text-[15px] leading-relaxed text-white/90">Paste it into the Instagram chat and send. {note}</p>
              </div>
              <div className="-mt-5 px-8 pb-8">
                <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your message</p>
                  <div className="mt-3 rounded-2xl rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3 text-[15px] leading-relaxed text-white">
                    {step.message}
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold text-zinc-900">
                    Opening Instagram in <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-blue-600 px-2 text-white">{step.left}</span>
                  </p>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setStep(null)} className="rounded-2xl border border-zinc-300 px-5 py-3.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98]">
                    Cancel
                  </button>
                  <a
                    href={CONTACT_INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setStep(null)}
                    className="rounded-2xl bg-zinc-900 px-5 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-zinc-900/25 transition-all hover:bg-zinc-800 active:scale-[0.98]"
                  >
                    Open Instagram now
                  </a>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return { begin, overlay };
}
