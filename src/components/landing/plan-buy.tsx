"use client";

import { useState } from "react";
import { CONTACT_EMAIL } from "@/lib/contact";

/** Stays on the page. Payments aren't open yet, so the button explains that and offers contact. */
export function PlanBuyButton({ featured, name }: { featured?: boolean; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
          featured ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/25 hover:bg-zinc-800" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        }`}
      >
        Buy {name}
      </button>
      {open ? (
        <p className="mt-3 animate-fade-in text-xs leading-relaxed text-zinc-500">
          Payments open soon. Email <a className="font-medium text-zinc-900 underline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(name + " plan")}`}>{CONTACT_EMAIL}</a> and we&apos;ll set you up today.
        </p>
      ) : null}
    </div>
  );
}
