"use client";

import { useState } from "react";
import { requestPlanAction } from "@/app/plan-actions";
import { CONTACT_INSTAGRAM } from "@/lib/contact";
import { useInstagramHandoff } from "./instagram-handoff";

/**
 * Buy flow. Signed out: go to login. Free: starts at once. Paid: record the request, then
 * hand off to our Instagram chat with a pre-written message.
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
  const handoff = useInstagramHandoff("We activate your plan within 48 hours.");

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
      window.location.href = "/dashboard";
      return;
    }
    setBusy(false);
    await handoff.begin(`Hi! I want the ${name} plan (₹${price.toLocaleString("en-IN")}/month). I'm signed in to Primz AI and I'd like help connecting my Instagram. I know it's beta.`);
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
      {handoff.overlay}
    </div>
  );
}
