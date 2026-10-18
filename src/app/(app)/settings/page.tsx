import { SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/ui/primitives";
import { PlanCard } from "@/components/plan/plan-card";
import { requireUser } from "@/lib/auth";
import { getPlanState } from "@/lib/plan-state";
import { headers } from "next/headers";
import { getRepository } from "@/lib/repo";
import { getInstagramService } from "@/lib/services/instagram";
import { daysLeft } from "@/lib/services/instagram/token";
import { getLlmStatus } from "@/lib/services/llm/resolve";
import { decryptFromStorage } from "@/lib/secrets";
import type { PublicAppSettings } from "@/lib/types";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const raw = await getRepository().getAppSettings(user.id);

  // Strip the ciphertext before anything crosses the server/client boundary.
  const { groq_key_encrypted, apify_key_encrypted, meta_token_encrypted, meta_app_secret_encrypted, ai_key_encrypted, ...rest } = raw;
  const settings: PublicAppSettings = {
    ...rest,
    ai_key_saved: Boolean(ai_key_encrypted),
    groq_key_saved: Boolean(groq_key_encrypted),
    apify_key_saved: Boolean(apify_key_encrypted),
    meta_token_saved: Boolean(meta_token_encrypted),
    meta_app_secret_saved: Boolean(meta_app_secret_encrypted),
  };

  // Count groq keys by decrypting and splitting
  let groqKeyCount = 0;
  if (groq_key_encrypted) {
    try {
      const decrypted = decryptFromStorage(groq_key_encrypted);
      const keys = decrypted.split(",").map((k: string) => k.trim()).filter((k: string) => k);
      groqKeyCount = keys.length;
    } catch {
      groqKeyCount = 1;
    }
  }

  // Count apify keys by decrypting and splitting
  let apifyKeyCount = 0;
  if (apify_key_encrypted) {
    try {
      const decrypted = decryptFromStorage(apify_key_encrypted);
      const keys = decrypted.split(",").map((k: string) => k.trim()).filter((k: string) => k);
      apifyKeyCount = keys.length;
    } catch {
      apifyKeyCount = 1;
    }
  }

  const llmStatus = getLlmStatus(raw);
  const plan = user.demo ? null : await getPlanState(user.id);
  const allConversations = await getRepository().listConversations(user.id);
  const activeChats = allConversations.filter((c) => c.settings.auto_chat_enabled).length;

  const ig = await (await getInstagramService(user.id)).getStatus();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const callbackUrl = host ? `${proto}://${host}/api/webhooks/instagram` : "/api/webhooks/instagram";
  return (
    <div className="scroll-thin h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <PageHeader title="Settings" />
      {plan ? (
        <div className="mx-auto mb-4 max-w-3xl">
          <PlanCard plan={plan} activeChats={activeChats} />
        </div>
      ) : null}
      <SettingsForm
        settings={settings}
        llm={{ ...llmStatus, keyCount: groqKeyCount }}
        apify={{ keyCount: apifyKeyCount }}
        instagram={ig}
        callbackUrl={callbackUrl}
        daysLeft={daysLeft(raw.meta_token_expires_at)}
        demo={user.demo}
        planActive={user.demo || Boolean(plan?.active)}
        accountEmail={user.email}
        ownKeys={user.demo || Boolean(plan?.active && plan.code !== "basic" && plan.code !== "free")}
      />
    </div>
  );
}
