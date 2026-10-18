"use client";

import { useState } from "react";
import { CONTACT_INSTAGRAM, CONTACT_INSTAGRAM_URL } from "@/lib/contact";

/**
 * Buy flow. Signed out: go to login (no extra steps). Signed in: copy a pre-written message for the
 * chosen plan and open our Instagram inbox, so the user just pastes and sends.
 */
export function PlanBuyButton({ featured, name, price, signedIn }: { featured?: boolean; name: string; price: number; signedIn: boolean }) {
  const [note, setNote] = useState<string | null>(null);

  const onBuy = async () => {
    if (!signedIn) {
      window.location.href = "/login";
      return;
    }
    const message = `Hi! I want the ${name} plan (₹${price.toLocaleString("en-IN")}/month). I'm signed in to Primz AI and I'd like help connecting my Instagram. I know it's beta.`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(message);
      copied = true;
    } catch {
      // clipboard blocked: the message is shown below so it can be copied by hand
    }
    window.open(CONTACT_INSTAGRAM_URL, "_blank", "noopener,noreferrer");
    setNote(copied ? "Message copied. Paste it into the Instagram chat that just opened and send." : `Send this in Instagram: "${message}"`);
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBuy}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
          featured ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/25 hover:bg-zinc-800" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        }`}
      >
        Buy {name}
      </button>
      {note ? <p className="mt-3 animate-fade-in text-xs leading-relaxed text-zinc-500">{note}</p> : null}
      <span className="sr-only">Instagram {CONTACT_INSTAGRAM}</span>
    </div>
  );
}
