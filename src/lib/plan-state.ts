import "server-only";
import { createAdminClient } from "@/lib/supabase/clients";
import { PLANS } from "@/lib/plans";

export const ACTIVATION_WAIT_MS = 48 * 60 * 60 * 1000;

export interface PlanState {
  code: string;
  status: "inactive" | "pending" | "active" | "expired";
  active: boolean;
  chatsPerAccount: number;
  name: string;
}

/** The user's current plan. Anything not active (or past expiry) counts as no plan. */
export async function getPlanState(ownerId: string): Promise<PlanState> {
  const db = createAdminClient();
  const { data } = await db
    .from("user_plans")
    .select("plan_code, status, expires_at")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const row = data as { plan_code: string; status: PlanState["status"]; expires_at: string | null } | null;
  const code = row?.plan_code ?? "free";
  const status = row?.status ?? "inactive";
  const notExpired = !row?.expires_at || new Date(row.expires_at).getTime() > Date.now();
  const plan = PLANS.find((p) => p.code === code);
  return {
    code,
    status,
    active: status === "active" && notExpired && Boolean(plan),
    chatsPerAccount: plan?.chatsPerAccount ?? 0,
    name: plan?.name ?? "No plan",
  };
}

/**
 * Checks the plan before the AI replies. Returns a reason when the reply must not run.
 * Chats beyond the plan limit (oldest first) keep their history but get no AI replies.
 */
export function chatLimitReason(plan: PlanState, rank: number): string | null {
  if (!plan.active) return "No active plan. Choose a plan on the landing page.";
  if (rank >= plan.chatsPerAccount) return `Your ${plan.name} plan allows ${plan.chatsPerAccount} chats. This chat is over the limit.`;
  return null;
}
