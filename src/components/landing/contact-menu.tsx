"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT_EMAIL, CONTACT_INSTAGRAM, CONTACT_INSTAGRAM_URL } from "@/lib/contact";

/** Opens a small panel with the email (copyable) and Instagram. No navigation, no hash. */
export function ContactMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked; the address is still visible
    }
  };

  return (
    <div ref={root} className={`relative ${className ?? ""}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-zinc-600 transition-colors hover:text-zinc-900">
        Contact
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-3 w-72 animate-fade-up rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-900/10">
          <p className="text-sm font-semibold text-zinc-900">Get in touch</p>
          <p className="mt-1 text-xs text-zinc-500">We reply within a day.</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2.5">
              <a href={`mailto:${CONTACT_EMAIL}`} className="truncate text-sm font-medium text-zinc-900 hover:underline">{CONTACT_EMAIL}</a>
              <button type="button" onClick={copy} className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <a href={CONTACT_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="block rounded-xl bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100">
              Instagram @{CONTACT_INSTAGRAM}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
