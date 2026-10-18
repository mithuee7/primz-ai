"use client";

import { UpgradeOptions } from "./upgrade-options";
import type { PlanState } from "@/lib/plan-state";

/** Replaces the app pages once a plan has ended. Renewing or upgrading turns the app back on after approval. */
export function ExpiredPanel({ plan }: { plan: PlanState }) {
  const endedOn = plan.expiresAt ? new Date(plan.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null;
  const isTrial = plan.code === "free";
  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <h1 className="text-xl font-semibold tracking-tight">{isTrial ? "Your free trial has ended" : `Your ${plan.name} plan has ended`}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {endedOn ? `It ended on ${endedOn}. ` : ""}AI replies are off and the app is locked until you renew. Pick a plan below and pay. We reactivate it after we confirm your payment.
          </p>
        </div>
        <UpgradeOptions currentCode={plan.code} includeCurrent />
      </div>
    </div>
  );
}
