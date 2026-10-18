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
  requestedAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  reviewStatus: "ok" | "review" | "blocked";
  reviewReason: string | null;
}

/** Platform keys the owner provides for the Basic plan. Set as secrets: BASIC_GROQ_KEYS, BASIC_APIFY_KEYS (comma separated). */
export function basicGroqKeys(): string[] {
  return (process.env.BASIC_GROQ_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
}

export function basicApifyKeys(): string[] {
  return (process.env.BASIC_APIFY_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
}

/** The user's current plan. Anything not active (or past expiry) counts as no plan. */
export async function getPlanState(ownerId: string): Promise<PlanState> {
  const db = createAdminClient();
  const { data } = await db
    .from("user_plans")
    .select("plan_code, status, requested_at, activated_at, expires_at, review_status, review_reason")
    .eq("owner_id", ownerId)
    .maybeSingle();
  const row = data as {
    plan_code: string;
    status: PlanState["status"];
    requested_at: string | null;
    activated_at: string | null;
    expires_at: string | null;
    review_status: PlanState["reviewStatus"];
    review_reason: string | null;
  } | null;
  const code = row?.plan_code ?? "free";
  const notExpired = !row?.expires_at || new Date(row.expires_at).getTime() > Date.now();
  // An active plan past its end date shows as expired.
  const status: PlanState["status"] = row?.status === "active" && !notExpired ? "expired" : row?.status ?? "inactive";
  const plan = PLANS.find((p) => p.code === code);
  return {
    code,
    status,
    active: status === "active" && notExpired && Boolean(plan),
    chatsPerAccount: plan?.chatsPerAccount ?? 0,
    name: plan?.name ?? "No plan",
    requestedAt: row?.requested_at ?? null,
    activatedAt: row?.activated_at ?? null,
    expiresAt: row?.expires_at ?? null,
    reviewStatus: row?.review_status ?? "ok",
    reviewReason: row?.review_reason ?? null,
  };
}

/** Free and Basic use the platform keys. Paid plans other than Basic use their own. */
export function isPlatformKeyPlan(plan: PlanState): boolean {
  return plan.active && (plan.code === "basic" || plan.code === "free");
}

/**
 * Checks the plan before the AI replies. Returns a reason when the reply must not run.
 * Chats beyond the plan limit (oldest first) keep their history but get no AI replies.
 */
export function chatLimitReason(plan: PlanState, rank: number): string | null {
  if (plan.reviewStatus !== "ok") return "Your account is under review. AI replies are paused while we check it.";
  if (!plan.active) return "No active plan. Choose a plan on the landing page.";
  if (rank >= plan.chatsPerAccount) return `Your ${plan.name} plan allows ${plan.chatsPerAccount} chats. This chat is over the limit.`;
  return null;
}
