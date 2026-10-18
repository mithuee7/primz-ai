"use client";

import { useState, useTransition } from "react";
import { adminReviewAction } from "./actions";

export interface FlaggedRow {
  ownerId: string;
  email: string;
  name: string | null;
  planCode: string;
  status: string;
  reason: string;
  flaggedAt: string | null;
  lastMinute: number;
  recent: Array<{ at: string; level: string; step: string; message: string }>;
}

const LEVEL_CLASS: Record<string, string> = {
  error: "text-red-600",
  warn: "text-amber-700",
  info: "text-sky-700",
  success: "text-emerald-700",
};

export function AdminReview({ rows }: { rows: FlaggedRow[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (ownerId: string, action: "clear" | "block") => {
    if (action === "block" && !window.confirm("Block this account? Its plan is turned off and AI replies stop.")) return;
    start(async () => {
      const res = await adminReviewAction(ownerId, action);
      setMsg(res.ok ? (action === "clear" ? "Review cleared." : "Account blocked.") : res.error ?? "Failed");
      if (res.ok) window.location.reload();
    });
  };

  return (
    <section className="mx-auto mb-8 max-w-5xl rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h2 className="text-base font-semibold">Accounts under review</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Flagged when an account sends or receives far more messages in one minute than a person can. Its AI replies are paused until you clear it.
      </p>
      {msg ? <p role="status" className="mt-3 text-sm text-zinc-700">{msg}</p> : null}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No accounts are under review.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((r) => (
            <div key={r.ownerId} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{r.email}{r.name ? ` · ${r.name}` : ""}</p>
                  <p className="text-xs text-zinc-500">Plan: {r.planCode} · status: {r.status} · flagged {r.flaggedAt ? new Date(r.flaggedAt).toLocaleString("en-IN") : "—"}</p>
                  <p className="mt-1 text-sm text-red-700">{r.reason}</p>
                  <p className="text-xs text-zinc-600">Messages in the last minute: {r.lastMinute}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={() => act(r.ownerId, "clear")} className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Clear review</button>
                  <button type="button" disabled={pending} onClick={() => act(r.ownerId, "block")} className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">Block</button>
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-zinc-700">Activity ({r.recent.length} latest lines)</summary>
                <div className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed">
                  {r.recent.length === 0 ? <p className="text-zinc-500">No activity recorded.</p> : r.recent.map((l, i) => (
                    <p key={i} className="text-zinc-300">
                      <span className="text-zinc-500">{new Date(l.at).toLocaleTimeString("en-IN")}</span>{" "}
                      <span className={LEVEL_CLASS[l.level] ?? "text-zinc-400"}>[{l.step}]</span> {l.message}
                    </p>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
