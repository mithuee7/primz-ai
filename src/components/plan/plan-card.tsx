import { Badge, Card } from "@/components/ui/primitives";
import type { PlanState } from "@/lib/plan-state";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Shows the plan on the account, how many chats are using it, and what to do next.
 * `activeChats` counts conversations with auto reply on. Chats past the limit keep their history but get no AI replies.
 */
export function PlanCard({ plan, activeChats }: { plan: PlanState; activeChats: number }) {
  const limit = plan.chatsPerAccount;
  const used = Math.min(activeChats, limit);
  const over = Math.max(activeChats - limit, 0);
  const ratio = plan.active && limit > 0 ? used / limit : 0;
  const nearing = plan.active && ratio >= 0.8 && ratio < 1;
  const reached = plan.active && limit > 0 && activeChats >= limit;

  const status = plan.active
    ? { label: "Active", tone: "green" as const }
    : plan.status === "pending"
      ? { label: "Waiting for activation", tone: "amber" as const }
      : plan.status === "expired"
        ? { label: "Expired", tone: "red" as const }
        : { label: "No plan", tone: "neutral" as const };

  let detail: string;
  if (plan.active && plan.expiresAt) {
    const left = daysUntil(plan.expiresAt);
    detail = `Valid until ${formatDate(plan.expiresAt)}${left > 0 ? ` · ${left} days left` : ""}`;
  } else if (plan.status === "pending" && plan.requestedAt) {
    detail = `Requested ${formatDate(plan.requestedAt)}. We activate it within 48 hours of your request.`;
  } else if (plan.status === "expired") {
    detail = "Your plan has ended. AI replies are paused until you renew.";
  } else {
    detail = "Choose a plan to start AI replies on your chats.";
  }

  const barTone = reached ? "bg-red-500" : nearing ? "bg-amber-500" : "bg-zinc-900";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Your plan</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{plan.name}</h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">{detail}</p>
        </div>
        {!plan.active || reached || nearing ? (
          <a href="/#plans" className="rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-zinc-800 active:scale-[0.97]">
            {plan.active ? "Upgrade plan" : "View plans"}
          </a>
        ) : null}
      </div>

      {plan.active && limit > 0 ? (
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-zinc-900">
              {used} of {limit} chats
              <span className="font-normal text-zinc-500"> active</span>
            </span>
            <span className={`text-xs ${reached ? "font-medium text-red-600" : nearing ? "font-medium text-amber-700" : "text-zinc-500"}`}>
              {reached ? "Limit reached" : nearing ? "Close to your limit" : `${limit - used} left`}
            </span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100"
            role="meter"
            aria-label="Chats active on your plan"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={used}
          >
            <div className={`h-full rounded-full transition-all ${barTone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          {over > 0 ? (
            <p className="mt-2 text-xs text-red-600">
              {over} {over === 1 ? "chat is" : "chats are"} paused because they are over your limit. Their history is kept. Turn auto chat off on chats you don&apos;t need, or upgrade.
            </p>
          ) : reached ? (
            <p className="mt-2 text-xs text-zinc-500">New chats past {limit} won&apos;t get AI replies. Upgrade to add more.</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
