"use client";

import { useState, useTransition } from "react";
import { adminSetPlanAction } from "./actions";

export interface RenewalRow {
  ownerId: string;
  email: string;
  name: string | null;
  planCode: string;
  endedAt: string;
}

/** Plans whose end date has passed. The account is locked until you reactivate it after payment. */
export function AdminRenewals({ rows }: { rows: RenewalRow[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (r: RenewalRow, action: "activate" | "deactivate") => {
    if (action === "deactivate" && !window.confirm(`Deactivate ${r.email}? Their app stays locked.`)) return;
    start(async () => {
      const res = await adminSetPlanAction(r.ownerId, r.planCode, action);
      setMsg(res.ok ? (action === "activate" ? `Reactivated ${r.email} for 30 days.` : `Deactivated ${r.email}.`) : res.error ?? "Failed");
      if (res.ok) window.location.reload();
    });
  };

  return (
    <section className="mx-auto mb-8 max-w-5xl rounded-2xl bg-amber-50 p-5 shadow-sm ring-1 ring-amber-300">
      <h2 className="text-base font-semibold text-amber-900">Renewals due ({rows.length})</h2>
      <p className="mt-1 text-sm text-amber-900/80">
        These plans have reached their end date. Their app is locked and AI replies are off. Reactivate after you receive payment.
      </p>
      {msg ? <p role="status" className="mt-3 text-sm text-zinc-800">{msg}</p> : null}
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-amber-900/70">Nothing due right now.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.ownerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-amber-200">
              <div>
                <p className="text-sm font-semibold">{r.email}{r.name ? ` · ${r.name}` : ""}</p>
                <p className="text-xs text-zinc-600">
                  {r.planCode === "free" ? "Free trial" : r.planCode} ended {new Date(r.endedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={pending} onClick={() => act(r, "activate")} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Paid, reactivate</button>
                <button type="button" disabled={pending} onClick={() => act(r, "deactivate")} className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50">Deactivate</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
