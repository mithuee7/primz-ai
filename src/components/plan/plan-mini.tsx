import Link from "next/link";
import type { PlanState } from "@/lib/plan-state";

/** Compact plan block for the sidebar. Shows the plan, status and chat usage. */
export function PlanMini({ plan, activeChats }: { plan: PlanState; activeChats: number }) {
  const limit = plan.chatsPerAccount;
  const used = Math.min(activeChats, limit);
  const ratio = plan.active && limit > 0 ? used / limit : 0;
  const reached = plan.active && limit > 0 && activeChats >= limit;
  const dot = plan.active ? (reached ? "bg-red-400" : "bg-emerald-400") : plan.status === "pending" ? "bg-amber-400" : "bg-zinc-500";
  const status = plan.active ? "Active" : plan.status === "pending" ? "Waiting for activation" : plan.status === "expired" ? "Expired" : "No plan";

  return (
    <div className="rounded-xl bg-white/5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-100">{plan.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {status}
        </span>
      </div>
      {plan.active && limit > 0 ? (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="meter" aria-label="Chats active on your plan" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
            <div className={`h-full rounded-full ${reached ? "bg-red-400" : "bg-white"}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-400">
            {used} of {limit} chats active{reached ? " · limit reached" : ""}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-zinc-400">{plan.status === "pending" ? "We activate within 48 hours." : "Choose a plan to start."}</p>
      )}
      {!plan.active || reached ? (
        <Link href="/#pricing" className="mt-2 inline-block text-[11px] font-semibold text-white underline-offset-2 hover:underline">
          {plan.active ? "Upgrade" : "View plans"}
        </Link>
      ) : null}
    </div>
  );
}
