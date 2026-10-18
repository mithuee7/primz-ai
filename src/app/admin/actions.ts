"use server";

import { cookies } from "next/headers";
import { PLANS } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/clients";
import { ADMIN_COOKIE, adminCookieValue, isAdmin, passwordMatches } from "./auth";

export async function adminLoginAction(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.ADMIN_PASSWORD) return { ok: false, error: "Admin is not configured." };
  if (!passwordMatches(password)) return { ok: false, error: "Wrong password." };
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminCookieValue(), { httpOnly: true, secure: true, sameSite: "strict", path: "/admin", maxAge: 60 * 60 * 12 });
  return { ok: true };
}

export async function adminLogoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete({ name: ADMIN_COOKIE, path: "/admin" });
}

/** Clears or blocks an account that the abuse check flagged. */
export async function adminReviewAction(ownerId: string, action: "clear" | "block"): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in to admin." };
  const db = createAdminClient();
  const now = new Date().toISOString();
  const update =
    action === "clear"
      ? { review_status: "ok", review_reason: null, flagged_at: null, updated_at: now }
      : { review_status: "blocked", status: "inactive", updated_at: now };
  const { error } = await db.from("user_plans").update(update).eq("owner_id", ownerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Confirms or changes a user's plan. Buyers are told activation takes up to 48 hours. */
export async function adminSetPlanAction(
  ownerId: string,
  code: string,
  action: "activate" | "deactivate",
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in to admin." };
  if (!PLANS.some((p) => p.code === code)) return { ok: false, error: "Unknown plan." };
  const db = createAdminClient();

  if (action === "deactivate") {
    const { error } = await db.from("user_plans").update({ status: "inactive", updated_at: new Date().toISOString() }).eq("owner_id", ownerId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error } = await db
    .from("user_plans")
    .update({ plan_code: code, status: "active", activated_at: now.toISOString(), expires_at: expires.toISOString(), updated_at: now.toISOString() })
    .eq("owner_id", ownerId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
