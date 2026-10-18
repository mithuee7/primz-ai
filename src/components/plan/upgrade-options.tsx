"use client";

import { PlanBuyButton } from "@/components/landing/plan-buy";
import { PLANS, PLAN_RANK, type PlanInfo } from "@/lib/plans";

/** Shows only plans above the current one. Downgrades are never offered. */
export function UpgradeOptions({ currentCode }: { currentCode: string | null }) {
  const current = PLAN_RANK[currentCode as PlanInfo["code"]] ?? -1;
  const higher = PLANS.filter((p) => p.code !== "free" && PLAN_RANK[p.code] > current);
  if (higher.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h3 className="text-sm font-semibold">Upgrade your plan</h3>
      <p className="mt-0.5 text-sm text-zinc-500">Your current plan stays on until we confirm the upgrade. Plans can only go up here.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {higher.map((p) => (
          <div key={p.code} className="rounded-xl border border-zinc-200 p-4">
            <p className="text-sm font-semibold">{p.name}</p>
            <p className="text-xs text-zinc-500">₹{p.price.toLocaleString("en-IN")}/month · {p.chatsPerAccount} chats</p>
            <div className="mt-3">
              <PlanBuyButton code={p.code} name={p.name} price={p.price} signedIn={true} featured={p.featured} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
