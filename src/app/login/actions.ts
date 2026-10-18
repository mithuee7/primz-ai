"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { checkSignupEmail } from "@/lib/email-policy";
import { createAdminClient } from "@/lib/supabase/clients";
import { rateLimit } from "@/lib/rate-limit";
import { createAuthClient } from "@/lib/supabase/clients";

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export interface LoginState {
  error?: string;
  notice?: string;
}

const CONFIRM_NOTICE = (email: string) => {
  const isGmail = /@(gmail\.com|googlemail\.com)$/i.test(email);
  return `Check your ${isGmail ? "Gmail" : "email"} for a link. Open the link, then log in again to continue.`;
};

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (isDemoMode()) redirect("/dashboard");
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (!rateLimit(`login:${parsed.data.email.toLowerCase()}`, 8, 10 * 60_000).ok) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Not confirmed yet: send the link again and tell them what to do.
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
      await supabase.auth.resend({ type: "signup", email: parsed.data.email });
      return { notice: CONFIRM_NOTICE(parsed.data.email.toLowerCase()) };
    }
    return { error: "Incorrect email or password." }; // same message for every other failure
  }
  redirect("/dashboard");
}

export async function signUpAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (isDemoMode()) redirect("/dashboard");
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const check = checkSignupEmail(parsed.data.email);
  if (!check.ok) return { error: check.error };

  if (!rateLimit(`signup:${check.email}`, 4, 60 * 60_000).ok) {
    return { error: "Too many attempts. Try again later." };
  }

  // One account per mailbox: refuse an alias of an email that already has an account.
  const db = createAdminClient();
  const { data: taken } = await db.from("signup_identities").select("owner_id").eq("canonical", check.canonical).maybeSingle();
  if (taken) return { error: "An account already exists for this email. Log in instead." };

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signUp({ email: check.email, password: parsed.data.password });
  if (error) return { error: error.message };
  const userId = data.user?.id;
  if (userId) {
    const { error: claimError } = await db.from("signup_identities").insert({ canonical: check.canonical, owner_id: userId });
    if (claimError) {
      // Lost a race with another signup for the same mailbox: undo this one.
      await db.auth.admin.deleteUser(userId);
      return { error: "An account already exists for this email. Log in instead." };
    }
  }
  if (!data.session) return { notice: CONFIRM_NOTICE(check.email) };
  redirect("/dashboard");
}
