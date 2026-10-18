"use server";

import { requireUserForAction } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
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
    .select("plan_code, status, review_status")
    .eq("owner_id", user.id)
    .maybeSingle();
  const row = current as { plan_code: string; status: string; review_status: string } | null;

  if (row && row.review_status !== "ok") return { ok: false, error: "Your account is under review. Plans can't be changed right now." };

  const now = new Date().toISOString();
  if (code === "free") {
    if (row?.status === "active" && row.plan_code !== "free") return { ok: false, error: "You already have a paid plan." };
    const { error } = await db.from("user_plans").upsert(
      { owner_id: user.id, plan_code: "free", status: "active", requested_at: now, activated_at: now, expires_at: null, updated_at: now },
      { onConflict: "owner_id" },
    );
    return error ? { ok: false, error: "Couldn't start the free plan. Try again." } : { ok: true };
  }

  const { error } = await db
    .from("user_plans")
    .upsert({ owner_id: user.id, plan_code: code, status: "pending", requested_at: now, updated_at: now }, { onConflict: "owner_id" });
  if (error) return { ok: false, error: "Couldn't record your request. Try again." };
  return { ok: true };
}
