"use server";

import { requireUserForAction } from "@/lib/auth";
import { FREE_TRIAL_DAYS, PLANS, PLAN_RANK } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/clients";

/**
 * Records a plan request. The free plan starts at once. Paid plans stay pending until you
 * confirm them in /admin, after the 48-hour wait.
 */
export async function requestPlanAction(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUserForAction();
  if (!PLANS.some((p) => p.code === code)) return { ok: false, error: "Unknown plan." };
  const db = createAdminClient();
  const { data: current } = await db
    .from("user_plans")
    .select("plan_code, status, review_status, free_trial_used, expires_at")
    .eq("owner_id", user.id)
    .maybeSingle();
  const raw = current as { plan_code: string; status: string; review_status: string; free_trial_used: boolean; expires_at: string | null } | null;
  // A plan past its end date counts as ended, so it can renew instead of being compared as active.
  const ended = raw?.expires_at ? new Date(raw.expires_at).getTime() <= Date.now() : false;
  const row = raw && !(raw.status === "active" && ended) ? raw : raw ? { ...raw, status: "expired" } : null;

  if (row && row.review_status !== "ok") return { ok: false, error: "Your account is under review. Plans can't be changed right now." };

  const now = new Date().toISOString();
  if (code === "free") {
    if (row?.status === "active" && row.plan_code !== "free") return { ok: false, error: "You already have a paid plan." };
    // The free trial runs once per account. It ends after FREE_TRIAL_DAYS.
    if (row?.free_trial_used) return { ok: false, error: "The free trial can only be used once." };
    const expires = new Date(Date.now() + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await db.from("user_plans").upsert(
      { owner_id: user.id, plan_code: "free", status: "active", requested_at: now, activated_at: now, expires_at: expires, free_trial_used: true, updated_at: now },
      { onConflict: "owner_id" },
    );
    return error ? { ok: false, error: "Couldn't start the free plan. Try again." } : { ok: true };
  }

  // A paid plan waits for approval. The current plan (free trial or paid) keeps running until then.
  // Only upgrades are accepted: never a lower plan or the same plan again.
  // An ended plan (expired) can renew: the same plan is allowed again, so only active rows are compared.
  if (row?.status === "active") {
    const currentRank = PLAN_RANK[row.plan_code as keyof typeof PLAN_RANK] ?? 0;
    const targetRank = PLAN_RANK[code as keyof typeof PLAN_RANK];
    if (targetRank === currentRank) return { ok: false, error: `You already have the ${PLANS.find((p) => p.code === code)?.name} plan.` };
    if (targetRank < currentRank) return { ok: false, error: "You can't switch to a lower plan here. Contact us to change plans." };
    const { error } = await db
      .from("user_plans")
      .update({ requested_plan_code: code, requested_at: now, updated_at: now })
      .eq("owner_id", user.id);
    if (error) return { ok: false, error: "Couldn't record your request. Try again." };
    return { ok: true };
  }

  const { error } = await db
    .from("user_plans")
    .upsert({ owner_id: user.id, plan_code: code, status: "pending", requested_at: now, updated_at: now }, { onConflict: "owner_id" });
  if (error) return { ok: false, error: "Couldn't record your request. Try again." };
  return { ok: true };
}
