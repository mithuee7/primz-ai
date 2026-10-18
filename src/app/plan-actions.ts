"use server";

import { requireUserForAction } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/clients";

/** Records a plan request. It stays pending until you confirm it in /admin, after the 48-hour wait. */
export async function requestPlanAction(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUserForAction();
  if (!PLANS.some((p) => p.code === code)) return { ok: false, error: "Unknown plan." };
  const { error } = await createAdminClient()
    .from("user_plans")
    .upsert(
      { owner_id: user.id, plan_code: code, status: "pending", requested_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: "owner_id" },
    );
  if (error) return { ok: false, error: "Couldn't record your request. Try again." };
  return { ok: true };
}
