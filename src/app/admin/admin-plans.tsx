"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import { adminLogoutAction, adminSetPlanAction } from "./actions";

export interface AdminRow {
  ownerId: string;
  email: string;
  name: string | null;
  planCode: string;
  status: "inactive" | "pending" | "active" | "expired";
  requestedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  eligibleAt: string | null;
}

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "-";

function Row({ row }: { row: AdminRow }) {
  const router = useRouter();
  const [plan, setPlan] = useState(row.planCode === "free" ? PLANS[0]!.code : row.planCode);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const eligible = !row.eligibleAt || new Date(row.eligibleAt).getTime() <= Date.now();

  const run = (action: "activate" | "deactivate") =>
    start(async () => {
      const res = await adminSetPlanAction(row.ownerId, plan, action);
      if (!res.ok) setError(res.error ?? "Failed");
      else setError(null);
      router.refresh();
    });

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="py-4 pr-4">
        <p className="font-semibold text-zinc-900">{row.name ?? "No name"}</p>
        <p className="text-xs text-zinc-500">{row.email}</p>
      </td>
      <td className="py-4 pr-4">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold capitalize">{row.status}</span>
      </td>
      <td className="py-4 pr-4 text-xs text-zinc-600">
        <p>Requested: {fmt(row.requestedAt)}</p>
        <p>Eligible: {row.eligibleAt ? (eligible ? <span className="font-semibold text-emerald-700">now</span> : fmt(row.eligibleAt)) : "-"}</p>
        <p>Expires: {fmt(row.expiresAt)}</p>
      </td>
      <td className="py-4">
        <div className="flex flex-wrap items-center gap-2">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="field !w-auto !py-1.5 text-xs">
            {PLANS.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
          <button type="button" disabled={pending || !eligible} onClick={() => run("activate")} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-zinc-800 disabled:opacity-40">
            {pending ? "…" : "Activate"}
          </button>
          <button type="button" disabled={pending} onClick={() => run("deactivate")} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">
            Deactivate
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </td>
    </tr>
  );
}

export function AdminPlans({ rows }: { rows: AdminRow[] }) {
  const router = useRouter();
  return (
    <main className="min-h-dvh bg-[#fafafa] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">Plans</p>
            <p className="text-sm text-zinc-500">Requests become active only after the 48-hour wait.</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await adminLogoutAction();
              router.refresh();
            }}
            className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </div>
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No users yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="pb-3 pr-4 font-semibold">User</th>
                  <th className="pb-3 pr-4 font-semibold">Status</th>
                  <th className="pb-3 pr-4 font-semibold">Dates</th>
                  <th className="pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Row key={r.ownerId} row={r} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
